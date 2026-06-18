import { Suspense } from 'react';
import { fetchQueueData } from './actions';
import { LeadQueueTable } from '@/components/lead-queue-table';
import QueueLoading from './loading';

export const metadata = {
  title: 'Lead Queue — Saul',
};

async function QueueContent({
  page,
  project,
}: {
  page: number;
  project?: string;
}) {
  const data = await fetchQueueData(page, project);
  return <LeadQueueTable data={data} />;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const project = typeof params.project === 'string' ? params.project : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold text-stone-950">Lead Queue</h1>
        <p className="text-xs text-stone-500">
          Ranked by fit and intent. Call the top of the list first.
        </p>
      </div>
      <Suspense fallback={<QueueLoading />}>
        <QueueContent page={page} project={project} />
      </Suspense>
    </div>
  );
}
