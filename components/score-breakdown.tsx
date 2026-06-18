'use client';

import { cn } from '@/lib/utils';
import type { Contribution } from '@/lib/scoring';
import type { Band } from '@/components/band-badge';
import { BandBadge } from '@/components/band-badge';

// ---------------------------------------------------------------------------
// Band colors for SVG quadrant tinting
// ---------------------------------------------------------------------------

const BAND_FILL: Record<string, string> = {
  call_now: 'rgba(153, 27, 27, 0.08)',    // red-800
  qualify: 'rgba(217, 119, 6, 0.08)',      // amber-600
  nurture: 'rgba(15, 118, 110, 0.08)',     // teal-700
  cold: 'rgba(168, 162, 158, 0.06)',       // stone-400
};

const DOT_COLOR: Record<string, string> = {
  call_now: '#991B1B',
  qualify: '#D97706',
  nurture: '#0F766E',
  cold: '#A8A29E',
  disqualified: '#D6D3D1',
};

// ---------------------------------------------------------------------------
// QuadrantDot — 120x120 SVG scatter-plot showing where this lead sits
// ---------------------------------------------------------------------------

function QuadrantDot({
  fitScore,
  intentScore,
  band,
}: {
  fitScore: number;
  intentScore: number;
  band: string;
}) {
  // Map scores (0-100) to SVG coordinates.
  // X = fit (0 left, 100 right). Y = intent (0 bottom, 100 top — invert for SVG).
  const size = 120;
  const pad = 12;
  const inner = size - pad * 2;
  const mid = size / 2;

  const x = pad + (fitScore / 100) * inner;
  const y = pad + ((100 - intentScore) / 100) * inner;

  const dotFill = DOT_COLOR[band] ?? DOT_COLOR.cold;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-label={`Quadrant chart: fit ${fitScore}, intent ${intentScore}, band ${band}`}
      role="img"
    >
      {/* Quadrant backgrounds */}
      {/* Top-left: nurture (high intent, low fit) */}
      <rect x={pad} y={pad} width={inner / 2} height={inner / 2} fill={BAND_FILL.nurture} />
      {/* Top-right: call_now (high fit, high intent) */}
      <rect x={mid} y={pad} width={inner / 2} height={inner / 2} fill={BAND_FILL.call_now} />
      {/* Bottom-left: cold (low fit, low intent) */}
      <rect x={pad} y={mid} width={inner / 2} height={inner / 2} fill={BAND_FILL.cold} />
      {/* Bottom-right: qualify (high fit, low intent) */}
      <rect x={mid} y={mid} width={inner / 2} height={inner / 2} fill={BAND_FILL.qualify} />

      {/* Grid lines — amber tint */}
      <line x1={mid} y1={pad} x2={mid} y2={size - pad} stroke="#D97706" strokeWidth={0.5} strokeOpacity={0.3} />
      <line x1={pad} y1={mid} x2={size - pad} y2={mid} stroke="#D97706" strokeWidth={0.5} strokeOpacity={0.3} />

      {/* Outer border */}
      <rect x={pad} y={pad} width={inner} height={inner} fill="none" stroke="#E7E5E4" strokeWidth={1} />

      {/* Axis labels — tiny uppercase */}
      <text x={size / 2} y={size - 1} textAnchor="middle" fontSize={7} fill="#78716C" fontFamily="system-ui" letterSpacing="0.08em">
        FIT
      </text>
      <text x={2} y={size / 2} textAnchor="middle" fontSize={7} fill="#78716C" fontFamily="system-ui" letterSpacing="0.08em" transform={`rotate(-90, 2, ${size / 2})`}>
        INTENT
      </text>

      {/* Lead dot with pulse ring */}
      <circle cx={x} cy={y} r={8} fill={dotFill} fillOpacity={0.15} />
      <circle cx={x} cy={y} r={4.5} fill={dotFill} stroke="white" strokeWidth={1.5} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Score bar — horizontal fill bar with monospace value
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
        {label}
      </span>
      <div className="relative h-2 flex-1 bg-stone-100">
        <div
          className={cn('absolute inset-y-0 left-0', color)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs font-medium text-stone-950">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contribution row — signal name, category tag, points
// ---------------------------------------------------------------------------

function ContributionRow({ c }: { c: Contribution }) {
  const categoryColor: Record<string, string> = {
    fit: 'text-teal-700 bg-teal-700/8',
    intent: 'text-amber-700 bg-amber-700/8',
    negative: 'text-red-800 bg-red-800/8',
  };

  const pointsColor =
    c.points > 0
      ? 'text-teal-700'
      : c.points < 0
        ? 'text-red-800'
        : 'text-stone-400';

  // Format the signal name for display: "occupation:working_professional" → "Working professional"
  const displayName = c.signal
    .replace(/^(activity|signal|occupation|seniority|source):/, '')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase());

  return (
    <div className="flex items-center gap-2 py-1 text-[12px]">
      <span className="flex-1 text-stone-950">{displayName}</span>
      <span
        className={cn(
          'shrink-0 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-widest',
          categoryColor[c.category] ?? 'text-stone-500 bg-stone-100',
        )}
      >
        {c.category}
      </span>
      <span className={cn('w-12 text-right font-mono text-xs font-medium', pointsColor)}>
        {c.points > 0 ? '+' : ''}{c.points}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoreBreakdown — the "why this score" panel
// ---------------------------------------------------------------------------

interface ScoreBreakdownProps {
  fitScore: number;
  intentScore: number;
  band: string;
  contributions: Contribution[];
}

export function ScoreBreakdown({
  fitScore,
  intentScore,
  band,
  contributions,
}: ScoreBreakdownProps) {
  // Sort contributions: negatives first (disqualifiers), then by absolute points desc
  const sorted = [...contributions].sort((a, b) => {
    if (a.category === 'negative' && b.category !== 'negative') return -1;
    if (b.category === 'negative' && a.category !== 'negative') return 1;
    return Math.abs(b.points) - Math.abs(a.points);
  });

  const fitContributions = sorted.filter((c) => c.category === 'fit');
  const intentContributions = sorted.filter((c) => c.category === 'intent');
  const negativeContributions = sorted.filter((c) => c.category === 'negative');

  return (
    <div className="border border-stone-200 bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          WHY THIS SCORE
        </span>
      </div>

      <div className="p-4">
        {/* Top section: quadrant dot + scores + band */}
        <div className="flex items-start gap-4">
          <QuadrantDot fitScore={fitScore} intentScore={intentScore} band={band} />

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <BandBadge band={band as Band} />
              {band === 'disqualified' && (
                <span className="text-[11px] text-stone-500">Score override active</span>
              )}
            </div>

            <div className="space-y-2">
              <ScoreBar
                label="FIT"
                value={fitScore}
                color={fitScore >= 60 ? 'bg-teal-700' : fitScore >= 35 ? 'bg-amber-600' : 'bg-stone-400'}
              />
              <ScoreBar
                label="INTENT"
                value={intentScore}
                color={intentScore >= 60 ? 'bg-red-800' : intentScore >= 35 ? 'bg-amber-600' : 'bg-stone-400'}
              />
            </div>
          </div>
        </div>

        {/* Contributions list */}
        <div className="mt-4 border-t border-stone-100 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            SCORING BREAKDOWN
          </span>

          {contributions.length === 0 ? (
            <p className="mt-2 text-xs text-stone-400">No scoring signals found.</p>
          ) : (
            <div className="mt-2 space-y-0">
              {/* Negative/disqualifiers first */}
              {negativeContributions.length > 0 && (
                <div className="mb-2">
                  {negativeContributions.map((c, i) => (
                    <ContributionRow key={`neg-${i}`} c={c} />
                  ))}
                </div>
              )}

              {/* Fit contributions */}
              {fitContributions.length > 0 && (
                <div className="mb-1">
                  <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                    FIT SIGNALS
                  </div>
                  {fitContributions.map((c, i) => (
                    <ContributionRow key={`fit-${i}`} c={c} />
                  ))}
                </div>
              )}

              {/* Intent contributions */}
              {intentContributions.length > 0 && (
                <div>
                  <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                    INTENT SIGNALS
                  </div>
                  {intentContributions.map((c, i) => (
                    <ContributionRow key={`int-${i}`} c={c} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
