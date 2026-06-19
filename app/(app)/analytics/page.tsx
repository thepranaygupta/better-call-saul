import { Suspense } from 'react';
import { getFunnelData, getCalibrationData } from './actions';
import { FunnelChart } from '@/components/funnel-chart';
import { CalibrationChart } from '@/components/calibration-chart';
import { AnalyticsFilters } from '@/components/analytics-filters';

export const metadata = {
  title: 'Analytics | Saul',
};

async function FunnelSection({
  projectId,
  sourceChannel,
}: {
  projectId?: string;
  sourceChannel?: string;
}) {
  const data = await getFunnelData(projectId, sourceChannel);

  return (
    <div className="space-y-4">
      <AnalyticsFilters
        projects={data.filters.projects}
        sources={data.filters.sources}
      />

      <div className="border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
            Conversion funnel
          </h2>
          <span className="text-[11px] text-stone-400">
            Registered &rarr; Attended &rarr; Connected &rarr; Enrolled
          </span>
        </div>
        <FunnelChart stages={data.stages} />
      </div>
    </div>
  );
}

function FunnelFallback() {
  return (
    <div className="space-y-4">
      {/* Filter placeholders */}
      <div className="flex items-center gap-3">
        <div className="h-7 w-40 animate-pulse bg-stone-200" />
        <div className="h-7 w-40 animate-pulse bg-stone-200" />
      </div>

      {/* Chart skeleton */}
      <div className="border border-stone-200 bg-white p-4">
        <div className="mb-3 h-3 w-28 animate-pulse bg-stone-200" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 animate-pulse bg-stone-200" />
                <div className="h-3 w-12 animate-pulse bg-stone-200" />
              </div>
              <div
                className="h-8 animate-pulse bg-stone-200"
                style={{ width: `${100 - i * 20}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function CalibrationSection({ projectId }: { projectId?: string }) {
  const data = await getCalibrationData(projectId);

  return (
    <div className="border border-stone-200 bg-white p-4">
      <div className="mb-1">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Score calibration
        </h2>
        <p className="mt-0.5 text-[12px] text-stone-500">
          Higher-scored leads should convert at higher rates. This chart validates the scoring model.
        </p>
      </div>
      <CalibrationChart bands={data.bands} />
    </div>
  );
}

function CalibrationFallback() {
  return (
    <div className="border border-stone-200 bg-white p-4">
      <div className="mb-3 h-3 w-24 animate-pulse bg-stone-200" />
      <div className="mb-2 h-2.5 w-64 animate-pulse bg-stone-200" />
      <div className="flex h-[300px] items-end gap-4 px-12 pt-8">
        {[75, 55, 35, 18].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse bg-stone-200"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const projectId = typeof params.project === 'string' ? params.project : undefined;
  const sourceChannel = typeof params.source === 'string' ? params.source : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold text-stone-950">Analytics</h1>
        <p className="text-[13px] text-stone-500">
          Funnel performance and score calibration.
        </p>
      </div>

      <Suspense fallback={<FunnelFallback />}>
        <FunnelSection projectId={projectId} sourceChannel={sourceChannel} />
      </Suspense>

      <Suspense fallback={<CalibrationFallback />}>
        <CalibrationSection projectId={projectId} />
      </Suspense>
    </div>
  );
}
