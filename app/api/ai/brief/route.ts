import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ExtractedSignalModel,
  DispositionModel,
  ScoreSnapshotModel,
  MasterclassModel,
  CallBriefModel,
  type IExtractedSignal,
  type IDisposition,
  type IScoreSnapshot,
} from '@/lib/db/models';
import { generateBriefSchema } from '@/lib/validation/schemas';
import { isAIAvailable, azureOpenAI } from '@/lib/ai/client';
import { callBriefSchema } from '@/lib/ai/schemas';
import { buildBriefSystemPrompt, buildBriefUserPrompt } from '@/lib/ai/prompts';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const parsed = generateBriefSchema.safeParse({
    leadId: request.nextUrl.searchParams.get('leadId'),
    language: request.nextUrl.searchParams.get('language'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid params: leadId (string) and language (en|hi|hinglish) required' } },
      { status: 400 },
    );
  }
  const { leadId, language } = parsed.data;

  await connectDB();
  const scoped = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lead not found or access denied' } },
      { status: 404 },
    );
  }

  const cached = await CallBriefModel.findOne({ leadId, language } as any).sort({ generatedAt: -1 }).lean();
  if (!cached) return NextResponse.json({ brief: null });

  return NextResponse.json({
    brief: {
      summary: cached.summary,
      talkingPoints: cached.talkingPoints,
      likelyObjections: cached.likelyObjections,
      language: cached.language,
      generatedAt: cached.generatedAt,
      cached: true,
    },
  });
}

export async function POST(request: Request) {
  // --- Auth check ---
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  // --- Parse + validate input ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const parsed = generateBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation failed' } },
      { status: 400 },
    );
  }

  const { leadId, language } = parsed.data;

  await connectDB();

  // --- RBAC: verify lead belongs to user's project scope ---
  const scopedQuery = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scopedQuery as any).lean();
  if (!lead) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lead not found or access denied' } },
      { status: 404 },
    );
  }

  // --- Cache check BEFORE AI availability (cached briefs persist across restarts) ---
  const existingBrief = await CallBriefModel.findOne({
    leadId,
    language,
  } as any)
    .sort({ generatedAt: -1 })
    .lean();

  if (existingBrief) {
    return NextResponse.json({
      brief: {
        summary: existingBrief.summary,
        talkingPoints: existingBrief.talkingPoints,
        likelyObjections: existingBrief.likelyObjections,
        language: existingBrief.language,
        generatedAt: existingBrief.generatedAt,
        cached: true,
      },
    });
  }

  // --- AI availability check (only needed for NEW generation) ---
  if (!isAIAvailable()) {
    return NextResponse.json(
      { error: { code: 'AI_UNAVAILABLE', message: 'AI is not configured. Set Azure OpenAI environment variables.' } },
      { status: 503 },
    );
  }

  // --- Fetch context: signals, dispositions, snapshot, masterclass ---
  const [signals, dispositions, snapshot, masterclass] = await Promise.all([
    ExtractedSignalModel.find({ leadId } as any)
      .lean()
      .exec() as Promise<IExtractedSignal[]>,
    DispositionModel.find({ leadId } as any)
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<IDisposition[]>,
    ScoreSnapshotModel.findOne({ leadId } as any)
      .sort({ computedAt: -1 })
      .lean()
      .exec() as Promise<IScoreSnapshot | null>,
    (MasterclassModel as any).findById(lead.masterclassId).lean().exec(),
  ]);

  // --- Build prompt context ---
  const fitScore = snapshot?.fitScore ?? lead.fitScore ?? 0;
  const intentScore = snapshot?.intentScore ?? lead.intentScore ?? 0;
  const band = snapshot?.band ?? lead.band ?? 'cold';
  const contributions = snapshot?.contributions?.map((c) => ({
    signal: c.signal,
    points: c.points,
  })) ?? [];

  const signalContext = signals.map((s) => ({
    signalType: s.signalType,
    evidenceQuote: s.evidenceQuote,
  }));

  const dispositionContext = dispositions.map((d) => ({
    outcome: d.outcome,
    notes: d.notes,
  }));

  const systemPrompt = buildBriefSystemPrompt(language);
  const userPrompt = buildBriefUserPrompt({
    leadName: lead.name,
    fitScore,
    intentScore,
    band,
    contributions,
    signals: signalContext,
    dispositions: dispositionContext,
    masterclassTitle: masterclass?.title ?? 'Unknown masterclass',
    offerPriceINR: masterclass?.offerPriceINR ?? 0,
  });

  // --- Call Azure OpenAI ---
  try {
    const result = await azureOpenAI(systemPrompt, userPrompt, callBriefSchema);

    // --- Persist to CallBriefModel ---
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'unknown';
    await CallBriefModel.create({
      leadId,
      language,
      summary: result.summary,
      talkingPoints: result.talkingPoints,
      likelyObjections: result.likelyObjections,
      modelUsed: deployment,
      generatedAt: new Date(),
    });

    return NextResponse.json({
      brief: {
        summary: result.summary,
        talkingPoints: result.talkingPoints,
        likelyObjections: result.likelyObjections,
        language,
        generatedAt: new Date().toISOString(),
        cached: false,
      },
    });
  } catch (err) {
    console.error('[/api/ai/brief] AI generation failed:', err);
    return NextResponse.json(
      { error: { code: 'AI_ERROR', message: 'Failed to generate call brief. Please try again.' } },
      { status: 502 },
    );
  }
}
