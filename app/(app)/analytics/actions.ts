'use server';

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import {
  LeadModel,
  ActivityModel,
  DispositionModel,
  ProjectModel,
} from '@/lib/db/models';
import { requireAuth, scopeLeadQueryToUser } from '@/lib/auth/rbac';

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

  // Build base lead query, RBAC-scoped.
  // For non-admins, only allow filtering to a project they're assigned to.
  const baseQuery = scopeLeadQueryToUser(session);
  const leadFilter: Record<string, unknown> = { ...baseQuery };

  if (projectId && projectId !== 'all') {
    const allowed = session.user.assignedProjectIds ?? [];
    if (session.user.role === 'admin' || allowed.includes(projectId)) {
      leadFilter.projectId = new mongoose.Types.ObjectId(projectId);
    }
  }

  if (sourceChannel && sourceChannel !== 'all') {
    leadFilter.sourceChannel = sourceChannel;
  }

  // Stage 1: Registered = total leads matching the filter
  // Get lead IDs and enrolled count via a single aggregation instead
  // of loading all lead documents into memory.
  const [registeredCount, leadIdAgg, enrolledCount] = await Promise.all([
    LeadModel.countDocuments(leadFilter as any),
    (LeadModel as any).distinct('_id', leadFilter as any).exec(),
    LeadModel.countDocuments({ ...leadFilter, outcome: 'enrolled' } as any),
  ]);

  const leadIds = leadIdAgg;

  // Stage 2 + 3 in parallel (distinct queries on indexed fields)
  const [attendedLeadIds, connectedLeadIds] = await Promise.all([
    (ActivityModel as any).distinct('leadId', {
      leadId: { $in: leadIds },
      type: { $in: ['attended_live', 'watched_replay'] },
    }).exec(),
    (DispositionModel as any).distinct('leadId', {
      leadId: { $in: leadIds },
      outcome: 'connected',
    }).exec(),
  ]);
  const attendedCount = attendedLeadIds.length;
  const connectedCount = connectedLeadIds.length;

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
  const projectFilter: Record<string, unknown> = { active: true };
  if (session.user.role !== 'admin') {
    projectFilter._id = { $in: (session.user.assignedProjectIds ?? []).map((id: string) => new mongoose.Types.ObjectId(id)) };
  }
  const projects = await ProjectModel.find(projectFilter as any)
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

  // Build scoped query (RBAC) with ObjectId casting for aggregate
  const baseQuery = scopeLeadQueryToUser(session);
  const filter: Record<string, unknown> = { ...baseQuery };

  // Cast RBAC projectId.$in strings to ObjectIds for aggregate compatibility
  if (filter.projectId && typeof filter.projectId === 'object' && '$in' in (filter.projectId as Record<string, unknown>)) {
    const ids = (filter.projectId as { $in: string[] }).$in;
    filter.projectId = { $in: ids.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }

  // Validate projectId filter against RBAC scope
  if (projectId && projectId !== 'all') {
    const allowed = session.user.assignedProjectIds ?? [];
    if (session.user.role === 'admin' || allowed.includes(projectId)) {
      filter.projectId = new mongoose.Types.ObjectId(projectId);
    }
  }

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
