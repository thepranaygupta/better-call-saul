export const metadata = {
  title: 'Lead Detail — Saul',
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lead Detail</h1>
        <p className="text-muted-foreground">Lead ID: {id}</p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
        <p className="text-sm text-muted-foreground">
          Lead detail view will be implemented in Phase 2.
        </p>
      </div>
    </div>
  );
}
