'use server';

import { connectDB } from '@/lib/db/connection';
import { LeadModel, DispositionModel } from '@/lib/db/models';

export interface SidebarStats {
  callNowCount: number;
  calledToday: number;
  totalLeads: number;
}

export interface NextLeadInfo {
  id: string;
  name: string;
}

function buildProjectScope(
  role: string,
  assignedProjectIds: string[],
): Record<string, unknown> {
  if (role === 'admin') return {};
  return { projectId: { $in: assignedProjectIds } };
}

/**
 * Fetch compact stats for the sidebar: call_now count, today's dispositions, total leads.
 */
export async function getSidebarStats(
  userId: string,
  role: string,
  assignedProjectIds: string[],
): Promise<SidebarStats> {
  await connectDB();

  const scope = buildProjectScope(role, assignedProjectIds);

  const callNowQuery = { ...scope, band: 'call_now' } as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [callNowCount, totalLeads, calledToday] = await Promise.all([
    LeadModel.countDocuments(callNowQuery as any),
    LeadModel.countDocuments(scope as any),
    DispositionModel.countDocuments({
      bdaId: userId,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    }),
  ]);

  return { callNowCount, calledToday, totalLeads };
}

/**
 * Get the top-priority call_now lead for the "Next Lead" button.
 * Returns the lead with the highest intent score among call_now leads.
 */
export async function getNextLead(
  userId: string,
  role: string,
  assignedProjectIds: string[],
): Promise<NextLeadInfo | null> {
  await connectDB();

  const scope = buildProjectScope(role, assignedProjectIds);
  const callNowQuery = { ...scope, band: 'call_now' } as Record<string, unknown>;

  const lead = await LeadModel.findOne(callNowQuery)
    .sort({ intentScore: -1 })
    .select('_id name')
    .lean();

  if (!lead) return null;

  return {
    id: (lead as { _id: { toString(): string } })._id.toString(),
    name: (lead as { name: string }).name,
  };
}
