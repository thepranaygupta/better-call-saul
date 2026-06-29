'use server';

import { revalidatePath } from 'next/cache';
import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ActivityModel,
  ExtractedSignalModel,
  DispositionModel,
  ScoreSnapshotModel,
  MasterclassModel,
  ScoringConfigModel,
  ProjectModel,
  UserModel,
  CallTranscriptModel,
  type IActivity,
  type IExtractedSignal,
  type IDisposition,
  type IScoreSnapshot,
} from '@/lib/db/models';
import { requireAuth, scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { createDispositionSchema } from '@/lib/validation/schemas';
import { scoreLead, DEFAULT_SCORING_CONFIG } from '@/lib/scoring';
import { logAudit } from '@/lib/audit';
import type {
  Contribution,
  ActivityType,
  SignalType,
} from '@/lib/scoring';

// ---------------------------------------------------------------------------
// Serialized types returned to the client (plain objects, no ObjectId)
// ---------------------------------------------------------------------------

export interface LeadDetailActivity {
  _id: string;
  type: string;
  numericValue?: number;
  text?: string;
  occurredAt: string;
}

export interface LeadDetailSignal {
  _id: string;
  signalType: string;
  polarity: 'positive' | 'negative' | 'neutral';
  confidence: number;
  evidenceQuote: string;
  extractedAt: string;
}

export interface LeadDetailDisposition {
  _id: string;
  bdaId: string;
  outcome: string;
  notes?: string;
  nextActionAt?: string;
  createdAt: string;
}

export interface LeadDetailSnapshot {
  _id: string;
  fitScore: number;
  intentScore: number;
  band: string;
  contributions: Contribution[];
  computedAt: string;
}

export interface LeadDetailBda {
  _id: string;
  name: string;
}

export interface LeadDetail {
  _id: string;
  name: string;
  email: string;
  phone: string;
  occupationType: string;
  jobTitle?: string;
  seniority?: string;
  city?: string;
  sourceChannel: string;
  isExistingCustomer: boolean;
  outcome: string;
  fitScore: number;
  intentScore: number;
  band: string;
  projectId: string;
  projectName: string;
  masterclassTitle: string;
  registeredAt: string;
  assignedBdaId: string | null;
  assignedBdaName: string | null;
}

export interface LeadDetailData {
  lead: LeadDetail;
  activities: LeadDetailActivity[];
  signals: LeadDetailSignal[];
  dispositions: LeadDetailDisposition[];
  snapshot: LeadDetailSnapshot | null;
  /** BDAs available for assignment (only populated for admin/sales_lead) */
  availableBdas: LeadDetailBda[];
  /** Current user's role */
  currentUserRole: 'admin' | 'sales_lead' | 'bda';
}

// ---------------------------------------------------------------------------
// getLeadDetail — fetch lead + all related data, RBAC scoped
// ---------------------------------------------------------------------------

export async function getLeadDetail(leadId: string): Promise<LeadDetailData> {
  const session = await requireAuth();
  await connectDB();

  // RBAC check: verify the lead exists and belongs to the user's scope
  const scoped = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) throw new Error('Lead not found or access denied');

  const leadIdStr = String(lead._id);

  // Fire-and-forget: don't slow down the read path
  void logAudit(session.user.id, 'view_lead', 'lead', leadIdStr);

  const [activities, signals, dispositions, masterclass, project, assignedBda] =
    await Promise.all([
      ActivityModel.find({ leadId: leadIdStr } as any)
        .sort({ occurredAt: -1 })
        .lean()
        .exec() as Promise<IActivity[]>,
      ExtractedSignalModel.find({ leadId: leadIdStr } as any)
        .lean()
        .exec() as Promise<IExtractedSignal[]>,
      DispositionModel.find({ leadId: leadIdStr } as any)
        .sort({ createdAt: -1 })
        .lean()
        .exec() as Promise<IDisposition[]>,
      (MasterclassModel as any).findById(lead.masterclassId).lean().exec(),
      (ProjectModel as any).findById(lead.projectId).lean().exec(),
      lead.assignedBdaId
        ? (UserModel as any).findById(lead.assignedBdaId).select('_id name').lean().exec()
        : Promise.resolve(null),
    ]);

  // Fetch BDAs available for assignment (only for admin/sales_lead)
  let availableBdas: LeadDetailBda[] = [];
  if (session.user.role === 'admin' || session.user.role === 'sales_lead') {
    const bdaUsers = await UserModel.find({
      role: 'bda',
      assignedProjectIds: lead.projectId,
      active: { $ne: false },
    } as any)
      .select('_id name')
      .lean()
      .exec();
    availableBdas = bdaUsers.map((u: { _id: unknown; name: string }) => ({
      _id: String(u._id),
      name: u.name,
    }));
  }

  // Compute a fresh score snapshot if stale (>1 hour) or missing
  let snapshot = (await ScoreSnapshotModel.findOne({ leadId: leadIdStr } as any)
    .sort({ computedAt: -1 })
    .lean()
    .exec()) as IScoreSnapshot | null;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const isStale =
    !snapshot || new Date(snapshot.computedAt) < oneHourAgo;

  if (isStale) {
    // Load scoring config (project-specific or default)
    const dbConfig = await ScoringConfigModel.findOne({
      projectId: lead.projectId,
    } as any)
      .sort({ version: -1 })
      .lean()
      .exec();

    const config = dbConfig
      ? {
          fitWeights: dbConfig.fitWeights as Record<string, number>,
          intentWeights: dbConfig.intentWeights as Record<string, number>,
          decayHalfLifeDays: dbConfig.decayHalfLifeDays,
          disqualifiers: dbConfig.disqualifiers,
          thresholds: dbConfig.thresholds,
        }
      : DEFAULT_SCORING_CONFIG;

    const leadInput = {
      occupationType: lead.occupationType as
        | 'working_professional'
        | 'student'
        | 'other',
      seniority: (lead.seniority ?? 'unknown') as
        | 'junior'
        | 'mid'
        | 'senior'
        | 'unknown',
      sourceChannel: lead.sourceChannel as
        | 'referral'
        | 'email'
        | 'paid_search'
        | 'paid_social'
        | 'organic'
        | 'other',
      isExistingCustomer: lead.isExistingCustomer,
      email: lead.email,
      masterclassPitchStartMinute: masterclass?.pitchStartMinute,
      masterclassDurationMinutes: masterclass?.durationMinutes,
    };

    const activityInputs = activities.map((a: IActivity) => ({
      type: a.type as ActivityType,
      numericValue: a.numericValue,
      occurredAt: new Date(a.occurredAt),
    }));

    const signalInputs = signals.map((s: IExtractedSignal) => ({
      signalType: s.signalType as SignalType,
      polarity: s.polarity as 'positive' | 'negative' | 'neutral',
      confidence: s.confidence,
      extractedAt: new Date(s.extractedAt),
    }));

    const result = scoreLead(
      leadInput,
      activityInputs,
      signalInputs,
      config,
      new Date(),
    );

    // Persist the new snapshot
    const newSnapshot = await ScoreSnapshotModel.create({
      leadId: leadIdStr,
      fitScore: result.fitScore,
      intentScore: result.intentScore,
      band: result.band,
      contributions: result.contributions,
      computedAt: new Date(),
    });

    // Also update the lead document with fresh scores
    await (LeadModel as any).findByIdAndUpdate(leadIdStr, {
      fitScore: result.fitScore,
      intentScore: result.intentScore,
      band: result.band,
      lastScoredAt: new Date(),
    });

    snapshot = newSnapshot.toObject() as unknown as IScoreSnapshot;
  }

  // Serialize everything to plain JSON (no ObjectId, no Date objects)
  return {
    lead: {
      _id: leadIdStr,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      occupationType: lead.occupationType,
      jobTitle: lead.jobTitle,
      seniority: lead.seniority,
      city: lead.city,
      sourceChannel: lead.sourceChannel,
      isExistingCustomer: lead.isExistingCustomer,
      outcome: lead.outcome ?? 'undecided',
      fitScore: snapshot?.fitScore ?? lead.fitScore ?? 0,
      intentScore: snapshot?.intentScore ?? lead.intentScore ?? 0,
      band: snapshot?.band ?? lead.band ?? 'cold',
      projectId: String(lead.projectId),
      projectName: project?.name ?? 'Unknown',
      masterclassTitle: masterclass?.title ?? 'Unknown',
      registeredAt:
        lead.registeredAt?.toISOString() ?? new Date().toISOString(),
      assignedBdaId: lead.assignedBdaId ? String(lead.assignedBdaId) : null,
      assignedBdaName: assignedBda ? (assignedBda as { name: string }).name : null,
    },
    activities: activities.map((a: IActivity) => ({
      _id: String(a._id),
      type: a.type,
      numericValue: a.numericValue,
      text: a.text,
      occurredAt: a.occurredAt.toISOString(),
    })),
    signals: signals.map((s: IExtractedSignal) => ({
      _id: String(s._id),
      signalType: s.signalType,
      polarity: s.polarity as 'positive' | 'negative' | 'neutral',
      confidence: s.confidence,
      evidenceQuote: s.evidenceQuote,
      extractedAt: s.extractedAt.toISOString(),
    })),
    dispositions: dispositions.map((d: IDisposition) => ({
      _id: String(d._id),
      bdaId: String(d.bdaId),
      outcome: d.outcome,
      notes: d.notes,
      nextActionAt: d.nextActionAt?.toISOString(),
      createdAt: d.createdAt.toISOString(),
    })),
    snapshot: snapshot
      ? {
          _id: String(snapshot._id),
          fitScore: snapshot.fitScore,
          intentScore: snapshot.intentScore,
          band: snapshot.band,
          contributions: snapshot.contributions.map((c) => ({
            signal: c.signal,
            category: c.category as 'fit' | 'intent' | 'negative',
            weight: c.weight,
            points: c.points,
          })),
          computedAt:
            snapshot.computedAt instanceof Date
              ? snapshot.computedAt.toISOString()
              : String(snapshot.computedAt),
        }
      : null,
    availableBdas,
    currentUserRole: session.user.role as 'admin' | 'sales_lead' | 'bda',
  };
}

// ---------------------------------------------------------------------------
// logDisposition — create a disposition, update lead if terminal outcome
// ---------------------------------------------------------------------------

export async function logDisposition(
  data: unknown,
): Promise<{ success: true; disposition?: LeadDetailDisposition } | { success: false; error: string }> {
  const session = await requireAuth();

  const parsed = createDispositionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await connectDB();

  // RBAC: verify lead belongs to user's scope
  const scoped = scopeLeadQueryToUser(session, { _id: parsed.data.leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) return { success: false, error: 'Lead not found or access denied' };

  const disposition = await DispositionModel.create({
    leadId: parsed.data.leadId,
    bdaId: session.user.id,
    outcome: parsed.data.outcome,
    notes: parsed.data.notes,
    nextActionAt: parsed.data.nextActionAt,
  });

  // Update lead outcome if enrolled or not_interested
  if (parsed.data.outcome === 'enrolled') {
    await (LeadModel as any).findByIdAndUpdate(parsed.data.leadId, {
      outcome: 'enrolled',
    });
  } else if (parsed.data.outcome === 'not_interested') {
    await (LeadModel as any).findByIdAndUpdate(parsed.data.leadId, {
      outcome: 'not_enrolled',
    });
  }

  await logAudit(session.user.id, 'log_disposition', 'lead', parsed.data.leadId, {
    outcome: parsed.data.outcome,
  });

  revalidatePath(`/leads/${parsed.data.leadId}`);

  return {
    success: true,
    disposition: {
      _id: String(disposition._id),
      bdaId: session.user.id,
      outcome: disposition.outcome,
      notes: disposition.notes,
      nextActionAt: disposition.nextActionAt?.toISOString(),
      createdAt: disposition.createdAt.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// rescoreLead — re-fetch activities + signals, re-run scoreLead, persist
// ---------------------------------------------------------------------------

export async function rescoreLead(
  leadId: string,
): Promise<{ success: true; band?: string; fitScore?: number; intentScore?: number } | { success: false; error: string }> {
  const session = await requireAuth();

  if (!leadId || typeof leadId !== 'string') {
    return { success: false, error: 'Invalid lead ID' };
  }

  await connectDB();

  // RBAC: verify lead belongs to user's scope
  const scoped = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) return { success: false, error: 'Lead not found or access denied' };

  const leadIdStr = String(lead._id);

  // Fetch activities and signals
  const [activities, signals, masterclass] = await Promise.all([
    ActivityModel.find({ leadId: leadIdStr } as any)
      .sort({ occurredAt: -1 })
      .lean()
      .exec() as Promise<IActivity[]>,
    ExtractedSignalModel.find({ leadId: leadIdStr } as any)
      .lean()
      .exec() as Promise<IExtractedSignal[]>,
    (MasterclassModel as any).findById(lead.masterclassId).lean().exec(),
  ]);

  // Load scoring config (project-specific or default)
  const dbConfig = await ScoringConfigModel.findOne({
    projectId: lead.projectId,
  } as any)
    .sort({ version: -1 })
    .lean()
    .exec();

  const config = dbConfig
    ? {
        fitWeights: dbConfig.fitWeights as Record<string, number>,
        intentWeights: dbConfig.intentWeights as Record<string, number>,
        decayHalfLifeDays: dbConfig.decayHalfLifeDays,
        disqualifiers: dbConfig.disqualifiers,
        thresholds: dbConfig.thresholds,
      }
    : DEFAULT_SCORING_CONFIG;

  const leadInput = {
    occupationType: lead.occupationType as
      | 'working_professional'
      | 'student'
      | 'other',
    seniority: (lead.seniority ?? 'unknown') as
      | 'junior'
      | 'mid'
      | 'senior'
      | 'unknown',
    sourceChannel: lead.sourceChannel as
      | 'referral'
      | 'email'
      | 'paid_search'
      | 'paid_social'
      | 'organic'
      | 'other',
    isExistingCustomer: lead.isExistingCustomer,
    email: lead.email,
    masterclassPitchStartMinute: masterclass?.pitchStartMinute,
    masterclassDurationMinutes: masterclass?.durationMinutes,
  };

  const activityInputs = activities.map((a: IActivity) => ({
    type: a.type as ActivityType,
    numericValue: a.numericValue,
    occurredAt: new Date(a.occurredAt),
  }));

  const signalInputs = signals.map((s: IExtractedSignal) => ({
    signalType: s.signalType as SignalType,
    polarity: s.polarity as 'positive' | 'negative' | 'neutral',
    confidence: s.confidence,
    extractedAt: new Date(s.extractedAt),
  }));

  const now = new Date();
  const result = scoreLead(
    leadInput,
    activityInputs,
    signalInputs,
    config,
    now,
  );

  // Persist the new snapshot
  await ScoreSnapshotModel.create({
    leadId: leadIdStr,
    fitScore: result.fitScore,
    intentScore: result.intentScore,
    band: result.band,
    contributions: result.contributions,
    computedAt: now,
  });

  // Update the lead document with fresh scores
  await (LeadModel as any).findByIdAndUpdate(leadIdStr, {
    fitScore: result.fitScore,
    intentScore: result.intentScore,
    band: result.band,
    lastScoredAt: now,
  });

  await logAudit(session.user.id, 'rescore_lead', 'lead', leadIdStr, {
    fitScore: result.fitScore,
    intentScore: result.intentScore,
    band: result.band,
  });

  revalidatePath(`/leads/${leadIdStr}`);
  revalidatePath('/queue');

  return {
    success: true,
    band: result.band,
    fitScore: result.fitScore,
    intentScore: result.intentScore,
  };
}

// ---------------------------------------------------------------------------
// Transcript types + getTranscripts
// ---------------------------------------------------------------------------

export interface TranscriptData {
  _id: string;
  bdaName: string;
  turns: { speaker: 'agent' | 'customer'; text: string }[];
  language?: string;
  extractedSignalIds: string[];
  createdAt: string;
}

export async function getTranscripts(leadId: string): Promise<TranscriptData[]> {
  const session = await requireAuth();
  await connectDB();

  // RBAC: verify the caller can see this lead
  const scoped = scopeLeadQueryToUser(session, { _id: leadId });
  const lead = await LeadModel.findOne(scoped as any).select('_id').lean();
  if (!lead) return [];

  const transcripts = await (CallTranscriptModel as any)
    .find({ leadId })
    .sort({ createdAt: -1 })
    .lean();

  // Resolve BDA names in one query
  const bdaIds = [...new Set(transcripts.map((t: Record<string, unknown>) => String(t.bdaId)))];
  const bdas = bdaIds.length > 0
    ? await UserModel.find({ _id: { $in: bdaIds } } as any).select('_id name').lean()
    : [];
  const bdaMap = new Map((bdas as Array<{ _id: unknown; name: string }>).map((b) => [String(b._id), b.name]));

  return transcripts.map((t: Record<string, unknown>) => ({
    _id: String(t._id),
    bdaName: bdaMap.get(String(t.bdaId)) ?? 'Unknown',
    turns: t.turns as { speaker: 'agent' | 'customer'; text: string }[],
    language: t.language as string | undefined,
    extractedSignalIds: ((t.extractedSignalIds as unknown[]) ?? []).map(String),
    createdAt: (t.createdAt as Date).toISOString(),
  }));
}
