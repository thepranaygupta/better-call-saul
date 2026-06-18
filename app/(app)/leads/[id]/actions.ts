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
  type IActivity,
  type IExtractedSignal,
  type IDisposition,
  type IScoreSnapshot,
} from '@/lib/db/models';
import { requireAuth, scopeLeadQueryToUser } from '@/lib/auth/rbac';
import { createDispositionSchema } from '@/lib/validation/schemas';
import { scoreLead, DEFAULT_SCORING_CONFIG } from '@/lib/scoring';
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
}

export interface LeadDetailData {
  lead: LeadDetail;
  activities: LeadDetailActivity[];
  signals: LeadDetailSignal[];
  dispositions: LeadDetailDisposition[];
  snapshot: LeadDetailSnapshot | null;
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

  const [activities, signals, dispositions, masterclass, project] =
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
    ]);

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
  };
}

// ---------------------------------------------------------------------------
// logDisposition — create a disposition, update lead if terminal outcome
// ---------------------------------------------------------------------------

export async function logDisposition(
  data: unknown,
): Promise<{ success: boolean; disposition?: LeadDetailDisposition }> {
  const session = await requireAuth();
  const parsed = createDispositionSchema.parse(data);

  await connectDB();

  // RBAC: verify lead belongs to user's scope
  const scoped = scopeLeadQueryToUser(session, { _id: parsed.leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) throw new Error('Lead not found or access denied');

  const disposition = await DispositionModel.create({
    leadId: parsed.leadId,
    bdaId: session.user.id,
    outcome: parsed.outcome,
    notes: parsed.notes,
    nextActionAt: parsed.nextActionAt,
  });

  // Update lead outcome if enrolled or not_interested
  if (parsed.outcome === 'enrolled') {
    await (LeadModel as any).findByIdAndUpdate(parsed.leadId, {
      outcome: 'enrolled',
    });
  } else if (parsed.outcome === 'not_interested') {
    await (LeadModel as any).findByIdAndUpdate(parsed.leadId, {
      outcome: 'not_enrolled',
    });
  }

  revalidatePath(`/leads/${parsed.leadId}`);

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
