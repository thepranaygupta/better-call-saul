export const metadata = {
  title: 'Admin — Saul',
};

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Project management, user management, and scoring configuration.
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
        <p className="text-sm text-muted-foreground">
          Admin panel will be implemented in Phase 4.
        </p>
      </div>
    </div>
  );
}
