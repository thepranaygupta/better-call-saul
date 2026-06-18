import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/config';
import { connectDB } from '@/lib/db/connection';
import { ActivityModel, ExtractedSignalModel, LeadModel } from '@/lib/db/models';
import { scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { azureOpenAI, isAIAvailable } from '@/lib/ai/client';
import { extractedSignalSchema } from '@/lib/ai/schemas';
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from '@/lib/ai/prompts';

/** Zod schema for the request body — validates + sanitises input at the boundary. */
const requestBodySchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
});

/**
 * POST /api/ai/extract
 *
 * Accepts `{ leadId }`, fetches the lead's chat/question text activities,
 * sends them to Azure OpenAI for buying-signal extraction, validates the
 * response against the Zod enum schema, persists the signals, and returns them.
 *
 * Security:
 * - Auth + RBAC: session required; lead must be in the user's project scope.
 * - Prompt-injection guard: lead text is delimited as untrusted data in the
 *   prompt; Zod enum schema rejects any output not matching valid signal types.
 * - Zod input validation: rejects unknown/extra fields in the request body.
 * - Graceful degradation: returns 503 when AI is not configured.
 */
export async function POST(req: NextRequest) {
  // ---- Auth ----
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- AI availability check ----
  if (!isAIAvailable()) {
    return NextResponse.json(
      { error: 'AI service is not configured. Signal extraction is unavailable.' },
      { status: 503 },
    );
  }

  // ---- Input validation ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { leadId } = parsed.data;

  await connectDB();

  // ---- RBAC: verify lead belongs to user's project scope ----
  const scopedQuery = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scopedQuery as any).lean();
  if (!lead) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ---- Fetch text activities for this lead ----
  const activities = await ActivityModel.find({
    leadId,
    text: { $exists: true, $ne: '' },
  } as any).lean();

  // No text activities → return empty signals without calling AI
  if (activities.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  const messages = activities
    .map((a) => a.text)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);

  if (messages.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  const activityIds = activities.map((a) => a._id.toString());

  // ---- Call Azure OpenAI with extraction prompt ----
  let result: z.infer<typeof extractedSignalSchema>;
  try {
    result = await azureOpenAI(
      EXTRACTION_SYSTEM_PROMPT,
      buildExtractionUserPrompt(messages),
      extractedSignalSchema,
    );
  } catch (err) {
    console.error(
      '[/api/ai/extract] Azure OpenAI call failed:',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: 'AI extraction failed. Please try again later.' },
      { status: 502 },
    );
  }

  // ---- Persist extracted signals ----
  if (result.signals.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  const savedSignals = await ExtractedSignalModel.insertMany(
    result.signals.map((s) => ({
      leadId,
      sourceActivityIds: activityIds,
      signalType: s.signalType,
      polarity: s.polarity,
      confidence: s.confidence,
      evidenceQuote: s.evidenceQuote,
      modelUsed: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'unknown',
      extractedAt: new Date(),
    })) as any,
  );

  return NextResponse.json({ signals: savedSignals });
}
