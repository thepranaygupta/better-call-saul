import { requireRole } from '@/lib/auth/rbac';
import { getProjects, getUsers } from './actions';
import { AdminPanel } from '@/components/admin/admin-panel';

export const metadata = {
  title: 'Admin — Saul',
};

export default async function AdminPage() {
  await requireRole('admin');

  const [projects, users] = await Promise.all([getProjects(), getUsers()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">
          Admin
        </h1>
        <p className="text-[13px] text-stone-500">
          Manage projects, users, and platform configuration.
        </p>
      </div>

      <AdminPanel projects={projects} users={users} />
    </div>
  );
}
