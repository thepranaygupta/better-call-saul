export const metadata = {
  title: 'Lead Queue — Saul',
};

export default function QueuePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lead Queue</h1>
        <p className="text-muted-foreground">
          Your prioritized leads, ranked by fit and intent.
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
        <p className="text-sm text-muted-foreground">
          Queue will be implemented in Phase 2.
        </p>
      </div>
    </div>
  );
}
