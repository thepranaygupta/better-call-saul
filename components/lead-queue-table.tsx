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
  type RowSelectionState,
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
  UserRoundIcon,
  CheckIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { BulkAssignBar } from '@/components/bulk-assign-bar';
import { assignLeadToBda } from '@/app/(app)/queue/actions';
import type { BandCounts, QueueData, QueueLead, QueueBda } from '@/app/(app)/queue/actions';

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
        'font-mono text-[15px] font-bold tabular-nums',
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
// Band count summary strip -- instant workload read
// ---------------------------------------------------------------------------

const BAND_COUNT_CONFIG: { key: keyof BandCounts; label: string; dotColor: string; textColor: string }[] = [
  { key: 'call_now', label: 'Call Now', dotColor: 'bg-red-800', textColor: 'text-red-800' },
  { key: 'qualify', label: 'Qualify', dotColor: 'bg-amber-600', textColor: 'text-amber-600' },
  { key: 'nurture', label: 'Nurture', dotColor: 'bg-teal-700', textColor: 'text-teal-700' },
  { key: 'cold', label: 'Cold', dotColor: 'bg-stone-400', textColor: 'text-stone-400' },
  { key: 'disqualified', label: 'DQ', dotColor: 'bg-stone-300', textColor: 'text-stone-300' },
];

function BandCountStrip({
  counts,
  onBandClick,
  activeBand,
}: {
  counts: BandCounts;
  onBandClick: (band: string) => void;
  activeBand: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {BAND_COUNT_CONFIG.map(({ key, label, dotColor, textColor }) => {
        const count = counts[key];
        if (count === 0 && key === 'disqualified') return null;
        const isActive = activeBand === key;
        return (
          <button
            key={key}
            onClick={() => onBandClick(isActive ? 'all' : key)}
            className={cn(
              'flex items-center gap-1.5 text-[12px] font-medium tabular-nums transition-colors',
              isActive
                ? cn(textColor, 'underline underline-offset-2')
                : 'text-stone-500 hover:text-stone-700',
            )}
          >
            <span className={cn('inline-block size-2 rounded-full', dotColor)} />
            <span className="font-bold">{count}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
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
        type="text"
        placeholder="Search name, email, phone..."
        value={value}
        onChange={handleChange}
        className={cn(
          'h-7 w-full border border-stone-200 bg-white pl-8 pr-7 text-[11px] text-stone-950',
          'placeholder:text-stone-400 outline-none transition-colors',
          'focus:border-amber-700/40 focus:ring-1 focus:ring-amber-700/20',
          'sm:w-[280px]',
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
          'h-7 gap-1 border px-2.5 text-[11px] font-medium uppercase tracking-wide',
          '[&_svg]:size-3',
          isActive
            ? 'border-amber-700/30 bg-amber-50 text-amber-800 hover:bg-amber-100/60'
            : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700',
        )}
      >
        <span className="flex flex-1 text-left">{selectedLabel}</span>
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
// Row-level assign cell -- compact dropdown trigger for the Owner column
// ---------------------------------------------------------------------------

function RowAssignCell({
  leadId,
  currentBdaId,
  currentBdaName,
  bdas,
}: {
  leadId: string;
  currentBdaId: string | null;
  currentBdaName: string | null;
  bdas: QueueBda[];
}) {
  const [bdaId, setBdaId] = useState(currentBdaId);
  const [bdaName, setBdaName] = useState(currentBdaName);
  const [isPending, startTransition] = useTransition();

  const handleAssign = (newBdaId: string | null) => {
    const newName = newBdaId ? bdas.find((b) => b._id === newBdaId)?.name ?? null : null;
    setBdaId(newBdaId);
    setBdaName(newName);
    startTransition(async () => {
      try {
        const result = await assignLeadToBda({ leadId, bdaId: newBdaId });
        if (!result.success) {
          // Revert on failure
          setBdaId(currentBdaId);
          setBdaName(currentBdaName);
        }
      } catch {
        // Revert on failure
        setBdaId(currentBdaId);
        setBdaName(currentBdaName);
      }
    });
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'inline-flex items-center gap-1 px-1 py-0.5 text-[11px] transition-colors',
            'hover:text-amber-700 focus:outline-none',
            isPending && 'opacity-50',
            bdaName ? 'text-stone-600' : 'text-stone-400',
          )}
          disabled={isPending}
        >
          <UserRoundIcon className="size-3 shrink-0" />
          <span className="max-w-[80px] truncate">
            {bdaName ?? '--'}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          <DropdownMenuItem
            onClick={() => handleAssign(null)}
            className="text-xs text-stone-400"
          >
            {bdaId === null && <CheckIcon className="mr-1 size-3" />}
            Unassigned
          </DropdownMenuItem>
          {bdas.length > 0 && <DropdownMenuSeparator />}
          {bdas.map((bda) => (
            <DropdownMenuItem
              key={bda._id}
              onClick={() => handleAssign(bda._id)}
              className="text-xs"
            >
              {bdaId === bda._id && <CheckIcon className="mr-1 size-3" />}
              {bda.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TanStack column definitions -- dense, CRM-style
// ---------------------------------------------------------------------------

function createColumns(
  showOwner: boolean,
  canAssign: boolean,
  bdas: { _id: string; name: string }[],
): ColumnDef<QueueLead>[] {
  const cols: ColumnDef<QueueLead>[] = [];

  // Checkbox column for selection (admin/sales_lead only)
  if (canAssign) {
    cols.push({
      id: 'select',
      size: 36,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected();
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="size-3.5 accent-amber-700"
          aria-label="Select all leads"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="size-3.5 accent-amber-700"
          aria-label={`Select ${row.original.name}`}
        />
      ),
    });
  }

  cols.push(
    {
      accessorKey: 'name',
      header: 'Lead',
      enableSorting: true,
      size: 240,
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
      accessorKey: 'intentScore',
      header: 'Intent',
      enableSorting: true,
      size: 70,
      cell: ({ row }) => <IntentScoreCell score={row.original.intentScore} />,
    },
    {
      accessorKey: 'fitScore',
      header: 'Fit',
      enableSorting: true,
      size: 50,
      cell: ({ row }) => (
        <span className={cn('font-mono text-[12px] tabular-nums', intentScoreColor(row.original.fitScore))}>
          {String(row.original.fitScore).padStart(2, '0')}
        </span>
      ),
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
  );

  // Insert owner/assign column before Last Activity if admin/sales_lead
  if (showOwner) {
    cols.splice(cols.length - 1, 0, {
      accessorKey: 'assignedBdaName',
      header: 'Owner',
      enableSorting: true,
      size: 110,
      cell: ({ row }) =>
        canAssign ? (
          <RowAssignCell
            leadId={row.original._id}
            currentBdaId={row.original.assignedBdaId}
            currentBdaName={row.original.assignedBdaName}
            bdas={bdas}
          />
        ) : (
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
  const [isPending, startTransition] = useTransition();

  // URL-derived filter state
  const currentProject = searchParams.get('project') ?? 'all';
  const currentBand = searchParams.get('band') ?? 'all';
  const currentSource = searchParams.get('source') ?? 'all';
  const currentOwner = searchParams.get('owner') ?? 'all';
  const currentActivity = searchParams.get('activity') ?? 'all';
  const currentSearch = searchParams.get('search') ?? '';

  const showOwnerFilter =
    data.currentUserRole === 'admin' || data.currentUserRole === 'sales_lead';
  const canAssign =
    data.currentUserRole === 'admin' || data.currentUserRole === 'sales_lead';

  // TanStack table sorting (client-side within the current page)
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () => createColumns(showOwnerFilter, canAssign, data.bdas),
    [showOwnerFilter, canAssign, data.bdas],
  );

  const table = useReactTable({
    data: data.leads,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: canAssign ? setRowSelection : undefined,
    enableRowSelection: canAssign,
    getRowId: (row) => row._id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedLeadIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const clearSelection = useCallback(() => setRowSelection({}), []);

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
      {/* ── Loading bar ──────────────────────────────────── */}
      {isPending && (
        <div className="h-0.5 w-full overflow-hidden bg-stone-100">
          <div className="h-full w-1/3 animate-pulse bg-amber-600" style={{ animation: 'loading-slide 1s ease-in-out infinite' }} />
          <style>{`@keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
        </div>
      )}

      {/* ── Band count summary + lead count ──────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
        <BandCountStrip
          counts={data.bandCounts}
          onBandClick={handleFilterChange('band')}
          activeBand={currentBand}
        />
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

      {/* ── Filter toolbar ────────────────────────────────── */}
      <div className="flex flex-col gap-2 pb-1">
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
      </div>

      {/* ── Table content (dims during server transition) ── */}
      <div className={cn('transition-opacity duration-150', isPending && 'pointer-events-none opacity-40')}>

      {/* ── Empty state ───────────────────────────────────── */}
      {data.leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-stone-300 py-16">
          <p className="text-sm font-medium text-stone-950">
            {activeFilterCount > 0 ? 'No leads match these filters' : 'No leads in your queue'}
          </p>
          <p className="mt-1 max-w-sm text-center text-xs text-stone-500">
            {activeFilterCount > 0
              ? 'Try broadening your search or removing a filter to see more leads.'
              : 'Leads will appear once they are assigned to your projects. Contact your Sales Lead or Admin if you expect to see leads here.'}
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
                          header.id === 'intentScore' || header.id === 'fitScore' || header.id === 'lastActivityAt';
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
                        'h-[44px] border-b border-stone-100 border-l-4 transition-colors',
                        BAND_BORDER_COLORS[row.original.band as Band],
                        row.original.band === 'call_now'
                          ? 'bg-red-50/40 hover:bg-red-50/70'
                          : 'hover:bg-stone-100',
                        row.original.band === 'disqualified' && 'opacity-50',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-2',
                            (cell.column.id === 'intentScore' ||
                              cell.column.id === 'fitScore' ||
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
                  'flex items-center justify-between border-b border-stone-100 border-l-4 px-3 py-2 transition-colors',
                  BAND_BORDER_COLORS[row.original.band as Band],
                  row.original.band === 'call_now'
                    ? 'bg-red-50/40 hover:bg-red-50/70'
                    : 'hover:bg-stone-100',
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
        <div className={cn(
          'flex items-center justify-between border-t border-stone-200 pt-2',
          selectedLeadIds.length > 0 && 'pb-16',
        )}>
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

      </div>{/* end dimming wrapper */}

      {/* ── Bulk assign bar (fixed bottom, only when leads selected) ── */}
      {canAssign && selectedLeadIds.length > 0 && (
        <BulkAssignBar
          selectedCount={selectedLeadIds.length}
          selectedLeadIds={selectedLeadIds}
          bdas={data.bdas}
          onClearSelection={clearSelection}
          onAssigned={clearSelection}
        />
      )}
    </div>
  );
}
