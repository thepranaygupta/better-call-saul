export const metadata = {
  title: 'Admin — Saul',
};

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">Admin</h1>
        <p className="text-[13px] text-stone-500">
          Project management, user management, and scoring configuration.
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-stone-300 p-12">
        <p className="text-sm text-stone-500">
          Admin panel will be implemented in Phase 4.
        </p>
      </div>
    </div>
  );
}
