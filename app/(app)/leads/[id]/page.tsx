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
        <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">Lead Detail</h1>
        <p className="text-[13px] text-stone-500">Lead ID: {id}</p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-stone-300 p-12">
        <p className="text-sm text-stone-500">
          Lead detail view will be implemented in Phase 2.
        </p>
      </div>
    </div>
  );
}
