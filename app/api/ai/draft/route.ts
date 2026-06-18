import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  MasterclassModel,
  ExtractedSignalModel,
  DispositionModel,
  MessageDraftModel,
  type IExtractedSignal,
  type IDisposition,
} from '@/lib/db/models';
import { generateDraftSchema } from '@/lib/validation/schemas';
import { isAIAvailable, azureOpenAI } from '@/lib/ai/client';
import { messageDraftSchema } from '@/lib/ai/schemas';
import { buildDraftSystemPrompt, buildDraftUserPrompt } from '@/lib/ai/prompts';

export async function POST(request: Request) {
  // ---- Auth ----
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- Parse + validate body ----
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = generateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { leadId, channel, language } = parsed.data;

  // ---- AI availability check ----
  if (!isAIAvailable()) {
    return NextResponse.json(
      { error: 'AI features are not configured' },
      { status: 503 },
    );
  }

  await connectDB();

  // ---- RBAC: verify lead belongs to user's scope ----
  const scoped = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) {
    return NextResponse.json(
      { error: 'Lead not found or access denied' },
      { status: 404 },
    );
  }

  // ---- Check cache: return existing draft for same channel+language ----
  const existing = await (MessageDraftModel as any)
    .findOne({ leadId, channel, language })
    .sort({ generatedAt: -1 })
    .lean();

  if (existing) {
    return NextResponse.json({
      subject: existing.subject,
      body: existing.body,
      cached: true,
    });
  }

  // ---- Gather context for the prompt ----
  const [masterclass, signals, dispositions] = await Promise.all([
    (MasterclassModel as any).findById(lead.masterclassId).lean().exec(),
    ExtractedSignalModel.find({ leadId } as any)
      .lean()
      .exec() as Promise<IExtractedSignal[]>,
    DispositionModel.find({ leadId } as any)
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
      .exec() as Promise<IDisposition[]>,
  ]);

  const systemPrompt = buildDraftSystemPrompt(channel, language);
  const userPrompt = buildDraftUserPrompt({
    leadName: lead.name as string,
    occupationType: lead.occupationType as string,
    jobTitle: lead.jobTitle as string | undefined,
    city: lead.city as string | undefined,
    masterclassTitle: (masterclass?.title as string) ?? 'Unknown',
    offerPriceINR: (masterclass?.offerPriceINR as number) ?? 0,
    fitScore: (lead.fitScore as number) ?? 0,
    intentScore: (lead.intentScore as number) ?? 0,
    band: (lead.band as string) ?? 'cold',
    signals: signals.map((s) => ({
      signalType: s.signalType,
      polarity: s.polarity,
      evidenceQuote: s.evidenceQuote,
    })),
    recentDisposition: dispositions[0]
      ? {
          outcome: dispositions[0].outcome,
          notes: dispositions[0].notes,
        }
      : undefined,
  });

  // ---- Call Azure OpenAI ----
  try {
    const result = await azureOpenAI(systemPrompt, userPrompt, messageDraftSchema);

    // Persist to cache
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'unknown';
    await MessageDraftModel.create({
      leadId,
      channel,
      language,
      subject: result.subject,
      body: result.body,
      modelUsed: deployment,
      generatedAt: new Date(),
    });

    return NextResponse.json({
      subject: result.subject,
      body: result.body,
      cached: false,
    });
  } catch (err) {
    console.error('[/api/ai/draft] AI generation failed:', err);
    return NextResponse.json(
      {
        error: 'Draft generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
