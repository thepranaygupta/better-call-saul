import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ActivityModel,
  ScoreSnapshotModel,
  ProjectModel,
  MasterclassModel,
  ScoringConfigModel,
} from '@/lib/db/models';
import type { ILead } from '@/lib/db/models';
import { bulkLeadImportSchema } from '@/lib/validation/schemas';
import type { BulkLeadInput } from '@/lib/validation/schemas';
import { scoreLead } from '@/lib/scoring';
import { DEFAULT_SCORING_CONFIG } from '@/lib/scoring/config';
import type {
  LeadInput,
  ScoringConfig,
} from '@/lib/scoring';
import { logAudit } from '@/lib/audit';

interface ImportError {
  row: number;
  error: string;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

const CHUNK_SIZE = 50;

/**
 * POST /api/leads/import
 *
 * Bulk import leads from a JSON array. Admin only.
 *
 * Flow:
 * 1. Auth + admin role check
 * 2. Zod validation of every row
 * 3. Verify projectId / masterclassId existence
 * 4. Deduplicate by email within the batch
 * 5. Check for existing leads by email+project in the DB
 * 6. Process in chunks of 50: create leads, activities, score, snapshot
 * 7. Audit log
 * 8. Return summary
 */
export async function POST(req: NextRequest) {
  // ---- Auth: admin only ----
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 },
    );
  }

  // ---- Parse body ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  // ---- Validate ----
  const parsed = bulkLeadImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation failed' } },
      { status: 400 },
    );
  }

  const { leads } = parsed.data;

  await connectDB();

  // ---- Verify referenced projects and masterclasses exist ----
  const projectIds = [...new Set(leads.map((l) => l.projectId))];
  const masterclassIds = [...new Set(leads.map((l) => l.masterclassId))];

  const [existingProjects, existingMasterclasses] = await Promise.all([
    (ProjectModel as any).find({ _id: { $in: projectIds } })
      .select('_id')
      .lean(),
    (MasterclassModel as any).find({ _id: { $in: masterclassIds } })
      .select('_id projectId pitchStartMinute durationMinutes')
      .lean(),
  ]);

  interface MCDoc { _id: unknown; projectId?: unknown; pitchStartMinute?: number; durationMinutes?: number }

  const validProjectIds = new Set(
    existingProjects.map((p: { _id: unknown }) => String(p._id)),
  );
  const masterclassMap = new Map<string, MCDoc>(
    existingMasterclasses.map((m: MCDoc) => [String(m._id), m] as [string, MCDoc]),
  );

  // ---- Get scoring config (global fallback) ----
  const configDoc = await (ScoringConfigModel as any)
    .findOne({ projectId: { $exists: false } })
    .sort({ version: -1 })
    .lean();

  const scoringConfig: ScoringConfig = configDoc
    ? {
        fitWeights: configDoc.fitWeights as Record<string, number>,
        intentWeights: configDoc.intentWeights as Record<string, number>,
        decayHalfLifeDays: configDoc.decayHalfLifeDays as number,
        disqualifiers: configDoc.disqualifiers as string[],
        thresholds: configDoc.thresholds as { hot: number; warm: number },
      }
    : DEFAULT_SCORING_CONFIG;

  // ---- Deduplicate by email within the batch (keep first occurrence) ----
  const seenEmails = new Map<string, number>(); // email -> first row index
  const deduplicatedLeads: { lead: BulkLeadInput; row: number }[] = [];
  const result: ImportResult = {
    total: leads.length,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const emailLower = lead.email.toLowerCase();

    // Check project exists
    if (!validProjectIds.has(lead.projectId)) {
      result.errors.push({ row: i + 1, error: `Project ${lead.projectId} not found` });
      continue;
    }

    // Check masterclass exists
    const mc = masterclassMap.get(lead.masterclassId);
    if (!mc) {
      result.errors.push({
        row: i + 1,
        error: `Masterclass ${lead.masterclassId} not found`,
      });
      continue;
    }

    // Check masterclass belongs to the project
    if (String(mc.projectId) !== lead.projectId) {
      result.errors.push({
        row: i + 1,
        error: `Masterclass ${lead.masterclassId} does not belong to project ${lead.projectId}`,
      });
      continue;
    }

    // Deduplicate within batch
    if (seenEmails.has(emailLower)) {
      result.skipped++;
      result.errors.push({
        row: i + 1,
        error: `Duplicate email in batch (same as row ${seenEmails.get(emailLower)})`,
      });
      continue;
    }

    seenEmails.set(emailLower, i + 1);
    deduplicatedLeads.push({ lead, row: i + 1 });
  }

  if (deduplicatedLeads.length === 0) {
    return NextResponse.json(result);
  }

  // ---- Check existing leads in DB by email + project ----
  const emailsToCheck = deduplicatedLeads.map((d) =>
    d.lead.email.toLowerCase(),
  );
  const existingLeads = await (LeadModel as any)
    .find({
      email: { $in: emailsToCheck },
      projectId: { $in: projectIds },
    })
    .select('email projectId')
    .lean();

  const existingLeadKeys = new Set(
    (existingLeads as Array<{ email: string; projectId: { toString(): string } }>).map(
      (l) => `${l.email.toLowerCase()}:${String(l.projectId)}`,
    ),
  );

  // Filter out leads that already exist in the same project
  const newLeads: { lead: BulkLeadInput; row: number }[] = [];
  for (const entry of deduplicatedLeads) {
    const key = `${entry.lead.email.toLowerCase()}:${entry.lead.projectId}`;
    if (existingLeadKeys.has(key)) {
      result.skipped++;
      result.errors.push({
        row: entry.row,
        error: 'Lead with this email already exists in this project',
      });
    } else {
      newLeads.push(entry);
    }
  }

  if (newLeads.length === 0) {
    return NextResponse.json(result);
  }

  // ---- Process in chunks ----
  const now = new Date();

  for (let i = 0; i < newLeads.length; i += CHUNK_SIZE) {
    const chunk = newLeads.slice(i, i + CHUNK_SIZE);

    try {
      // Create lead documents
      const leadDocs = chunk.map(({ lead }) => ({
        projectId: lead.projectId,
        masterclassId: lead.masterclassId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        occupationType: lead.occupationType,
        jobTitle: lead.jobTitle,
        seniority: lead.seniority,
        city: lead.city,
        sourceChannel: lead.sourceChannel,
        isExistingCustomer: lead.isExistingCustomer ?? false,
        outcome: 'undecided' as const,
        fitScore: 0,
        intentScore: 0,
        band: 'cold' as const,
        registeredAt: now,
      }));

      const createdLeads = (await (LeadModel as any).insertMany(
        leadDocs,
      )) as ILead[];

      // Create "registered" activities for each lead
      const activityDocs = createdLeads.map((lead) => ({
        leadId: lead._id,
        type: 'registered' as const,
        occurredAt: now,
      }));

      await (ActivityModel as any).insertMany(activityDocs);

      // Create "chat_message" activities for leads that have chat messages
      const chatActivityDocs: Array<{
        leadId: unknown;
        type: 'chat_message';
        text: string;
        occurredAt: Date;
      }> = [];
      for (let j = 0; j < createdLeads.length; j++) {
        const originalInput = chunk[j]!.lead;
        if (originalInput.chatMessage) {
          chatActivityDocs.push({
            leadId: createdLeads[j]!._id,
            type: 'chat_message' as const,
            text: originalInput.chatMessage,
            occurredAt: now,
          });
        }
      }
      if (chatActivityDocs.length > 0) {
        await (ActivityModel as any).insertMany(chatActivityDocs);
      }

      // Score each lead and prepare updates + snapshots
      const bulkLeadOps: Array<{
        updateOne: {
          filter: { _id: unknown };
          update: { $set: Record<string, unknown> };
        };
      }> = [];
      const snapshotsToInsert: Array<Record<string, unknown>> = [];

      for (let j = 0; j < createdLeads.length; j++) {
        const lead = createdLeads[j]!;
        const originalInput = chunk[j]!.lead;

        // Build the masterclass context for scoring
        const mc = masterclassMap.get(originalInput.masterclassId);

        const leadInput: LeadInput = {
          occupationType: lead.occupationType,
          seniority: lead.seniority ?? undefined,
          sourceChannel: lead.sourceChannel,
          isExistingCustomer: lead.isExistingCustomer,
          email: lead.email,
          masterclassPitchStartMinute: mc?.pitchStartMinute,
          masterclassDurationMinutes: mc?.durationMinutes,
        };

        // Only the "registered" activity exists at import time
        const activityInputs = [
          {
            type: 'registered' as const,
            occurredAt: now,
          },
        ];

        const scoreResult = scoreLead(
          leadInput,
          activityInputs,
          [], // no extracted signals yet
          scoringConfig,
          now,
        );

        bulkLeadOps.push({
          updateOne: {
            filter: { _id: lead._id },
            update: {
              $set: {
                fitScore: scoreResult.fitScore,
                intentScore: scoreResult.intentScore,
                band: scoreResult.band,
                lastScoredAt: now,
              },
            },
          },
        });

        snapshotsToInsert.push({
          leadId: lead._id,
          fitScore: scoreResult.fitScore,
          intentScore: scoreResult.intentScore,
          band: scoreResult.band,
          contributions: scoreResult.contributions,
          computedAt: now,
        });
      }

      if (bulkLeadOps.length > 0) {
        await (LeadModel as any).bulkWrite(bulkLeadOps);
      }
      if (snapshotsToInsert.length > 0) {
        await (ScoreSnapshotModel as any).insertMany(snapshotsToInsert);
      }

      result.imported += createdLeads.length;
    } catch (err) {
      // If a chunk fails, log errors for each row in the chunk
      const errMsg =
        err instanceof Error ? err.message : 'Unknown error during import';
      for (const entry of chunk) {
        result.errors.push({ row: entry.row, error: errMsg });
      }
    }
  }

  // ---- Audit log ----
  await logAudit(session.user.id, 'bulk_import_leads', 'lead', 'bulk', {
    total: result.total,
    imported: result.imported,
    skipped: result.skipped,
    errorCount: result.errors.length,
  });

  return NextResponse.json(result);
}
