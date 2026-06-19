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
import { cn } from '@/lib/utils';
import { UserRoundIcon } from 'lucide-react';
import { assignLeadToBda } from '@/app/(app)/queue/actions';
import type { QueueBda } from '@/app/(app)/queue/actions';

interface LeadAssignDropdownProps {
  leadId: string;
  currentBdaId: string | null;
  currentBdaName: string | null;
  bdas: QueueBda[];
  /** Compact mode for table rows */
  compact?: boolean;
  onAssigned?: (bdaId: string | null, bdaName: string | null) => void;
}

export function LeadAssignDropdown({
  leadId,
  currentBdaId,
  currentBdaName,
  bdas,
  compact = false,
  onAssigned,
}: LeadAssignDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAssign = (value: string | null) => {
    if (value === null) return;
    setError(null);
    const bdaId = value === '__unassign__' ? null : value;
    const bdaName = bdaId ? bdas.find((b) => b._id === bdaId)?.name ?? null : null;

    startTransition(async () => {
      const result = await assignLeadToBda({ leadId, bdaId });
      if (result.success) {
        onAssigned?.(bdaId, bdaName);
      } else {
        setError(result.error);
      }
    });
  };

  const displayValue = currentBdaId ?? '__unassign__';

  return (
    <div className="relative">
      <Select
        value={displayValue}
        onValueChange={handleAssign as (value: string | null) => void}
        disabled={isPending}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            'gap-1 border text-left',
            compact
              ? 'h-6 min-w-[100px] max-w-[140px] px-1.5 text-[10px]'
              : 'h-7 min-w-[140px] px-2 text-[11px]',
            currentBdaId
              ? 'border-stone-200 bg-white text-stone-700'
              : 'border-dashed border-stone-300 bg-transparent text-stone-400',
            isPending && 'opacity-50',
            '[&_svg]:size-3',
          )}
          aria-label="Assign lead to BDA"
        >
          <UserRoundIcon className="shrink-0 text-stone-400" />
          <SelectValue>
            <span className="truncate">
              {currentBdaName ?? 'Unassigned'}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" sideOffset={4} alignItemWithTrigger={false}>
          <SelectItem
            value="__unassign__"
            className="text-xs text-stone-400"
          >
            Unassigned
          </SelectItem>
          {bdas.length > 0 && <SelectSeparator />}
          {bdas.map((bda) => (
            <SelectItem key={bda._id} value={bda._id} className="text-xs">
              {bda.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <span className="absolute -bottom-4 left-0 text-[9px] text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
