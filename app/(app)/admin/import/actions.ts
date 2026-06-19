'use server';

import { requireRole } from '@/lib/auth/rbac';
import { connectDB } from '@/lib/db/connection';
import { MasterclassModel } from '@/lib/db/models';

export interface SerializedMasterclass {
  _id: string;
  projectId: string;
  title: string;
  scheduledAt: string;
  status: 'scheduled' | 'live' | 'completed';
}

/**
 * Fetch masterclasses filtered by project. Admin only.
 */
export async function getMasterclassesByProject(
  projectId: string,
): Promise<SerializedMasterclass[]> {
  await requireRole('admin');
  await connectDB();

  const masterclasses = await (MasterclassModel as any).find({ projectId })
    .select('_id projectId title scheduledAt status')
    .sort({ scheduledAt: -1 })
    .lean();

  return JSON.parse(JSON.stringify(masterclasses)) as SerializedMasterclass[];
}
