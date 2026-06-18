'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { BandBadge, BAND_BORDER_COLORS, type Band } from '@/components/band-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronsUpDownIcon,
} from 'lucide-react';
import type { QueueData, QueueLead } from '@/app/(app)/queue/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Band sort priority for TanStack custom sort */
const BAND_ORDER: Record<string, number> = {
  call_now: 0,
  qualify: 1,
  nurture: 2,
  cold: 3,
  disqualified: 4,
};

// ---------------------------------------------------------------------------
// Intent score cell — monospace, prominent, color-coded
// ---------------------------------------------------------------------------

function intentScoreColor(score: number): string {
  if (score >= 70) return 'text-red-800';
  if (score >= 40) return 'text-amber-700';
  return 'text-stone-400';
}

function IntentScoreCell({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'font-mono text-sm font-semibold tabular-nums',
        intentScoreColor(score),
      )}
    >
      {String(score).padStart(2, '0')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort indicator for column headers
// ---------------------------------------------------------------------------

function SortIndicator({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') {
    return <ArrowUpIcon className="ml-1 inline size-3 text-amber-700" />;
  }
  if (sorted === 'desc') {
    return <ArrowDownIcon className="ml-1 inline size-3 text-amber-700" />;
  }
  return <ChevronsUpDownIcon className="ml-1 inline size-3 text-stone-300" />;
}

// ---------------------------------------------------------------------------
// Debounced search — uses key-reset pattern to sync with URL
// ---------------------------------------------------------------------------

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
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
      <label htmlFor="queue-search" className="sr-only">
        Search leads
      </label>
      <input
        id="queue-search"
        type="search"
        placeholder="Search name, email, phone..."
        value={value}
        onChange={handleChange}
        className="h-7 w-full rounded-full border border-stone-200 bg-white pl-8 pr-7 text-[11px] text-stone-950 placeholder:text-stone-400 outline-none transition-colors focus:border-amber-700/40 focus:ring-1 focus:ring-amber-700/20 sm:w-[220px]"
      />
      {value.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-stone-400 hover:text-stone-600"
          aria-label="Clear search"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip — pill-style native select
// ---------------------------------------------------------------------------

interface FilterChipProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterChip({ label, value, options, onChange }: FilterChipProps) {
  const isActive = value !== 'all';

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-7 cursor-pointer appearance-none rounded-full border px-3 pr-6 text-[11px] font-medium uppercase tracking-wide outline-none transition-colors',
          isActive
            ? 'border-amber-700/30 bg-amber-50 text-amber-800'
            : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700',
        )}
        aria-label={`Filter by ${label}`}
      >
        <option value="all">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className={cn(
          'pointer-events-none absolute right-2 top-1/2 size-2.5 -translate-y-1/2',
          isActive ? 'text-amber-700' : 'text-stone-400',
        )}
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TanStack column definitions
// ---------------------------------------------------------------------------

function createColumns(): ColumnDef<QueueLead>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Lead',
      enableSorting: true,
      cell: ({ row }) => (
        <Link
          href={`/leads/${row.original._id}`}
          className="group flex flex-col"
        >
          <span className="text-[13px] font-medium text-stone-950 group-hover:text-amber-700">
            {row.original.name}
          </span>
          <span className="text-[11px] text-stone-500">
            {row.original.email}
          </span>
        </Link>
      ),
    },
    {
      accessorKey: 'intentScore',
      header: 'Intent',
      enableSorting: true,
      cell: ({ row }) => <IntentScoreCell score={row.original.intentScore} />,
    },
    {
      accessorKey: 'band',
      header: 'Band',
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = BAND_ORDER[rowA.original.band] ?? 4;
        const b = BAND_ORDER[rowB.original.band] ?? 4;
        return a - b;
      },
      cell: ({ row }) => <BandBadge band={row.original.band as Band} />,
    },
    {
      accessorKey: 'sourceChannel',
      header: 'Source',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-stone-500">
          {SOURCE_LABELS[row.original.sourceChannel] ?? row.original.sourceChannel}
        </span>
      ),
    },
    {
      accessorKey: 'lastActivityAt',
      header: 'Last Activity',
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.lastActivityAt
          ? new Date(rowA.original.lastActivityAt).getTime()
          : 0;
        const b = rowB.original.lastActivityAt
          ? new Date(rowB.original.lastActivityAt).getTime()
          : 0;
        return a - b;
      },
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-stone-500">
          {timeAgo(row.original.lastActivityAt)}
        </span>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface LeadQueueTableProps {
  data: QueueData;
}

export function LeadQueueTable({ data }: LeadQueueTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // URL-derived filter state
  const currentProject = searchParams.get('project') ?? 'all';
  const currentBand = searchParams.get('band') ?? 'all';
  const currentSource = searchParams.get('source') ?? 'all';
  const currentOwner = searchParams.get('owner') ?? 'all';
  const currentActivity = searchParams.get('activity') ?? 'all';
  const currentSearch = searchParams.get('search') ?? '';

  // TanStack table sorting (client-side within the current page)
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => createColumns(), []);

  const table = useReactTable({
    data: data.leads,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // URL navigation helper
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

  const handleFilterChange = (key: string) => (value: string) => {
    navigate({ [key]: value, page: '1' });
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

  // Active filter count
  const activeFilterCount =
    [currentProject, currentBand, currentSource, currentOwner, currentActivity].filter(
      (v) => v !== 'all',
    ).length + (currentSearch.length > 0 ? 1 : 0);

  const clearAllFilters = () => {
    startTransition(() => {
      router.push('/queue');
    });
  };

  const showOwnerFilter =
    data.currentUserRole === 'admin' || data.currentUserRole === 'sales_lead';

  // Build filter options — names, not IDs
  const projectOptions = data.projects.map((p) => ({ value: p._id, label: p.name }));
  const bandOptions = Object.entries(BAND_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const sourceOptions = Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const ownerOptions = data.bdas.map((b) => ({ value: b._id, label: b.name }));
  const activityOptions = Object.entries(ACTIVITY_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  return (
    <div className="space-y-3">
      {/* ── Status bar: count + active filters ────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-stone-500">
            {data.totalCount} lead{data.totalCount !== 1 ? 's' : ''}
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-[11px] font-medium text-amber-700 hover:text-amber-800"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Filter toolbar ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <DebouncedSearchInput
          key={currentSearch}
          defaultValue={currentSearch}
          onSearch={handleSearch}
        />
        <FilterChip
          label="Project"
          value={currentProject}
          options={projectOptions}
          onChange={handleFilterChange('project')}
        />
        <FilterChip
          label="Band"
          value={currentBand}
          options={bandOptions}
          onChange={handleFilterChange('band')}
        />
        <FilterChip
          label="Source"
          value={currentSource}
          options={sourceOptions}
          onChange={handleFilterChange('source')}
        />
        {showOwnerFilter && (
          <FilterChip
            label="Owner"
            value={currentOwner}
            options={ownerOptions}
            onChange={handleFilterChange('owner')}
          />
        )}
        <FilterChip
          label="Activity"
          value={currentActivity}
          options={activityOptions}
          onChange={handleFilterChange('activity')}
        />
      </div>

      {/* ── Empty state ───────────────────────────────────── */}
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
          {/* ── Desktop: TanStack sortable data table ─────── */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="border-b border-stone-200"
                    >
                      {headerGroup.headers.map((header) => {
                        const isRightAligned =
                          header.id === 'intentScore' || header.id === 'lastActivityAt';
                        return (
                          <th
                            key={header.id}
                            className={cn(
                              'h-8 px-3 text-[10px] font-semibold uppercase tracking-widest text-stone-500 select-none',
                              isRightAligned ? 'text-right' : 'text-left',
                              header.column.getCanSort() &&
                                'cursor-pointer hover:text-stone-700',
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span
                              className={cn(
                                'inline-flex items-center',
                                isRightAligned && 'justify-end',
                              )}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {header.column.getCanSort() && (
                                <SortIndicator
                                  sorted={header.column.getIsSorted()}
                                />
                              )}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'h-[52px] border-b border-stone-200 border-l-4 transition-colors hover:bg-stone-100',
                        BAND_BORDER_COLORS[row.original.band as Band],
                        row.original.band === 'disqualified' && 'opacity-50',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-3',
                            (cell.column.id === 'intentScore' ||
                              cell.column.id === 'lastActivityAt') &&
                              'text-right',
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile: card view ─────────────────────────── */}
          <div className="flex flex-col gap-0 md:hidden">
            {table.getRowModel().rows.map((row) => (
              <Link
                key={row.id}
                href={`/leads/${row.original._id}`}
                className={cn(
                  'flex items-center justify-between border-b border-stone-200 border-l-4 px-3 py-2.5 transition-colors hover:bg-stone-100',
                  BAND_BORDER_COLORS[row.original.band as Band],
                  row.original.band === 'disqualified' && 'opacity-50',
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-stone-950">
                    {row.original.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <BandBadge band={row.original.band as Band} />
                    <span className="text-[11px] text-stone-500">
                      {row.original.projectName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <IntentScoreCell score={row.original.intentScore} />
                  <span className="text-[10px] tabular-nums text-stone-400">
                    {timeAgo(row.original.lastActivityAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── Pagination ────────────────────────────────────── */}
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
