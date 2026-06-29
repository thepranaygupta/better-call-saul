import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ActivityModel,
  CallTranscriptModel,
} from '@/lib/db/models';
import { importTranscriptSchema } from '@/lib/validation/schemas';
import { parseTranscript } from '@/lib/transcript-parser';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/transcripts/import
 *
 * Imports a raw call transcript for a lead. Parses the text into structured
 * speaker/customer turns, creates a CallTranscript document, logs an activity
 * record, and returns the parsed result.
 *
 * Security:
 * - Auth required (any authenticated user).
 * - RBAC: the lead must be in the user's project scope.
 * - Input validated with Zod at the boundary.
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

  const parsed = importTranscriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
      },
      { status: 400 },
    );
  }

  await connectDB();

  // ---- RBAC: verify user has access to this lead ----
  const scoped = scopeLeadQueryToUser(session, { _id: parsed.data.leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lead not found or access denied' } },
      { status: 404 },
    );
  }

  // ---- Parse transcript ----
  let turns: ReturnType<typeof parseTranscript>;
  try {
    turns = parseTranscript(parsed.data.text);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'PARSE_ERROR',
          message:
            err instanceof Error ? err.message : 'Failed to parse transcript',
        },
      },
      { status: 400 },
    );
  }

  if (turns.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Transcript has no conversation turns',
        },
      },
      { status: 400 },
    );
  }

  const now = new Date();

  // ---- Create CallTranscript document ----
  const transcript = await (CallTranscriptModel as any).create({
    leadId: parsed.data.leadId,
    bdaId: session.user.id,
    turns,
    language: parsed.data.language,
    extractedSignalIds: [],
  });

  // ---- Create activity record ----
  await (ActivityModel as any).create({
    leadId: parsed.data.leadId,
    type: 'call_transcript_added',
    text: `Call transcript added by ${session.user.name ?? 'Unknown'}`,
    occurredAt: now,
  });

  // ---- Audit log (fire-and-forget) ----
  void logAudit(
    session.user.id,
    'import_transcript',
    'call_transcript',
    String(transcript._id),
    {
      leadId: parsed.data.leadId,
      turnCount: turns.length,
    },
  );

  return NextResponse.json({
    transcriptId: String(transcript._id),
    turns: transcript.turns,
    turnCount: turns.length,
  });
}
