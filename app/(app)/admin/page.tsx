import Link from 'next/link';
import { requireRole } from '@/lib/auth/rbac';
import { getProjects, getUsers } from './actions';
import { AdminPanel } from '@/components/admin/admin-panel';
import { UploadIcon, SlidersHorizontalIcon } from 'lucide-react';

export const metadata = {
  title: 'Admin | Saul',
};

export default async function AdminPage() {
  await requireRole('admin');

  const [projects, users] = await Promise.all([getProjects(), getUsers()]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">
            Admin
          </h1>
          <p className="text-[13px] text-stone-500">
            Manage projects, users, and platform configuration.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/import"
            className="inline-flex h-8 items-center gap-1.5 border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-950"
          >
            <UploadIcon className="size-3.5" aria-hidden />
            Import Leads
          </Link>
          <Link
            href="/admin/scoring"
            className="inline-flex h-8 items-center gap-1.5 border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-950"
          >
            <SlidersHorizontalIcon className="size-3.5" aria-hidden />
            Scoring Config
          </Link>
        </div>
      </div>

      <AdminPanel projects={projects} users={users} />
    </div>
  );
}
