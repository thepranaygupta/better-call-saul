'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { BandBadge, BAND_BORDER_COLORS, type Band } from '@/components/band-badge';
import { ScoreBadges } from '@/components/score-badges';
import { Button } from '@/components/ui/button';
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

interface LeadQueueTableProps {
  data: QueueData;
}

export function LeadQueueTable({ data }: LeadQueueTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentProject = searchParams.get('project') ?? 'all';

  const navigate = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v === 'all' || v === '1') {
          sp.delete(k);
        } else {
          sp.set(k, v);
        }
      }
      const qs = sp.toString();
      router.push(qs ? `/queue?${qs}` : '/queue');
    },
    [router, searchParams],
  );

  const handleProjectChange = (value: string | null) => {
    navigate({ project: value ?? 'all', page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    navigate({ page: String(newPage) });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            PROJECT
          </span>
          <Select value={currentProject} onValueChange={handleProjectChange}>
            <SelectTrigger size="sm" className="h-7 min-w-[140px] text-xs">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {data.projects.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs tabular-nums text-stone-500">
          {data.totalCount} lead{data.totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty state */}
      {data.leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-stone-300 bg-stone-50 py-16">
          <p className="text-sm font-medium text-stone-950">No leads assigned</p>
          <p className="mt-1 text-xs text-stone-500">
            {currentProject !== 'all'
              ? 'Try selecting a different project.'
              : 'Leads will appear here once they are assigned to your projects.'}
          </p>
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
