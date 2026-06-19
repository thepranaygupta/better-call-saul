'use client';

import { useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { bulkAssignLeads } from '@/app/(app)/queue/actions';
import type { QueueBda } from '@/app/(app)/queue/actions';

interface BulkAssignBarProps {
  selectedCount: number;
  selectedLeadIds: string[];
  bdas: QueueBda[];
  onClearSelection: () => void;
  onAssigned: () => void;
}

export function BulkAssignBar({
  selectedCount,
  selectedLeadIds,
  bdas,
  onClearSelection,
  onAssigned,
}: BulkAssignBarProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedBda, setSelectedBda] = useState<string>('__select__');
  const [error, setError] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const handleAssign = () => {
    if (selectedBda === '__select__') return;
    setError(null);

    const bdaId = selectedBda === '__unassign__' ? null : selectedBda;

    startTransition(async () => {
      try {
        await bulkAssignLeads({ leadIds: selectedLeadIds, bdaId });
        setSelectedBda('__select__');
        onAssigned();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk assignment failed');
      }
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-300 bg-stone-100 px-4 py-2.5 shadow-[0_-4px_16px_rgba(28,25,23,0.08)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: selection count + clear */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClearSelection}
            className="flex size-5 items-center justify-center text-stone-400 transition-colors hover:text-stone-700"
            aria-label="Clear selection"
          >
            <XIcon className="size-3.5" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-950">
            {selectedCount} LEAD{selectedCount !== 1 ? 'S' : ''} SELECTED
          </span>
        </div>

        {/* Right: BDA picker + assign button */}
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] text-red-800">{error}</span>
          )}

          <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-400 sm:inline">
            ASSIGN TO
          </span>

          <Select
            value={selectedBda}
            onValueChange={(v: string | null) => { if (v !== null) setSelectedBda(v); }}
            disabled={isPending}
          >
            <SelectTrigger
              size="sm"
              className={cn(
                'h-7 min-w-[130px] border-stone-300 bg-white px-2 text-[11px] text-stone-700',
                'hover:border-stone-400',
                isPending && 'opacity-50',
              )}
            >
              <SelectValue>
                {selectedBda === '__select__'
                  ? 'Select BDA...'
                  : selectedBda === '__unassign__'
                    ? 'Unassign'
                    : bdas.find((b) => b._id === selectedBda)?.name ?? 'Select...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" sideOffset={4} alignItemWithTrigger={false}>
              <SelectItem value="__unassign__" className="text-xs text-stone-400">
                Unassign
              </SelectItem>
              {bdas.length > 0 && <SelectSeparator />}
              {bdas.map((bda) => (
                <SelectItem key={bda._id} value={bda._id} className="text-xs">
                  {bda.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={handleAssign}
            disabled={isPending || selectedBda === '__select__'}
            className={cn(
              'h-7 bg-amber-700 px-3 text-[11px] font-semibold uppercase tracking-widest text-white',
              'hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400',
            )}
          >
            {isPending ? 'ASSIGNING...' : 'ASSIGN'}
          </Button>
        </div>
      </div>
    </div>
  );
}
