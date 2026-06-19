import { Suspense } from 'react';
import { fetchQueueData, type QueueFilters } from './actions';
import { LeadQueueTable } from '@/components/lead-queue-table';
import QueueLoading from './loading';

export const metadata = {
  title: 'Lead Queue — Saul',
};

async function QueueContent({
  page,
  filters,
}: {
  page: number;
  filters: QueueFilters;
}) {
  const data = await fetchQueueData(page, filters);
  return <LeadQueueTable data={data} />;
}

const VALID_LAST_ACTIVITY = ['today', 'this_week', 'this_month', 'older'] as const;

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const filters: QueueFilters = {};

  if (typeof params.project === 'string' && params.project !== 'all') {
    filters.projectId = params.project;
  }
  if (typeof params.band === 'string' && params.band !== 'all') {
    filters.band = params.band;
  }
  if (typeof params.source === 'string' && params.source !== 'all') {
    filters.sourceChannel = params.source;
  }
  if (typeof params.owner === 'string' && params.owner !== 'all') {
    filters.assignedBdaId = params.owner;
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    filters.search = params.search;
  }
  if (
    typeof params.activity === 'string' &&
    VALID_LAST_ACTIVITY.includes(params.activity as (typeof VALID_LAST_ACTIVITY)[number])
  ) {
    filters.lastActivity = params.activity as QueueFilters['lastActivity'];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h1 className="text-[20px] font-semibold text-stone-950">Lead Queue</h1>
        <p className="text-xs text-stone-500">
          Ranked by fit and intent — call the top first.
        </p>
      </div>
      <Suspense fallback={<QueueLoading />}>
        <QueueContent page={page} filters={filters} />
      </Suspense>
    </div>
  );
}
