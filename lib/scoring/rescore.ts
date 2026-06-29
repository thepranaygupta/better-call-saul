import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ActivityModel,
  ExtractedSignalModel,
  MasterclassModel,
  ScoreSnapshotModel,
  ScoringConfigModel,
} from '@/lib/db/models';
import type { IActivity } from '@/lib/db/models/activity';
import type { IExtractedSignal } from '@/lib/db/models/extracted-signal';
import { scoreLead } from '@/lib/scoring';
import { DEFAULT_SCORING_CONFIG } from '@/lib/scoring/config';
import type { ActivityType, SignalType, ScoringConfig } from '@/lib/scoring/types';
import { logAudit } from '@/lib/audit';

export interface RescoreResult {
  success: true;
  band: string;
  fitScore: number;
  intentScore: number;
}

export async function rescoreLeadCore(
  leadId: string,
  actorId: string,
): Promise<RescoreResult | { success: false; error: string }> {
  await connectDB();

  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) return { success: false, error: 'Lead not found' };

  const leadIdStr = String(lead._id);

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

  const dbConfig = await ScoringConfigModel.findOne({
    projectId: lead.projectId,
  } as any)
    .sort({ version: -1 })
    .lean()
    .exec();

  const config: ScoringConfig = dbConfig
    ? {
        fitWeights: dbConfig.fitWeights as Record<string, number>,
        intentWeights: dbConfig.intentWeights as Record<string, number>,
        decayHalfLifeDays: dbConfig.decayHalfLifeDays,
        disqualifiers: dbConfig.disqualifiers,
        thresholds: dbConfig.thresholds,
      }
    : DEFAULT_SCORING_CONFIG;

  const leadInput = {
    occupationType: lead.occupationType as 'working_professional' | 'student' | 'other',
    seniority: (lead.seniority ?? 'unknown') as 'junior' | 'mid' | 'senior' | 'unknown',
    sourceChannel: lead.sourceChannel as 'referral' | 'email' | 'paid_search' | 'paid_social' | 'organic' | 'other',
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
  const result = scoreLead(leadInput, activityInputs, signalInputs, config, now);

  await ScoreSnapshotModel.create({
    leadId: leadIdStr,
    fitScore: result.fitScore,
    intentScore: result.intentScore,
    band: result.band,
    contributions: result.contributions,
    computedAt: now,
  });

  await (LeadModel as any).findByIdAndUpdate(leadIdStr, {
    fitScore: result.fitScore,
    intentScore: result.intentScore,
    band: result.band,
    lastScoredAt: now,
  });

  void logAudit(actorId, 'rescore_lead', 'lead', leadIdStr, {
    fitScore: result.fitScore,
    intentScore: result.intentScore,
    band: result.band,
  });

  return {
    success: true,
    band: result.band,
    fitScore: result.fitScore,
    intentScore: result.intentScore,
  };
}
