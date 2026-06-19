'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AnalyticsFiltersProps {
  projects: { _id: string; name: string }[];
  sources: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral',
  email: 'Email',
  paid_search: 'Paid Search',
  paid_social: 'Paid Social',
  organic: 'Organic',
  other: 'Other',
};

export function AnalyticsFilters({ projects, sources }: AnalyticsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentProject = searchParams.get('project') ?? 'all';
  const currentSource = searchParams.get('source') ?? 'all';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const currentParams = searchParams.toString();
      const params = new URLSearchParams(currentParams);
      if (value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `/analytics?${qs}` : '/analytics');
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <label htmlFor="analytics-project-filter" className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Project
        </label>
        <Select
          value={currentProject}
          onValueChange={(v: string | null) => updateFilter('project', v ?? 'all')}
        >
          <SelectTrigger id="analytics-project-filter" className="h-7 w-[160px] border-stone-200 bg-white text-[13px] text-stone-950">
            <SelectValue>
              {currentProject === 'all' ? 'All projects' : projects.find(p => p._id === currentProject)?.name ?? 'All projects'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <label htmlFor="analytics-source-filter" className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Source
        </label>
        <Select
          value={currentSource}
          onValueChange={(v: string | null) => updateFilter('source', v ?? 'all')}
        >
          <SelectTrigger id="analytics-source-filter" className="h-7 w-[160px] border-stone-200 bg-white text-[13px] text-stone-950">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
