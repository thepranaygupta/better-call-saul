import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/config';
import { connectDB } from '@/lib/db/connection';
import {
  ActivityModel,
  ExtractedSignalModel,
  LeadModel,
  CallTranscriptModel,
} from '@/lib/db/models';
import { scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { azureOpenAI, isAIAvailable } from '@/lib/ai/client';
import { extractedSignalSchema } from '@/lib/ai/schemas';
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
  CALL_EXTRACTION_SYSTEM_PROMPT,
  buildCallExtractionUserPrompt,
} from '@/lib/ai/prompts';
import { rescoreLeadCore } from '@/lib/scoring/rescore';

/** Zod schema for the request body — validates + sanitises input at the boundary. */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const requestBodySchema = z.object({
  leadId: z.string().regex(objectIdRegex, 'Invalid leadId format'),
  transcriptId: z.string().regex(objectIdRegex, 'Invalid transcriptId format').optional(),
});

/**
 * POST /api/ai/extract
 *
 * Two modes:
 *
 * 1. Chat extraction (default): `{ leadId }` — fetches the lead's chat/question
 *    text activities, sends them to Azure OpenAI for buying-signal extraction.
 *
 * 2. Transcript extraction: `{ leadId, transcriptId }` — loads the specified
 *    CallTranscript, uses the call-specific extraction prompt, and after saving
 *    signals pushes their IDs onto the transcript and auto-rescores the lead.
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
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  // ---- AI availability check ----
  if (!isAIAvailable()) {
    return NextResponse.json(
      { error: { code: 'AI_UNAVAILABLE', message: 'AI service is not configured. Signal extraction is unavailable.' } },
      { status: 503 },
    );
  }

  // ---- Input validation ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation failed' } },
      { status: 400 },
    );
  }

  const { leadId, transcriptId } = parsed.data;

  await connectDB();

  // ---- RBAC: verify lead belongs to user's project scope ----
  const scopedQuery = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scopedQuery as any).lean();
  if (!lead) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Lead not found or access denied' } },
      { status: 403 },
    );
  }

  // ---- Branch: transcript extraction vs chat extraction ----
  if (transcriptId) {
    return handleTranscriptExtraction(leadId, transcriptId, session.user.id);
  }

  return handleChatExtraction(leadId);
}

// ---------------------------------------------------------------------------
// Chat extraction (original path, unchanged behaviour)
// ---------------------------------------------------------------------------

async function handleChatExtraction(leadId: string) {
  const activities = await ActivityModel.find({
    leadId,
    text: { $exists: true, $ne: '' },
  } as any).lean();

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
      { error: { code: 'AI_ERROR', message: 'AI extraction failed. Please try again later.' } },
      { status: 502 },
    );
  }

  if (result.signals.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  // Dedup: skip signal types already extracted for this lead
  const existingTypes = await (ExtractedSignalModel as any).distinct('signalType', { leadId });
  const existingSet = new Set(existingTypes as string[]);
  const newSignals = result.signals.filter((s) => !existingSet.has(s.signalType));

  if (newSignals.length === 0) {
    return NextResponse.json({ signals: [], skipped: result.signals.length });
  }

  const savedSignals = await ExtractedSignalModel.insertMany(
    newSignals.map((s) => ({
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

  return NextResponse.json({ signals: savedSignals, skipped: result.signals.length - newSignals.length });
}

// ---------------------------------------------------------------------------
// Transcript extraction (new path)
// ---------------------------------------------------------------------------

async function handleTranscriptExtraction(
  leadId: string,
  transcriptId: string,
  userId: string,
) {
  // Load the transcript document
  const transcript = await (CallTranscriptModel as any)
    .findOne({ _id: transcriptId, leadId })
    .lean();

  if (!transcript) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Transcript not found or does not belong to this lead' } },
      { status: 404 },
    );
  }

  const turns = transcript.turns as { speaker: string; text: string }[];
  if (!turns || turns.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  // Call Azure OpenAI with the call-specific extraction prompt
  let result: z.infer<typeof extractedSignalSchema>;
  try {
    result = await azureOpenAI(
      CALL_EXTRACTION_SYSTEM_PROMPT,
      buildCallExtractionUserPrompt(turns),
      extractedSignalSchema,
    );
  } catch (err) {
    console.error(
      '[/api/ai/extract] Azure OpenAI call failed (transcript):',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: { code: 'AI_ERROR', message: 'AI extraction failed. Please try again later.' } },
      { status: 502 },
    );
  }

  if (result.signals.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  // Dedup: skip signal types already extracted for this lead
  const existingTypes = await (ExtractedSignalModel as any).distinct('signalType', { leadId });
  const existingSet = new Set(existingTypes as string[]);
  const newSignals = result.signals.filter((s) => !existingSet.has(s.signalType));

  if (newSignals.length === 0) {
    return NextResponse.json({ signals: [], skipped: result.signals.length });
  }

  const savedSignals = await ExtractedSignalModel.insertMany(
    newSignals.map((s) => ({
      leadId,
      sourceActivityIds: [],
      signalType: s.signalType,
      polarity: s.polarity,
      confidence: s.confidence,
      evidenceQuote: s.evidenceQuote,
      modelUsed: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'unknown',
      extractedAt: new Date(),
    })) as any,
  );

  // Push signal IDs onto the transcript's extractedSignalIds
  const signalIds = savedSignals.map(
    (s: { _id: unknown }) => s._id,
  );
  await (CallTranscriptModel as any).findByIdAndUpdate(transcriptId, {
    $push: { extractedSignalIds: { $each: signalIds } },
  });

  // Auto-rescore the lead so the new signals are reflected immediately
  try {
    await rescoreLeadCore(leadId, userId);
  } catch (err) {
    // Rescoring failure is non-fatal; signals were saved successfully.
    // The lead will be rescored on next view via the stale-snapshot check.
    console.error(
      '[/api/ai/extract] Auto-rescore failed (non-fatal):',
      err instanceof Error ? err.message : String(err),
    );
  }

  return NextResponse.json({ signals: savedSignals });
}
