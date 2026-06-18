'use server';

import { connectDB } from '@/lib/db/connection';
import { LeadModel, ProjectModel, ActivityModel } from '@/lib/db/models';
import { requireAuth, scopeLeadQueryToUser, scopeQueryToUser } from '@/lib/auth/rbac';

const LEADS_PER_PAGE = 50;

/** Band sort priority -- call_now first, disqualified last */
const BAND_ORDER: Record<string, number> = {
  call_now: 0,
  qualify: 1,
  nurture: 2,
  cold: 3,
  disqualified: 4,
};

export interface QueueLead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  fitScore: number;
  intentScore: number;
  band: 'call_now' | 'qualify' | 'nurture' | 'cold' | 'disqualified';
  projectId: string;
  projectName: string;
  lastActivityAt: string | null;
  registeredAt: string;
  outcome: 'enrolled' | 'not_enrolled' | 'undecided';
}

export interface QueueProject {
  _id: string;
  name: string;
}

export interface QueueData {
  leads: QueueLead[];
  projects: QueueProject[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export async function fetchQueueData(
  page: number = 1,
  projectFilter?: string,
): Promise<QueueData> {
  const session = await requireAuth();
  await connectDB();

  // Build scoped query -- RBAC helpers return Record<string, unknown>
  // which we pass directly to Mongoose filter params
  const baseQuery = scopeLeadQueryToUser(session);
  const leadFilter = projectFilter && projectFilter !== 'all'
    ? { ...baseQuery, projectId: projectFilter }
    : baseQuery;

  // Get total count for pagination
  const totalCount = await LeadModel.countDocuments(leadFilter as any);
  const totalPages = Math.max(1, Math.ceil(totalCount / LEADS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // Fetch all matching leads to sort by band priority + intent in JS.
  // MongoDB lacks a native custom-order sort, so we pull all matches
  // and sort in memory. At scale, an aggregation $addFields pipeline would replace this.
  const leads = await LeadModel.find(leadFilter as any)
    .sort({ intentScore: -1 })
    .lean()
    .exec();

  // Sort by band priority (call_now first), then by intent desc within band
  const sorted = leads.sort((a, b) => {
    const bandA = BAND_ORDER[a.band] ?? 4;
    const bandB = BAND_ORDER[b.band] ?? 4;
    if (bandA !== bandB) return bandA - bandB;
    return (b.intentScore ?? 0) - (a.intentScore ?? 0);
  });

  // Paginate
  const start = (safePage - 1) * LEADS_PER_PAGE;
  const pageLeads = sorted.slice(start, start + LEADS_PER_PAGE);

  // Get project names for the leads on this page
  const projectIds = [...new Set(pageLeads.map((l) => String(l.projectId)))];
  const projects = await ProjectModel.find(
    { _id: { $in: projectIds } } as any,
  )
    .select('_id name')
    .lean()
    .exec();
  const projectMap = new Map(
    projects.map((p) => [String(p._id), p.name]),
  );

  // Get last activity timestamp for each lead on this page
  const leadIds = pageLeads.map((l) => l._id);
  const lastActivities = await ActivityModel.aggregate([
    { $match: { leadId: { $in: leadIds } } },
    { $group: { _id: '$leadId', lastAt: { $max: '$occurredAt' } } },
  ]).exec();
  const activityMap = new Map(
    lastActivities.map((a: { _id: unknown; lastAt: Date }) => [
      String(a._id),
      a.lastAt,
    ]),
  );

  // Fetch user's accessible projects for the filter dropdown
  const projectQuery = scopeQueryToUser(session);
  const allProjects = await ProjectModel.find({
    ...projectQuery,
    active: true,
  } as any)
    .select('_id name')
    .lean()
    .exec();

  return {
    leads: pageLeads.map((lead) => ({
      _id: String(lead._id),
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      fitScore: lead.fitScore ?? 0,
      intentScore: lead.intentScore ?? 0,
      band: lead.band ?? 'cold',
      projectId: String(lead.projectId),
      projectName: projectMap.get(String(lead.projectId)) ?? 'Unknown',
      lastActivityAt: activityMap.get(String(lead._id))?.toISOString() ?? null,
      registeredAt: lead.registeredAt?.toISOString() ?? new Date().toISOString(),
      outcome: lead.outcome ?? 'undecided',
    })),
    projects: allProjects.map((p) => ({
      _id: String(p._id),
      name: p.name,
    })),
    totalCount,
    page: safePage,
    totalPages,
  };
}
