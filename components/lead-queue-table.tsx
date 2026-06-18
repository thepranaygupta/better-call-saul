'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { BandBadge, BAND_BORDER_COLORS, type Band } from '@/components/band-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  PhoneIcon,
} from 'lucide-react';
import type { QueueData, QueueLead } from '@/app/(app)/queue/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string | null): string {
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

/** Stable date string for SSR (no relative time that drifts between server/client) */
function formatDateStable(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Renders relative time client-side only to avoid hydration mismatch */
function TimeAgo({ date, className }: { date: string | null; className?: string }) {
  const [display, setDisplay] = useState(() => formatDateStable(date));

  useEffect(() => {
    setDisplay(formatTimeAgo(date));
    if (!date) return;
    // Refresh every 60s so "Xm ago" stays current
    const interval = setInterval(() => setDisplay(formatTimeAgo(date)), 60_000);
    return () => clearInterval(interval);
  }, [date]);

  return <span className={className}>{display}</span>;
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

const OUTCOME_CONFIG: Record<string, { label: string; color: string }> = {
  enrolled: { label: 'Enrolled', color: 'text-teal-700' },
  not_enrolled: { label: 'Lost', color: 'text-stone-400' },
  undecided: { label: 'Open', color: 'text-amber-600' },
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
// Intent score cell -- monospace, prominent, color-coded
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
        'font-mono text-[13px] font-semibold tabular-nums',
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
// Debounced search -- uses key-reset pattern to sync with URL
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
        className={cn(
          'h-7 w-full border border-stone-200 bg-white pl-8 pr-7 text-[11px] text-stone-950',
          'placeholder:text-stone-400 outline-none transition-colors',
          'focus:border-amber-700/40 focus:ring-1 focus:ring-amber-700/20',
          'sm:w-[200px]',
        )}
      />
      {value.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
          aria-label="Clear search"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter pill -- uses shadcn Select (base-ui), styled as compact pill
// ---------------------------------------------------------------------------

interface FilterPillProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterPill({ label, value, options, onChange }: FilterPillProps) {
  const isActive = value !== 'all';
  const selectedLabel = isActive
    ? options.find((o) => o.value === value)?.label ?? label
    : label;

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? 'all')}>
      <SelectTrigger
        size="sm"
        className={cn(
          'h-7 gap-1 rounded-full border px-2.5 text-[11px] font-medium uppercase tracking-wide',
          '[&_svg]:size-3',
          isActive
            ? 'border-amber-700/30 bg-amber-50 text-amber-800 hover:bg-amber-100/60'
            : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700',
        )}
      >
        <SelectValue>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" sideOffset={4}>
        <SelectItem value="all" className="text-xs">
          All {label}s
        </SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// TanStack column definitions -- dense, CRM-style
// ---------------------------------------------------------------------------

function createColumns(showOwner: boolean): ColumnDef<QueueLead>[] {
  const cols: ColumnDef<QueueLead>[] = [
    {
      accessorKey: 'name',
      header: 'Lead',
      enableSorting: true,
      size: 200,
      cell: ({ row }) => (
        <Link
          href={`/leads/${row.original._id}`}
          className="group flex flex-col gap-0"
        >
          <span className="text-[13px] font-medium text-stone-950 group-hover:text-amber-700">
            {row.original.name}
          </span>
          <span className="text-[11px] leading-tight text-stone-400">
            {row.original.email}
          </span>
        </Link>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      enableSorting: false,
      size: 120,
      cell: ({ row }) => (
        <a
          href={`tel:${row.original.phone}`}
          className="inline-flex items-center gap-1 text-xs tabular-nums text-stone-600 hover:text-amber-700"
          onClick={(e) => e.stopPropagation()}
        >
          <PhoneIcon className="size-3 text-stone-400" />
          {row.original.phone}
        </a>
      ),
    },
    {
      accessorKey: 'intentScore',
      header: 'Intent',
      enableSorting: true,
      size: 60,
      cell: ({ row }) => <IntentScoreCell score={row.original.intentScore} />,
    },
    {
      accessorKey: 'band',
      header: 'Band',
      enableSorting: true,
      size: 100,
      sortingFn: (rowA, rowB) => {
        const a = BAND_ORDER[rowA.original.band] ?? 4;
        const b = BAND_ORDER[rowB.original.band] ?? 4;
        return a - b;
      },
      cell: ({ row }) => <BandBadge band={row.original.band as Band} />,
    },
    {
      accessorKey: 'projectName',
      header: 'Project',
      enableSorting: true,
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs text-stone-600">{row.original.projectName}</span>
      ),
    },
    {
      accessorKey: 'city',
      header: 'City',
      enableSorting: true,
      size: 100,
      cell: ({ row }) => (
        <span className="text-xs text-stone-500">
          {row.original.city ?? '--'}
        </span>
      ),
    },
    {
      accessorKey: 'sourceChannel',
      header: 'Source',
      enableSorting: true,
      size: 90,
      cell: ({ row }) => (
        <span className="text-xs text-stone-500">
          {SOURCE_LABELS[row.original.sourceChannel] ?? row.original.sourceChannel}
        </span>
      ),
    },
    {
      accessorKey: 'outcome',
      header: 'Outcome',
      enableSorting: true,
      size: 80,
      cell: ({ row }) => {
        const cfg = OUTCOME_CONFIG[row.original.outcome] ?? { label: 'Open', color: 'text-amber-600' };
        return (
          <span className={cn('text-xs font-medium', cfg.color)}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'lastActivityAt',
      header: 'Last Activity',
      enableSorting: true,
      size: 100,
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
        <TimeAgo
          date={row.original.lastActivityAt}
          className="text-xs tabular-nums text-stone-400"
        />
      ),
    },
  ];

  // Insert owner column before Last Activity if admin/sales_lead
  if (showOwner) {
    cols.splice(cols.length - 1, 0, {
      accessorKey: 'assignedBdaName',
      header: 'Owner',
      enableSorting: true,
      size: 110,
      cell: ({ row }) => (
        <span className="text-xs text-stone-500">
          {row.original.assignedBdaName ?? '--'}
        </span>
      ),
    });
  }

  return cols;
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

  const showOwnerFilter =
    data.currentUserRole === 'admin' || data.currentUserRole === 'sales_lead';

  // TanStack table sorting (client-side within the current page)
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => createColumns(showOwnerFilter), [showOwnerFilter]);

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

  // Build filter options -- names, not IDs
  const projectOptions = data.projects.map((p) => ({ value: p._id, label: p.name }));
  const bandOptions = Object.entries(BAND_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const sourceOptions = Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const ownerOptions = data.bdas.map((b) => ({ value: b._id, label: b.name }));
  const activityOptions = Object.entries(ACTIVITY_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  return (
    <div className="space-y-2">
      {/* ── Filter toolbar ────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-b border-stone-200 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <DebouncedSearchInput
            key={currentSearch}
            defaultValue={currentSearch}
            onSearch={handleSearch}
          />

          <div className="mx-0.5 hidden h-4 w-px bg-stone-200 sm:block" />

          <FilterPill
            label="Project"
            value={currentProject}
            options={projectOptions}
            onChange={handleFilterChange('project')}
          />
          <FilterPill
            label="Band"
            value={currentBand}
            options={bandOptions}
            onChange={handleFilterChange('band')}
          />
          <FilterPill
            label="Source"
            value={currentSource}
            options={sourceOptions}
            onChange={handleFilterChange('source')}
          />
          {showOwnerFilter && (
            <FilterPill
              label="Owner"
              value={currentOwner}
              options={ownerOptions}
              onChange={handleFilterChange('owner')}
            />
          )}
          <FilterPill
            label="Activity"
            value={currentActivity}
            options={activityOptions}
            onChange={handleFilterChange('activity')}
          />

          {activeFilterCount > 0 && (
            <>
              <div className="mx-0.5 hidden h-4 w-px bg-stone-200 sm:block" />
              <button
                onClick={clearAllFilters}
                className="flex h-7 items-center gap-1 px-2 text-[11px] font-medium text-amber-700 transition-colors hover:text-amber-800"
              >
                <XIcon className="size-3" />
                Clear
              </button>
            </>
          )}
        </div>

        {/* Status line */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tabular-nums text-stone-400">
            {data.totalCount} lead{data.totalCount !== 1 ? 's' : ''}
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700/70">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────── */}
      {data.leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-stone-300 py-20">
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
          {/* ── Desktop: TanStack dense data table ────────── */}
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
                              'h-8 px-2 text-[10px] font-semibold uppercase tracking-widest text-stone-500 select-none',
                              isRightAligned ? 'text-right' : 'text-left',
                              header.column.getCanSort() &&
                                'cursor-pointer hover:text-stone-700',
                            )}
                            style={{
                              width: header.getSize() !== 150 ? header.getSize() : undefined,
                            }}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span
                              className={cn(
                                'inline-flex items-center whitespace-nowrap',
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
                        'h-[44px] border-b border-stone-100 border-l-4 transition-colors hover:bg-stone-100',
                        BAND_BORDER_COLORS[row.original.band as Band],
                        row.original.band === 'disqualified' && 'opacity-50',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-2',
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
                  'flex items-center justify-between border-b border-stone-100 border-l-4 px-3 py-2 transition-colors hover:bg-stone-100',
                  BAND_BORDER_COLORS[row.original.band as Band],
                  row.original.band === 'disqualified' && 'opacity-50',
                )}
              >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="truncate text-[13px] font-medium text-stone-950">
                    {row.original.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <BandBadge band={row.original.band as Band} />
                    <span className="text-[11px] text-stone-500">
                      {row.original.projectName}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-400">
                    {row.original.phone}
                    {row.original.city ? ` / ${row.original.city}` : ''}
                  </span>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-0.5 pl-3">
                  <IntentScoreCell score={row.original.intentScore} />
                  <TimeAgo
                    date={row.original.lastActivityAt}
                    className="text-[10px] tabular-nums text-stone-400"
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      OUTCOME_CONFIG[row.original.outcome]?.color ?? 'text-stone-400',
                    )}
                  >
                    {OUTCOME_CONFIG[row.original.outcome]?.label ?? 'Open'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── Pagination ────────────────────────────────────── */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 pt-2">
          <span className="text-[11px] tabular-nums text-stone-400">
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
