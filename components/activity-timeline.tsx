'use client';

import { cn } from '@/lib/utils';
import type {
  LeadDetailActivity,
  LeadDetailDisposition,
  LeadDetailSignal,
} from '@/app/(app)/leads/[id]/actions';

// ---------------------------------------------------------------------------
// Activity type display config
// ---------------------------------------------------------------------------

const ACTIVITY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  registered: { label: 'Registered', color: 'bg-stone-400' },
  attended_live: { label: 'Attended live', color: 'bg-teal-700' },
  watched_replay: { label: 'Watched replay', color: 'bg-teal-600' },
  no_show: { label: 'No show', color: 'bg-stone-300' },
  watch_percentage: { label: 'Watch %', color: 'bg-amber-600' },
  chat_message: { label: 'Chat message', color: 'bg-amber-500' },
  question_asked: { label: 'Question asked', color: 'bg-amber-700' },
  poll_response: { label: 'Poll response', color: 'bg-stone-500' },
  clicked_offer: { label: 'Clicked offer', color: 'bg-red-800' },
  reregistered: { label: 'Re-registered', color: 'bg-teal-500' },
  unsubscribed: { label: 'Unsubscribed', color: 'bg-stone-300' },
};

const DISPOSITION_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  connected: { label: 'Connected', color: 'bg-teal-700' },
  not_connected: { label: 'Not connected', color: 'bg-stone-400' },
  callback_scheduled: { label: 'Callback scheduled', color: 'bg-amber-600' },
  not_interested: { label: 'Not interested', color: 'bg-red-800' },
  enrolled: { label: 'Enrolled', color: 'bg-teal-700' },
  wrong_number: { label: 'Wrong number', color: 'bg-stone-300' },
};

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Timeline entry types
// ---------------------------------------------------------------------------

type TimelineEntry =
  | { kind: 'activity'; data: LeadDetailActivity; at: Date }
  | { kind: 'disposition'; data: LeadDetailDisposition; at: Date }
  | { kind: 'signal'; data: LeadDetailSignal; at: Date };

// ---------------------------------------------------------------------------
// ActivityTimeline component
// ---------------------------------------------------------------------------

interface ActivityTimelineProps {
  activities: LeadDetailActivity[];
  dispositions: LeadDetailDisposition[];
  signals: LeadDetailSignal[];
}

export function ActivityTimeline({
  activities,
  dispositions,
  signals,
}: ActivityTimelineProps) {
  // Merge all entries into a single chronological list (newest first)
  const entries: TimelineEntry[] = [
    ...activities.map((a) => ({
      kind: 'activity' as const,
      data: a,
      at: new Date(a.occurredAt),
    })),
    ...dispositions.map((d) => ({
      kind: 'disposition' as const,
      data: d,
      at: new Date(d.createdAt),
    })),
    ...signals.map((s) => ({
      kind: 'signal' as const,
      data: s,
      at: new Date(s.extractedAt),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          ACTIVITY TIMELINE
        </span>
        <span className="ml-2 font-mono text-[10px] text-stone-400">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-stone-400">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {entries.map((entry, i) => (
            <TimelineRow key={`${entry.kind}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineRow — renders one activity, disposition, or signal
// ---------------------------------------------------------------------------

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === 'activity') {
    const a = entry.data;
    const config = ACTIVITY_CONFIG[a.type] ?? {
      label: a.type,
      color: 'bg-stone-400',
    };

    return (
      <div className="flex items-start gap-3 px-4 py-2.5">
        {/* Dot */}
        <div className="mt-1.5 flex shrink-0 items-center">
          <div className={cn('size-2 rounded-full', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-stone-950">
              {config.label}
            </span>
            {a.type === 'watch_percentage' && a.numericValue != null && (
              <span className="font-mono text-[11px] text-amber-700">
                {a.numericValue}%
              </span>
            )}
          </div>
          {a.text && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">
              {a.text}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <span className="shrink-0 text-[10px] tabular-nums text-stone-400">
          {formatTimestamp(a.occurredAt)}
        </span>
      </div>
    );
  }

  if (entry.kind === 'disposition') {
    const d = entry.data;
    const config = DISPOSITION_CONFIG[d.outcome] ?? {
      label: d.outcome,
      color: 'bg-stone-400',
    };

    return (
      <div className="flex items-start gap-3 bg-stone-50/50 px-4 py-2.5">
        {/* Dot — square for dispositions to distinguish from activities */}
        <div className="mt-1.5 flex shrink-0 items-center">
          <div className={cn('size-2', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-stone-950">
              {config.label}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
              CALL
            </span>
          </div>
          {d.notes && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">
              {d.notes}
            </p>
          )}
          {d.nextActionAt && (
            <p className="mt-0.5 text-[10px] text-amber-700">
              Callback: {new Date(d.nextActionAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <span className="shrink-0 text-[10px] tabular-nums text-stone-400">
          {formatTimestamp(d.createdAt)}
        </span>
      </div>
    );
  }

  // Signal (extracted by LLM)
  const s = entry.data as LeadDetailSignal;
  const polarityColor =
    s.polarity === 'positive'
      ? 'text-teal-700'
      : s.polarity === 'negative'
        ? 'text-red-800'
        : 'text-stone-500';

  const displayType = s.signalType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      {/* Dot — diamond shape for signals */}
      <div className="mt-1.5 flex shrink-0 items-center">
        <div className="size-2 rotate-45 bg-amber-600" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-[12px] font-medium', polarityColor)}>
            {displayType}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
            AI SIGNAL
          </span>
          <span className="font-mono text-[10px] text-stone-400">
            {Math.round(s.confidence * 100)}%
          </span>
        </div>
        {s.evidenceQuote && (
          <p className="mt-0.5 line-clamp-2 border-l-2 border-stone-200 pl-2 text-[11px] italic text-stone-500">
            &ldquo;{s.evidenceQuote}&rdquo;
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-[10px] tabular-nums text-stone-400">
        {formatTimestamp(s.extractedAt)}
      </span>
    </div>
  );
}
