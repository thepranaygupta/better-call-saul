import { requireRole } from '@/lib/auth/rbac';
import { getProjects } from '@/app/(app)/admin/actions';
import { CsvImport } from '@/components/admin/csv-import';

export const metadata = {
  title: 'Import Leads — Saul',
};

export default async function ImportPage() {
  await requireRole('admin');

  const projects = await getProjects();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">
          Import Leads
        </h1>
        <p className="text-[13px] text-stone-500">
          Bulk import leads from a CSV file. Select a project and masterclass,
          upload your file, confirm the column mapping, and import.
        </p>
      </div>

      <CsvImport projects={projects} />
    </div>
  );
}
