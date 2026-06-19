'use client';

import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  updateScoringConfig,
  rescoreAllLeads,
} from '@/app/(app)/admin/actions';
import type { ScoringConfigData } from '@/app/(app)/admin/actions';
import { DEFAULT_SCORING_CONFIG } from '@/lib/scoring';
import {
  SaveIcon,
  RefreshCwIcon,
  HistoryIcon,
  InfoIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Weight tooltip descriptions
// ---------------------------------------------------------------------------

const FIT_WEIGHT_TOOLTIPS: Record<string, string> = {
  working_professional: 'Points awarded when the lead is a working professional (target audience)',
  student: 'Points for student leads (typically lower fit for professional courses)',
  other: 'Points for leads with "other" occupation type',
  senior: 'Points for senior-level seniority',
  mid: 'Points for mid-level seniority',
  junior: 'Points for junior-level seniority',
  unknown: 'Points when seniority is not specified',
  referral: 'Points for leads from referral channel (highest quality)',
  email: 'Points for leads from email campaigns',
  organic: 'Points for leads from organic search/discovery',
  paid_search: 'Points for leads from paid search ads',
  paid_social: 'Points for leads from paid social media',
  source_other: 'Points for leads from unspecified source channels',
  existing_customer: 'Points for leads who are existing customers (upsell potential)',
};

const INTENT_WEIGHT_TOOLTIPS: Record<string, string> = {
  attended_live: 'Points for attending the live masterclass (strong engagement signal)',
  watched_replay: 'Points for watching the replay (moderate engagement)',
  clicked_offer: 'Points for clicking the course offer (strong purchase intent)',
  watch_percentage: 'Base points scaled by watch % (boosted 1.5x if past pitch start)',
  chat_message: 'Points for sending a chat message during the session',
  question_asked: 'Points for asking a question (active engagement)',
  poll_response: 'Points for responding to a poll',
  reregistered: 'Points for re-registering (renewed interest)',
  no_show: 'Negative points for not attending (reduces intent score)',
  asked_emi: 'Points when LLM detects EMI/payment plan inquiry (strong buying signal)',
  asked_price: 'Points when LLM detects price inquiry',
  asked_job_outcome: 'Points when LLM detects career outcome questions',
  expressed_career_switch: 'Points for expressing interest in career change',
  high_enthusiasm: 'Points for highly enthusiastic messages',
  price_objection: 'Mild positive: engaged enough to object on price',
  competitor_mention: 'Points for mentioning competitors (comparison shopping)',
  not_interested: 'Strong negative: explicit disinterest detected by LLM',
  asked_time_commitment: 'Points for asking about time commitment (practical interest)',
  asked_refund_guarantee: 'Points for asking about refunds/guarantees (purchase consideration)',
};

const DISQUALIFIER_LABELS: Record<string, string> = {
  student_email_domain: 'Student email domain (.edu, .ac.in)',
  unsubscribed: 'Unsubscribed from communications',
  not_interested: 'Explicitly not interested (LLM-detected)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScoringConfigEditorProps {
  initialConfig: ScoringConfigData | null;
  configHistory: ScoringConfigData[];
}

export function ScoringConfigEditor({
  initialConfig,
  configHistory,
}: ScoringConfigEditorProps) {
  const defaults = DEFAULT_SCORING_CONFIG;

  // Form state — start from saved config or defaults
  const [fitWeights, setFitWeights] = useState<Record<string, number>>(
    initialConfig?.fitWeights ?? { ...defaults.fitWeights },
  );
  const [intentWeights, setIntentWeights] = useState<Record<string, number>>(
    initialConfig?.intentWeights ?? { ...defaults.intentWeights },
  );
  const [decayHalfLifeDays, setDecayHalfLifeDays] = useState<number>(
    initialConfig?.decayHalfLifeDays ?? defaults.decayHalfLifeDays,
  );
  const [disqualifiers, setDisqualifiers] = useState<string[]>(
    initialConfig?.disqualifiers ?? [...defaults.disqualifiers],
  );
  const [thresholds, setThresholds] = useState<{ hot: number; warm: number }>(
    initialConfig?.thresholds ?? { ...defaults.thresholds },
  );
  const [currentVersion, setCurrentVersion] = useState<number>(
    initialConfig?.version ?? 0,
  );

  // UI state
  const [isSaving, startSaveTransition] = useTransition();
  const [isRescoring, startRescoreTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [rescoreMessage, setRescoreMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [rescoreDialogOpen, setRescoreDialogOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [fitExpanded, setFitExpanded] = useState(true);
  const [intentExpanded, setIntentExpanded] = useState(true);

  // Handlers
  const handleFitWeightChange = useCallback(
    (key: string, value: string) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setFitWeights((prev) => ({ ...prev, [key]: num }));
      }
    },
    [],
  );

  const handleIntentWeightChange = useCallback(
    (key: string, value: string) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setIntentWeights((prev) => ({ ...prev, [key]: num }));
      }
    },
    [],
  );

  const handleDisqualifierToggle = useCallback(
    (key: string) => {
      setDisqualifiers((prev) =>
        prev.includes(key)
          ? prev.filter((d) => d !== key)
          : [...prev, key],
      );
    },
    [],
  );

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    startSaveTransition(async () => {
      try {
        const result = await updateScoringConfig({
          fitWeights,
          intentWeights,
          decayHalfLifeDays,
          disqualifiers,
          thresholds,
        });
        setCurrentVersion(result.version);
        setSaveMessage({
          type: 'success',
          text: `Saved as version ${result.version}`,
        });
      } catch (err) {
        setSaveMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to save',
        });
      }
    });
  }, [fitWeights, intentWeights, decayHalfLifeDays, disqualifiers, thresholds]);

  const handleRescore = useCallback(() => {
    setRescoreMessage(null);
    setRescoreDialogOpen(false);
    startRescoreTransition(async () => {
      try {
        const result = await rescoreAllLeads();
        setRescoreMessage({
          type: 'success',
          text: `Re-scored ${result.rescored} leads`,
        });
      } catch (err) {
        setRescoreMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to re-score',
        });
      }
    });
  }, []);

  const handleResetToDefaults = useCallback(() => {
    setFitWeights({ ...defaults.fitWeights });
    setIntentWeights({ ...defaults.intentWeights });
    setDecayHalfLifeDays(defaults.decayHalfLifeDays);
    setDisqualifiers([...defaults.disqualifiers]);
    setThresholds({ ...defaults.thresholds });
  }, [defaults]);

  return (
    <div className="space-y-6">
      {/* Header with version + actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold text-stone-950">
            Scoring Weights
          </h2>
          <Badge variant="secondary" className="font-mono text-xs">
            v{currentVersion}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefaults}
            disabled={isSaving}
          >
            Reset to defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-amber-700 text-white hover:bg-amber-800"
          >
            {isSaving ? (
              <RefreshCwIcon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            {isSaving ? 'Saving...' : 'Save & Bump Version'}
          </Button>
          <Dialog
            open={rescoreDialogOpen}
            onOpenChange={setRescoreDialogOpen}
          >
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRescoring || currentVersion === 0}
                />
              }
            >
              {isRescoring ? (
                <RefreshCwIcon className="size-3.5 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-3.5" />
              )}
              {isRescoring ? 'Re-scoring...' : 'Re-score All Leads'}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Re-score all leads?</DialogTitle>
                <DialogDescription>
                  This will re-calculate fit and intent scores for every lead
                  using the current scoring configuration (v{currentVersion}).
                  This operation may take a moment for large datasets.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRescoreDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRescore}
                  className="bg-amber-700 text-white hover:bg-amber-800"
                >
                  Confirm Re-score
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status messages */}
      {saveMessage && (
        <StatusMessage
          type={saveMessage.type}
          text={saveMessage.text}
          onDismiss={() => setSaveMessage(null)}
        />
      )}
      {rescoreMessage && (
        <StatusMessage
          type={rescoreMessage.type}
          text={rescoreMessage.text}
          onDismiss={() => setRescoreMessage(null)}
        />
      )}

      {/* Fit Weights */}
      <WeightSection
        title="FIT WEIGHTS"
        subtitle="Stable lead attributes (no time decay)"
        expanded={fitExpanded}
        onToggle={() => setFitExpanded(!fitExpanded)}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(defaults.fitWeights).map((key) => (
            <WeightInput
              key={key}
              label={formatWeightKey(key)}
              tooltip={FIT_WEIGHT_TOOLTIPS[key]}
              value={fitWeights[key] ?? 0}
              onChange={(val) => handleFitWeightChange(key, val)}
            />
          ))}
        </div>
      </WeightSection>

      {/* Intent Weights */}
      <WeightSection
        title="INTENT WEIGHTS"
        subtitle="Behavioural activities + LLM-extracted signals (with time decay)"
        expanded={intentExpanded}
        onToggle={() => setIntentExpanded(!intentExpanded)}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(defaults.intentWeights).map((key) => (
            <WeightInput
              key={key}
              label={formatWeightKey(key)}
              tooltip={INTENT_WEIGHT_TOOLTIPS[key]}
              value={intentWeights[key] ?? 0}
              onChange={(val) => handleIntentWeightChange(key, val)}
              isNegative={(intentWeights[key] ?? 0) < 0}
            />
          ))}
        </div>
      </WeightSection>

      {/* Decay + Thresholds + Disqualifiers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Decay */}
        <div className="border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-500">
            Time Decay
          </h3>
          <div className="space-y-2">
            <Label htmlFor="decay-half-life" className="text-[13px] text-stone-700">
              Half-life (days)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="decay-half-life"
                type="number"
                min={1}
                max={365}
                value={decayHalfLifeDays}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n) && n >= 1 && n <= 365) setDecayHalfLifeDays(n);
                }}
                className="w-20 font-mono"
              />
              <span className="text-xs text-stone-500">
                Signals from {decayHalfLifeDays} days ago are worth 50%
              </span>
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-500">
            Band Thresholds
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="threshold-hot" className="text-[13px] text-stone-700">
                Hot threshold
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold-hot"
                  type="number"
                  min={0}
                  max={100}
                  value={thresholds.hot}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 0 && n <= 100)
                      setThresholds((prev) => ({ ...prev, hot: n }));
                  }}
                  className="w-20 font-mono"
                />
                <span className="text-xs text-stone-500">
                  fit + intent above this = call_now
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="threshold-warm" className="text-[13px] text-stone-700">
                Warm threshold
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold-warm"
                  type="number"
                  min={0}
                  max={100}
                  value={thresholds.warm}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 0 && n <= 100)
                      setThresholds((prev) => ({ ...prev, warm: n }));
                  }}
                  className="w-20 font-mono"
                />
                <span className="text-xs text-stone-500">
                  either axis above this = qualify/nurture
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Disqualifiers */}
        <div className="border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-500">
            Disqualifiers
          </h3>
          <p className="mb-3 text-xs text-stone-500">
            If any checked condition is true, the lead is marked &quot;disqualified&quot;
            regardless of scores.
          </p>
          <div className="space-y-2">
            {Object.entries(DISQUALIFIER_LABELS).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-[13px] text-stone-700"
              >
                <input
                  type="checkbox"
                  checked={disqualifiers.includes(key)}
                  onChange={() => handleDisqualifierToggle(key)}
                  className="size-4 rounded border-stone-300 text-amber-700 accent-amber-700"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Version History */}
      <div className="border border-stone-200 bg-white">
        <button
          type="button"
          onClick={() => setHistoryExpanded(!historyExpanded)}
          aria-expanded={historyExpanded}
          className="flex w-full items-center gap-2 p-4 text-left hover:bg-stone-50"
        >
          {historyExpanded ? (
            <ChevronDownIcon className="size-4 text-stone-500" aria-hidden="true" />
          ) : (
            <ChevronRightIcon className="size-4 text-stone-500" aria-hidden="true" />
          )}
          <HistoryIcon className="size-4 text-stone-500" aria-hidden="true" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-stone-500">
            Version History
          </h3>
          <Badge variant="secondary" className="ml-auto text-xs">
            {configHistory.length} version{configHistory.length !== 1 ? 's' : ''}
          </Badge>
        </button>
        {historyExpanded && (
          <div className="border-t border-stone-200">
            {configHistory.length === 0 ? (
              <p className="p-4 text-center text-sm text-stone-500">
                No versions saved yet. Save to create the first version.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {configHistory.map((cfg) => (
                  <div
                    key={cfg._id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          cfg.version === currentVersion
                            ? 'default'
                            : 'secondary'
                        }
                        className="font-mono text-xs"
                      >
                        v{cfg.version}
                      </Badge>
                      <div className="text-sm">
                        <span className="text-stone-700">
                          {cfg.version === currentVersion && (
                            <span className="mr-1 text-xs font-medium text-amber-700">
                              current
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-stone-500">
                          Hot: {cfg.thresholds.hot}, Warm:{' '}
                          {cfg.thresholds.warm}, Decay:{' '}
                          {cfg.decayHalfLifeDays}d
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-stone-400">
                      {formatDate(cfg.updatedAt ?? cfg.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WeightSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 p-4 text-left hover:bg-stone-50"
      >
        {expanded ? (
          <ChevronDownIcon className="size-4 text-stone-500" aria-hidden="true" />
        ) : (
          <ChevronRightIcon className="size-4 text-stone-500" aria-hidden="true" />
        )}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-widest text-stone-500">
            {title}
          </h3>
          <p className="text-xs text-stone-400">{subtitle}</p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-stone-200 p-4">{children}</div>
      )}
    </div>
  );
}

function WeightInput({
  label,
  tooltip,
  value,
  onChange,
  isNegative,
}: {
  label: string;
  tooltip?: string;
  value: number;
  onChange: (value: string) => void;
  isNegative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="group relative flex items-center gap-1.5">
        <Label className="text-[13px] text-stone-700">{label}</Label>
        {tooltip && (
          <span className="relative">
            <InfoIcon className="size-3 cursor-help text-stone-400" aria-hidden="true" />
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md bg-stone-900 px-2.5 py-1.5 text-xs text-stone-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Weight for ${label}`}
        className={`w-20 text-right font-mono text-sm ${
          isNegative
            ? 'border-red-200 text-red-700'
            : ''
        }`}
      />
    </div>
  );
}

function StatusMessage({
  type,
  text,
  onDismiss,
}: {
  type: 'success' | 'error';
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 border px-3 py-2 text-sm ${
        type === 'success'
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {type === 'success' ? (
        <CheckCircleIcon className="size-4" />
      ) : (
        <AlertTriangleIcon className="size-4" />
      )}
      <span className="flex-1">{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="text-xs opacity-50 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeightKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
