'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState, useTransition } from 'react';
import { BandBadge, BAND_BORDER_COLORS, type Band } from '@/components/band-badge';
import { ScoreBadges } from '@/components/score-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import type { QueueData } from '@/app/(app)/queue/actions';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '--';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral',
  email: 'Email',
  paid_search: 'Paid Search',
  paid_social: 'Paid Social',
  organic: 'Organic',
  other: 'Other',
};

const BAND_LABELS: Record<string, string> = {
  call_now: 'Call Now',
  qualify: 'Qualify',
  nurture: 'Nurture',
  cold: 'Cold',
  disqualified: 'Disqualified',
};

const ACTIVITY_LABELS: Record<string, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  older: 'Older',
};

/** Debounced search input -- uses key reset pattern to sync with URL */
function DebouncedSearchInput({
  defaultValue,
  onSearch,
}: {
  defaultValue: string;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(next);
    }, 350);
  };

  const handleClear = () => {
    setValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch('');
  };

  return (
    <div className="relative w-full sm:w-auto">
      <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
      <label htmlFor="queue-search" className="sr-only">
        Search leads
      </label>
      <Input
        id="queue-search"
        type="search"
        placeholder="Search name, email, phone..."
        value={value}
        onChange={handleChange}
        className="h-7 w-full pl-7 pr-7 text-xs sm:w-[200px]"
      />
      {value.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:text-stone-600"
          aria-label="Clear search"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
}

interface LeadQueueTableProps {
  data: QueueData;
}

export function LeadQueueTable({ data }: LeadQueueTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentProject = searchParams.get('project') ?? 'all';
  const currentBand = searchParams.get('band') ?? 'all';
  const currentSource = searchParams.get('source') ?? 'all';
  const currentOwner = searchParams.get('owner') ?? 'all';
  const currentActivity = searchParams.get('activity') ?? 'all';
  const currentSearch = searchParams.get('search') ?? '';

  const navigate = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v === 'all' || v === '' || v === '1') {
          sp.delete(k);
        } else {
          sp.set(k, v);
        }
      }
      const qs = sp.toString();
      startTransition(() => {
        router.push(qs ? `/queue?${qs}` : '/queue');
      });
    },
    [router, searchParams, startTransition],
  );

  const handleFilterChange = (key: string) => (value: string | null) => {
    navigate({ [key]: value ?? 'all', page: '1' });
  };

  const handleSearch = useCallback(
    (value: string) => {
      navigate({ search: value, page: '1' });
    },
    [navigate],
  );

  const handlePageChange = (newPage: number) => {
    navigate({ page: String(newPage) });
  };

  // Count active filters (excluding search)
  const activeFilterCount = [currentProject, currentBand, currentSource, currentOwner, currentActivity]
    .filter((v) => v !== 'all').length + (currentSearch.length > 0 ? 1 : 0);

  const clearAllFilters = () => {
    startTransition(() => {
      router.push('/queue');
    });
  };

  const showOwnerFilter = data.currentUserRole === 'admin' || data.currentUserRole === 'sales_lead';

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-col gap-2">
        {/* Search + filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Debounced search -- key resets internal state when URL search changes */}
          <DebouncedSearchInput
            key={currentSearch}
            defaultValue={currentSearch}
            onSearch={handleSearch}
          />

          {/* Project filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              Project
            </span>
            <Select value={currentProject} onValueChange={handleFilterChange('project')}>
              <SelectTrigger size="sm" className="h-7 min-w-[120px] text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {data.projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Band / Stage filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              Stage
            </span>
            <Select value={currentBand} onValueChange={handleFilterChange('band')}>
              <SelectTrigger size="sm" className="h-7 min-w-[110px] text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(BAND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source channel filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              Source
            </span>
            <Select value={currentSource} onValueChange={handleFilterChange('source')}>
              <SelectTrigger size="sm" className="h-7 min-w-[110px] text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner / BDA filter (admin/sales_lead only) */}
          {showOwnerFilter && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                Owner
              </span>
              <Select value={currentOwner} onValueChange={handleFilterChange('owner')}>
                <SelectTrigger size="sm" className="h-7 min-w-[120px] text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {data.bdas.map((bda) => (
                    <SelectItem key={bda._id} value={bda._id}>
                      {bda.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Last activity filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              Activity
            </span>
            <Select value={currentActivity} onValueChange={handleFilterChange('activity')}>
              <SelectTrigger size="sm" className="h-7 min-w-[110px] text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count + clear filters */}
        <div className="flex items-center justify-between">
          <span className="text-xs tabular-nums text-stone-500">
            {data.totalCount} lead{data.totalCount !== 1 ? 's' : ''}
            {activeFilterCount > 0 && ' (filtered)'}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-medium text-amber-700 hover:text-amber-800"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {data.leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-stone-300 bg-stone-50 py-16">
          <p className="text-sm font-medium text-stone-950">
            {activeFilterCount > 0 ? 'No leads match filters' : 'No leads assigned'}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {activeFilterCount > 0
              ? 'Try adjusting your filters or clearing them.'
              : 'Leads will appear here once they are assigned to your projects.'}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="mt-3 text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Lead
                    </th>
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Project
                    </th>
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Band
                    </th>
                    <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Scores
                    </th>
                    <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      Last Activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((lead) => (
                    <tr
                      key={lead._id}
                      className={cn(
                        'h-[52px] border-b border-stone-200 border-l-4 transition-colors hover:bg-stone-100',
                        BAND_BORDER_COLORS[lead.band as Band],
                        lead.band === 'disqualified' && 'opacity-50',
                      )}
                    >
                      <td className="px-3">
                        <Link
                          href={`/leads/${lead._id}`}
                          className="group flex flex-col"
                        >
                          <span className="font-medium text-stone-950 group-hover:text-amber-700">
                            {lead.name}
                          </span>
                          <span className="text-[11px] text-stone-500">
                            {lead.email}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3">
                        <span className="text-xs text-stone-500">{lead.projectName}</span>
                      </td>
                      <td className="px-3">
                        <BandBadge band={lead.band as Band} />
                      </td>
                      <td className="px-3 text-right">
                        <ScoreBadges
                          fitScore={lead.fitScore}
                          intentScore={lead.intentScore}
                        />
                      </td>
                      <td className="px-3 text-right">
                        <span className="text-xs tabular-nums text-stone-500">
                          {timeAgo(lead.lastActivityAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-0 md:hidden">
            {data.leads.map((lead) => (
              <Link
                key={lead._id}
                href={`/leads/${lead._id}`}
                className={cn(
                  'flex items-center justify-between border-b border-stone-200 border-l-4 px-3 py-2.5 transition-colors hover:bg-stone-100',
                  BAND_BORDER_COLORS[lead.band as Band],
                  lead.band === 'disqualified' && 'opacity-50',
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-stone-950">
                    {lead.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <BandBadge band={lead.band as Band} />
                    <span className="text-[11px] text-stone-500">
                      {lead.projectName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <ScoreBadges
                    fitScore={lead.fitScore}
                    intentScore={lead.intentScore}
                  />
                  <span className="text-[10px] tabular-nums text-stone-400">
                    {timeAgo(lead.lastActivityAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 pt-3">
          <span className="text-[11px] tabular-nums text-stone-500">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={data.page <= 1}
              onClick={() => handlePageChange(data.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={data.page >= data.totalPages}
              onClick={() => handlePageChange(data.page + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
