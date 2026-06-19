'use server';

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import { connectDB } from '@/lib/db/connection';
import { LeadModel, ProjectModel, ActivityModel, UserModel } from '@/lib/db/models';
import { requireAuth, requireRole, scopeLeadQueryToUser, scopeQueryToUser } from '@/lib/auth/rbac';
import { assignLeadSchema, bulkAssignLeadsSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';

const LEADS_PER_PAGE = 50;

/** Band sort priority -- call_now first, disqualified last */
const BAND_ORDER: Record<string, number> = {
  call_now: 0,
  qualify: 1,
  nurture: 2,
  cold: 3,
  disqualified: 4,
};

export interface QueueFilters {
  projectId?: string;
  band?: string;
  sourceChannel?: string;
  assignedBdaId?: string;
  search?: string;
  lastActivity?: 'today' | 'this_week' | 'this_month' | 'older';
}

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
  sourceChannel: string;
  assignedBdaId: string | null;
  assignedBdaName: string | null;
  lastActivityAt: string | null;
  registeredAt: string;
  outcome: 'enrolled' | 'not_enrolled' | 'undecided';
  city: string | null;
  occupationType: 'working_professional' | 'student' | 'other';
  jobTitle: string | null;
}

export interface QueueBda {
  _id: string;
  name: string;
}

export interface QueueProject {
  _id: string;
  name: string;
}

export interface BandCounts {
  call_now: number;
  qualify: number;
  nurture: number;
  cold: number;
  disqualified: number;
}

export interface QueueData {
  leads: QueueLead[];
  projects: QueueProject[];
  bdas: QueueBda[];
  totalCount: number;
  page: number;
  totalPages: number;
  currentUserRole: 'admin' | 'sales_lead' | 'bda';
  bandCounts: BandCounts;
}

export async function fetchQueueData(
  page: number = 1,
  filters: QueueFilters = {},
): Promise<QueueData> {
  const session = await requireAuth();
  await connectDB();

  // Build scoped query -- RBAC helpers return Record<string, unknown>
  // which we pass directly to Mongoose filter params
  const baseQuery = scopeLeadQueryToUser(session);
  const leadFilter: Record<string, unknown> = { ...baseQuery };

  // Project filter
  if (filters.projectId && filters.projectId !== 'all') {
    leadFilter.projectId = filters.projectId;
  }

  // Band filter
  if (filters.band && filters.band !== 'all') {
    leadFilter.band = filters.band;
  }

  // Source channel filter
  if (filters.sourceChannel && filters.sourceChannel !== 'all') {
    leadFilter.sourceChannel = filters.sourceChannel;
  }

  // Assigned BDA filter
  if (filters.assignedBdaId && filters.assignedBdaId !== 'all') {
    leadFilter.assignedBdaId = filters.assignedBdaId;
  }

  // Search filter -- regex on name, email, phone
  if (filters.search && filters.search.trim().length > 0) {
    const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    leadFilter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }

  // Last activity filter -- find lead IDs with activity in the time window
  if (filters.lastActivity) {
    const now = new Date();
    let dateThreshold: Date;

    switch (filters.lastActivity) {
      case 'today': {
        dateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'this_week': {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        dateThreshold = startOfWeek;
        break;
      }
      case 'this_month': {
        dateThreshold = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case 'older': {
        // For "older", we want leads whose LATEST activity is older than this month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Find leads where the latest activity is BEFORE start of month
        const recentActivityLeadIds = await ActivityModel.aggregate([
          { $group: { _id: '$leadId', lastAt: { $max: '$occurredAt' } } },
          { $match: { lastAt: { $lt: startOfMonth } } },
        ]).exec();
        const olderLeadIds = recentActivityLeadIds.map(
          (a: { _id: unknown }) => a._id,
        );
        leadFilter._id = { $in: olderLeadIds };
        dateThreshold = new Date(0); // sentinel -- skip the normal path
        break;
      }
      default:
        dateThreshold = new Date(0);
    }

    // For non-'older' filters, find leads with activity >= threshold
    if (filters.lastActivity !== 'older' && dateThreshold.getTime() > 0) {
      const activeLeadIds = await (ActivityModel.distinct as Function)('leadId', {
        occurredAt: { $gte: dateThreshold },
      });
      if (leadFilter._id) {
        // Intersect with existing _id filter
        const existing = (leadFilter._id as { $in: unknown[] }).$in;
        leadFilter._id = {
          $in: activeLeadIds.filter((id: unknown) =>
            existing.some(
              (eid: unknown) => String(eid) === String(id),
            ),
          ),
        };
      } else {
        leadFilter._id = { $in: activeLeadIds };
      }
    }
  }

  // Get total count for pagination
  const totalCount = await LeadModel.countDocuments(leadFilter as any);
  const totalPages = Math.max(1, Math.ceil(totalCount / LEADS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // Band counts for summary strip — uses RBAC scope only (no user filters)
  // Aggregate needs ObjectIds (Mongoose .find() auto-casts, aggregate doesn't)
  const bandMatchQuery = { ...baseQuery };
  if (bandMatchQuery.projectId && typeof bandMatchQuery.projectId === 'object' && '$in' in (bandMatchQuery.projectId as Record<string, unknown>)) {
    const ids = (bandMatchQuery.projectId as { $in: string[] }).$in;
    bandMatchQuery.projectId = { $in: ids.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }
  const bandAgg = await LeadModel.aggregate([
    { $match: bandMatchQuery },
    { $group: { _id: '$band', count: { $sum: 1 } } },
  ]).exec();
  const bandCounts: BandCounts = { call_now: 0, qualify: 0, nurture: 0, cold: 0, disqualified: 0 };
  for (const entry of bandAgg) {
    const band = entry._id as string;
    if (band in bandCounts) {
      bandCounts[band as keyof BandCounts] = entry.count as number;
    }
  }

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

  // Get assigned BDA names for the leads on this page
  const bdaIds = [...new Set(pageLeads.map((l) => l.assignedBdaId).filter(Boolean))];
  const bdaUsers = bdaIds.length > 0
    ? await UserModel.find({ _id: { $in: bdaIds } } as any)
        .select('_id name')
        .lean()
        .exec()
    : [];
  const bdaNameMap = new Map(
    bdaUsers.map((u: { _id: unknown; name: string }) => [String(u._id), u.name]),
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

  // Fetch BDAs for the owner filter (only for admin/sales_lead)
  let bdas: QueueBda[] = [];
  if (session.user.role === 'admin' || session.user.role === 'sales_lead') {
    const bdaQuery: Record<string, unknown> = { role: 'bda' };
    // Sales leads only see BDAs that share at least one project
    if (session.user.role === 'sales_lead') {
      bdaQuery.assignedProjectIds = {
        $in: session.user.assignedProjectIds ?? [],
      };
    }
    const bdaUsers = await UserModel.find(bdaQuery as any)
      .select('_id name')
      .lean()
      .exec();
    bdas = bdaUsers.map((u: { _id: unknown; name: string }) => ({
      _id: String(u._id),
      name: u.name,
    }));
  }

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
      sourceChannel: lead.sourceChannel ?? 'other',
      assignedBdaId: lead.assignedBdaId ? String(lead.assignedBdaId) : null,
      assignedBdaName: lead.assignedBdaId
        ? bdaNameMap.get(String(lead.assignedBdaId)) ?? null
        : null,
      lastActivityAt: activityMap.get(String(lead._id))?.toISOString() ?? null,
      registeredAt: lead.registeredAt?.toISOString() ?? new Date().toISOString(),
      outcome: lead.outcome ?? 'undecided',
      city: lead.city ?? null,
      occupationType: lead.occupationType ?? 'other',
      jobTitle: lead.jobTitle ?? null,
    })),
    projects: allProjects.map((p) => ({
      _id: String(p._id),
      name: p.name,
    })),
    bdas,
    totalCount,
    page: safePage,
    totalPages,
    currentUserRole: session.user.role,
    bandCounts,
  };
}

// ---------------------------------------------------------------------------
// getBdasForProject — list BDAs available for assignment in a project
// ---------------------------------------------------------------------------

export interface ProjectBda {
  _id: string;
  name: string;
  email: string;
}

export async function getBdasForProject(projectId: string): Promise<ProjectBda[]> {
  await requireRole('admin', 'sales_lead');
  await connectDB();

  const bdas = await UserModel.find({
    role: 'bda',
    assignedProjectIds: new mongoose.Types.ObjectId(projectId),
    active: true,
  } as any)
    .select('_id name email')
    .lean()
    .exec();

  return bdas.map((u: { _id: unknown; name: string; email: string }) => ({
    _id: String(u._id),
    name: u.name,
    email: u.email,
  }));
}

// ---------------------------------------------------------------------------
// assignLeadToBda — assign or unassign a single lead
// ---------------------------------------------------------------------------

export async function assignLeadToBda(
  data: unknown,
): Promise<{ success: boolean; error?: string; assignedBdaId?: string | null; assignedBdaName?: string | null }> {
  const session = await requireRole('admin', 'sales_lead');
  const parsed = assignLeadSchema.parse(data);

  await connectDB();

  // Verify lead is in the user's project scope
  const scoped = scopeLeadQueryToUser(session, { _id: parsed.leadId });
  const lead = await LeadModel.findOne(scoped as any).lean();
  if (!lead) {
    return { success: false, error: 'Lead not found or access denied' };
  }

  let assignedBdaName: string | null = null;

  if (parsed.bdaId !== null) {
    // Verify BDA exists, is active, is a BDA, and is assigned to the same project
    const bda = await UserModel.findOne({
      _id: parsed.bdaId,
      role: 'bda',
      assignedProjectIds: lead.projectId,
    } as any)
      .select('_id name')
      .lean();
    if (!bda) {
      return { success: false, error: 'BDA not found or not assigned to this project' };
    }
    assignedBdaName = (bda as { name: string }).name;
  }

  await (LeadModel as any).findByIdAndUpdate(
    parsed.leadId,
    { assignedBdaId: parsed.bdaId ?? null },
  );

  void logAudit(session.user.id, 'assign_lead', 'lead', parsed.leadId, {
    bdaId: parsed.bdaId,
    bdaName: assignedBdaName,
    previousBdaId: lead.assignedBdaId ? String(lead.assignedBdaId) : null,
  });

  revalidatePath('/queue');
  revalidatePath(`/leads/${parsed.leadId}`);

  return {
    success: true,
    assignedBdaId: parsed.bdaId,
    assignedBdaName,
  };
}

// ---------------------------------------------------------------------------
// bulkAssignLeads — assign or unassign multiple leads
// ---------------------------------------------------------------------------

export async function bulkAssignLeads(
  data: unknown,
): Promise<{ success: boolean; error?: string; count?: number }> {
  const session = await requireRole('admin', 'sales_lead');
  const parsed = bulkAssignLeadsSchema.parse(data);

  await connectDB();

  // Verify all leads are in the user's project scope
  const scoped = scopeLeadQueryToUser(session, {
    _id: { $in: parsed.leadIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  const leads = await LeadModel.find(scoped as any)
    .select('_id projectId')
    .lean();

  if (leads.length === 0) {
    return { success: false, error: 'No leads found or access denied' };
  }
  if (leads.length !== parsed.leadIds.length) {
    return { success: false, error: 'Some leads not found or access denied' };
  }

  // Collect unique project IDs from the leads
  const projectIds = [...new Set(leads.map((l) => String(l.projectId)))];

  if (parsed.bdaId !== null) {
    // Verify BDA is assigned to ALL projects that the selected leads belong to
    const bda = await UserModel.findOne({
      _id: parsed.bdaId,
      role: 'bda',
    } as any)
      .select('_id name assignedProjectIds')
      .lean();
    if (!bda) {
      return { success: false, error: 'BDA not found' };
    }

    const bdaProjectIds = ((bda as { assignedProjectIds: { toString(): string }[] })
      .assignedProjectIds ?? []).map((id) => String(id));

    for (const pid of projectIds) {
      if (!bdaProjectIds.includes(pid)) {
        return { success: false, error: 'BDA is not assigned to one or more lead projects' };
      }
    }
  }

  // Perform the bulk update
  await (LeadModel as any).updateMany(
    { _id: { $in: parsed.leadIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { assignedBdaId: parsed.bdaId ?? null },
  );

  // Audit -- fire and forget to avoid slowing down the response
  for (const leadId of parsed.leadIds) {
    void logAudit(session.user.id, 'assign_lead', 'lead', leadId, {
      bdaId: parsed.bdaId,
      bulk: true,
    });
  }

  revalidatePath('/queue');

  return { success: true, count: leads.length };
}
