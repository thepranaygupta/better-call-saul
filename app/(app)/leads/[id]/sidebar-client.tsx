'use client';

import { useState, useCallback } from 'react';
import { DispositionForm } from '@/components/disposition-form';
import { ActivityTimeline } from '@/components/activity-timeline';
import type {
  LeadDetailActivity,
  LeadDetailDisposition,
  LeadDetailSignal,
} from './actions';

interface LeadDetailSidebarClientProps {
  leadId: string;
  activities: LeadDetailActivity[];
  signals: LeadDetailSignal[];
  dispositions: LeadDetailDisposition[];
}

export function LeadDetailSidebarClient({
  leadId,
  activities,
  signals,
  dispositions: initialDispositions,
}: LeadDetailSidebarClientProps) {
  const [dispositions, setDispositions] =
    useState<LeadDetailDisposition[]>(initialDispositions);

  const handleDispositionLogged = useCallback(
    (d: LeadDetailDisposition) => {
      // Optimistic: prepend the new disposition to the list
      setDispositions((prev) => [d, ...prev]);
    },
    [],
  );

  return (
    <>
      <DispositionForm
        leadId={leadId}
        onDispositionLogged={handleDispositionLogged}
      />
      <ActivityTimeline
        activities={activities}
        dispositions={dispositions}
        signals={signals}
      />
    </>
  );
}
