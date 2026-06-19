'use client';

import { useState } from 'react';
import { LeadAssignDropdown } from '@/components/lead-assign-dropdown';
import type { QueueBda } from '@/app/(app)/queue/actions';

interface LeadDetailAssignProps {
  leadId: string;
  initialBdaId: string | null;
  initialBdaName: string | null;
  bdas: QueueBda[];
}

export function LeadDetailAssign({
  leadId,
  initialBdaId,
  initialBdaName,
  bdas,
}: LeadDetailAssignProps) {
  const [currentBdaId, setCurrentBdaId] = useState(initialBdaId);
  const [currentBdaName, setCurrentBdaName] = useState(initialBdaName);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
        ASSIGNED TO
      </span>
      <LeadAssignDropdown
        leadId={leadId}
        currentBdaId={currentBdaId}
        currentBdaName={currentBdaName}
        bdas={bdas}
        onAssigned={(bdaId, bdaName) => {
          setCurrentBdaId(bdaId);
          setCurrentBdaName(bdaName);
        }}
      />
    </div>
  );
}
