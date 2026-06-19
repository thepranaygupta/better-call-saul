import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLeadDetail } from './actions';
import { ScoreBreakdown } from '@/components/score-breakdown';
import { CallBriefPanel } from '@/components/call-brief-panel';
import { MessageDraftPanel } from '@/components/message-draft-panel';
import { BandBadge } from '@/components/band-badge';
import type { Band } from '@/components/band-badge';
import { RecentLeadTracker } from '@/components/recent-lead-tracker';
import { LeadDetailAssign } from '@/components/lead-detail-assign';
import { ChevronLeftIcon } from 'lucide-react';
import { isAIAvailable } from '@/lib/ai/client';
import LeadDetailLoading from './loading';

export const metadata = {
  title: 'Lead Detail — Saul',
};

// ---------------------------------------------------------------------------
// Lead header with key info
// ---------------------------------------------------------------------------

function LeadHeader({
  lead,
  assignSlot,
}: {
  lead: {
    name: string;
    email: string;
    phone: string;
    band: string;
    occupationType: string;
    jobTitle?: string;
    seniority?: string;
    city?: string;
    sourceChannel: string;
    isExistingCustomer: boolean;
    outcome: string;
    projectName: string;
    masterclassTitle: string;
    registeredAt: string;
  };
  assignSlot?: React.ReactNode;
}) {
  const outcomeColors: Record<string, string> = {
    enrolled: 'text-teal-700',
    not_enrolled: 'text-red-800',
    undecided: 'text-stone-500',
  };

  const formatOccupation = (occ: string) =>
    occ.replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());

  return (
    <div className="border border-stone-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: identity */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-stone-950">
              {lead.name}
            </h1>
            <BandBadge band={lead.band as Band} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone-500">
            <span>{lead.email}</span>
            <span className="text-stone-300">|</span>
            <span>{lead.phone}</span>
          </div>
          {assignSlot}
        </div>

        {/* Right: metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
              PROJECT
            </span>
            <p className="text-stone-700">{lead.projectName}</p>
          </div>
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
              MASTERCLASS
            </span>
            <p className="line-clamp-1 text-stone-700">{lead.masterclassTitle}</p>
          </div>
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
              PROFILE
            </span>
            <p className="text-stone-700">
              {formatOccupation(lead.occupationType)}
              {lead.seniority && lead.seniority !== 'unknown'
                ? ` / ${lead.seniority}`
                : ''}
              {lead.city ? ` / ${lead.city}` : ''}
            </p>
          </div>
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
              SOURCE
            </span>
            <p className="text-stone-700">
              {lead.sourceChannel.replace(/_/g, ' ')}
              {lead.isExistingCustomer ? ' (returning)' : ''}
            </p>
          </div>
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
              OUTCOME
            </span>
            <p className={outcomeColors[lead.outcome] ?? 'text-stone-500'}>
              {lead.outcome.replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead detail content (client wrapper for optimistic dispositions)
// ---------------------------------------------------------------------------

async function LeadDetailContent({ id }: { id: string }) {
  let data;
  try {
    data = await getLeadDetail(id);
  } catch {
    notFound();
  }

  const { lead, activities, signals, dispositions, snapshot, availableBdas, currentUserRole } = data;
  const aiReady = isAIAvailable();
  const canAssign = currentUserRole === 'admin' || currentUserRole === 'sales_lead';

  return (
    <>
      {/* Track this lead visit in localStorage for sidebar "Recent" */}
      <RecentLeadTracker leadId={id} leadName={lead.name} leadBand={lead.band} />

      {/* Lead header */}
      <LeadHeader
        lead={lead}
        assignSlot={
          canAssign ? (
            <div className="mt-1">
              <LeadDetailAssign
                leadId={id}
                initialBdaId={lead.assignedBdaId}
                initialBdaName={lead.assignedBdaName}
                bdas={availableBdas}
              />
            </div>
          ) : lead.assignedBdaName ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                ASSIGNED TO
              </span>
              <span className="text-[11px] text-stone-600">
                {lead.assignedBdaName}
              </span>
            </div>
          ) : null
        }
      />

      {/* Main content grid: 2 columns on desktop */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left column: score breakdown (most prominent) + AI panels */}
        <div className="space-y-4">
          <ScoreBreakdown
            fitScore={snapshot?.fitScore ?? lead.fitScore}
            intentScore={snapshot?.intentScore ?? lead.intentScore}
            band={snapshot?.band ?? lead.band}
            contributions={snapshot?.contributions ?? []}
          />

          <CallBriefPanel leadId={id} isAIAvailable={aiReady} />

          <MessageDraftPanel leadId={id} />
        </div>

        {/* Right column: disposition form + timeline */}
        <div className="space-y-4">
          <LeadDetailSidebar
            leadId={id}
            activities={activities}
            signals={signals}
            dispositions={dispositions}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Client sidebar wrapper for optimistic disposition updates
// ---------------------------------------------------------------------------

import { LeadDetailSidebarClient } from './sidebar-client';

function LeadDetailSidebar({
  leadId,
  activities,
  signals,
  dispositions,
}: {
  leadId: string;
  activities: Parameters<typeof LeadDetailSidebarClient>[0]['activities'];
  signals: Parameters<typeof LeadDetailSidebarClient>[0]['signals'];
  dispositions: Parameters<typeof LeadDetailSidebarClient>[0]['dispositions'];
}) {
  return (
    <LeadDetailSidebarClient
      leadId={leadId}
      activities={activities}
      signals={signals}
      dispositions={dispositions}
    />
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/queue"
        className="inline-flex items-center gap-1 text-[12px] text-stone-500 transition-colors hover:text-amber-700"
      >
        <ChevronLeftIcon className="size-3.5" />
        <span>Back to queue</span>
      </Link>

      <Suspense fallback={<LeadDetailLoading />}>
        <LeadDetailContent id={id} />
      </Suspense>
    </div>
  );
}
