'use server';

import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ActivityModel,
  DispositionModel,
  ProjectModel,
} from '@/lib/db/models';
import { requireAuth, scopeLeadQueryToUser, scopeQueryToUser } from '@/lib/auth/rbac';

export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
}

export interface FunnelProject {
  _id: string;
  name: string;
}

export interface FunnelData {
  stages: FunnelStage[];
  filters: {
    projects: FunnelProject[];
    sources: string[];
  };
}

const SOURCE_CHANNELS = [
  'referral',
  'email',
  'paid_search',
  'paid_social',
  'organic',
  'other',
] as const;

/**
 * Aggregate lead counts per funnel stage: Registered -> Attended -> Connected -> Enrolled.
 * RBAC-scoped: non-admins only see leads within their assigned projects.
 */
export async function getFunnelData(
  projectId?: string,
  sourceChannel?: string,
): Promise<FunnelData> {
  const session = await requireAuth();
  await connectDB();

  // Build base lead query, RBAC-scoped
  const baseQuery = scopeLeadQueryToUser(session);
  const leadFilter: Record<string, unknown> = { ...baseQuery };

  if (projectId && projectId !== 'all') {
    leadFilter.projectId = projectId;
  }

  if (sourceChannel && sourceChannel !== 'all') {
    leadFilter.sourceChannel = sourceChannel;
  }

  // Stage 1: Registered = total leads matching the filter
  const registeredCount = await LeadModel.countDocuments(leadFilter as any);

  // Get lead IDs matching the filter for subsequent stages
  const matchingLeads = await LeadModel.find(leadFilter as any)
    .select('_id outcome')
    .lean()
    .exec();

  const leadIds = matchingLeads.map((l) => l._id);

  // Stage 2: Attended = leads with an attended_live or watched_replay activity
  const attendedLeadIds = await (ActivityModel as any).distinct('leadId', {
    leadId: { $in: leadIds },
    type: { $in: ['attended_live', 'watched_replay'] },
  }).exec();
  const attendedCount = attendedLeadIds.length;

  // Stage 3: Connected = leads with at least one disposition outcome=connected
  const connectedLeadIds = await (DispositionModel as any).distinct('leadId', {
    leadId: { $in: leadIds },
    outcome: 'connected',
  }).exec();
  const connectedCount = connectedLeadIds.length;

  // Stage 4: Enrolled = leads with outcome='enrolled'
  const enrolledCount = matchingLeads.filter(
    (l) => l.outcome === 'enrolled',
  ).length;

  // Build stages with percentages relative to registered
  const stages: FunnelStage[] = [
    {
      name: 'Registered',
      count: registeredCount,
      percentage: 100,
    },
    {
      name: 'Attended',
      count: attendedCount,
      percentage: registeredCount > 0 ? Math.round((attendedCount / registeredCount) * 100) : 0,
    },
    {
      name: 'Connected',
      count: connectedCount,
      percentage: registeredCount > 0 ? Math.round((connectedCount / registeredCount) * 100) : 0,
    },
    {
      name: 'Enrolled',
      count: enrolledCount,
      percentage: registeredCount > 0 ? Math.round((enrolledCount / registeredCount) * 100) : 0,
    },
  ];

  // Fetch projects the user can see for filter dropdown
  const projectQuery = scopeQueryToUser(session);
  const projects = await ProjectModel.find({
    ...projectQuery,
    active: true,
  } as any)
    .select('_id name')
    .lean()
    .exec();

  return {
    stages,
    filters: {
      projects: projects.map((p) => ({
        _id: String(p._id),
        name: p.name,
      })),
      sources: [...SOURCE_CHANNELS],
    },
  };
}

// ── Calibration chart types ────────────────────────────────────────────

export interface CalibrationBand {
  band: string;
  label: string;
  total: number;
  enrolled: number;
  conversionRate: number;
}

export interface CalibrationData {
  bands: CalibrationBand[];
}

// ── Band display order & labels ────────────────────────────────────────

const BAND_ORDER = ['call_now', 'qualify', 'nurture', 'cold'] as const;

const BAND_LABELS: Record<string, string> = {
  call_now: 'Call Now',
  qualify: 'Qualify',
  nurture: 'Nurture',
  cold: 'Cold',
};

// ── Calibration data action ────────────────────────────────────────────

/**
 * Get calibration data: conversion rate per score band.
 * Proves the scoring model works — higher-scored bands should convert more.
 *
 * Respects RBAC: BDAs/Sales Leads see only their assigned projects.
 */
export async function getCalibrationData(
  projectId?: string,
): Promise<CalibrationData> {
  const session = await requireAuth();
  await connectDB();

  // Build scoped query (RBAC)
  const baseQuery = scopeLeadQueryToUser(session);
  const filter: Record<string, unknown> =
    projectId && projectId !== 'all'
      ? { ...baseQuery, projectId }
      : { ...baseQuery };

  // Exclude disqualified leads from calibration — they skew the data
  filter.band = { $in: ['call_now', 'qualify', 'nurture', 'cold'] };

  // Aggregate: group by band, count total and enrolled
  const results = await LeadModel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$band',
        total: { $sum: 1 },
        enrolled: {
          $sum: { $cond: [{ $eq: ['$outcome', 'enrolled'] }, 1, 0] },
        },
      },
    },
  ]).exec();

  // Build a map from aggregation results
  const bandMap = new Map<
    string,
    { total: number; enrolled: number }
  >();
  for (const row of results) {
    bandMap.set(row._id, { total: row.total, enrolled: row.enrolled });
  }

  // Return in fixed order, with zero-filled entries for empty bands
  const bands: CalibrationBand[] = BAND_ORDER.map((band) => {
    const data = bandMap.get(band) ?? { total: 0, enrolled: 0 };
    return {
      band,
      label: BAND_LABELS[band] ?? band,
      total: data.total,
      enrolled: data.enrolled,
      conversionRate:
        data.total > 0
          ? Math.round((data.enrolled / data.total) * 1000) / 10
          : 0,
    };
  });

  return { bands };
}
