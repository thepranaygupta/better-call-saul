import type {
  LeadInput,
  ActivityInput,
  SignalInput,
  ScoringConfig,
  ScoringResult,
  Contribution,
  Band,
} from './types';

// ---------------------------------------------------------------------------
// Helpers (pure, no side effects)
// ---------------------------------------------------------------------------

/**
 * Exponential time-decay: `2^(-daysSince / halfLifeDays)`
 *
 * A signal from `halfLifeDays` ago is worth 50 % of today's value.
 * Future-dated events (negative days) are clamped to decay = 1 (no boost).
 */
function computeDecay(
  occurredAt: Date,
  now: Date,
  halfLifeDays: number,
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = (now.getTime() - occurredAt.getTime()) / msPerDay;
  if (daysSince <= 0) return 1; // future / same-instant: no decay
  if (halfLifeDays <= 0) return 0; // guard: avoid Infinity exponent
  return Math.pow(2, -daysSince / halfLifeDays);
}

/**
 * Normalize a raw score into 0–100, clamped and rounded.
 * Returns 0 when `maxPossible` is zero or negative (avoids divide-by-zero).
 */
function normalize(raw: number, maxPossible: number): number {
  if (maxPossible <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (raw / maxPossible) * 100)));
}

// ---------------------------------------------------------------------------
// Disqualifier check
// ---------------------------------------------------------------------------

/**
 * Scan for hard disqualifiers. Any hit → band = 'disqualified'.
 *
 * Each disqualifier is surfaced as a `Contribution` with negative points
 * so the "why this score" UI can explain the cap.
 */
function checkDisqualifiers(
  lead: LeadInput,
  activities: readonly ActivityInput[],
  signals: readonly SignalInput[],
  disqualifiers: readonly string[],
): Contribution[] {
  const found: Contribution[] = [];

  if (disqualifiers.includes('student_email_domain')) {
    const studentDomains = ['.edu', '.ac.in', '.edu.in'];
    if (
      studentDomains.some((d) => lead.email.toLowerCase().endsWith(d))
    ) {
      found.push({
        signal: 'student_email_domain',
        category: 'negative',
        weight: 0,
        points: -100,
      });
    }
  }

  if (disqualifiers.includes('unsubscribed')) {
    if (activities.some((a) => a.type === 'unsubscribed')) {
      found.push({
        signal: 'unsubscribed',
        category: 'negative',
        weight: 0,
        points: -100,
      });
    }
  }

  if (disqualifiers.includes('not_interested')) {
    if (
      signals.some(
        (s) => s.signalType === 'not_interested' && s.polarity === 'negative',
      )
    ) {
      found.push({
        signal: 'not_interested',
        category: 'negative',
        weight: 0,
        points: -100,
      });
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Fit scoring (stable attributes — no time decay)
// ---------------------------------------------------------------------------

interface FitResult {
  raw: number;
  maxPossible: number;
  contributions: Contribution[];
}

function computeFit(lead: LeadInput, fitWeights: Record<string, number>): FitResult {
  const contributions: Contribution[] = [];
  let raw = 0;

  // Compute the theoretical max: best value from each independent category
  const occupationMax = Math.max(
    fitWeights['working_professional'] ?? 0,
    fitWeights['student'] ?? 0,
    fitWeights['other'] ?? 0,
    0, // ensure at least 0
  );
  const seniorityMax = Math.max(
    fitWeights['senior'] ?? 0,
    fitWeights['mid'] ?? 0,
    fitWeights['junior'] ?? 0,
    fitWeights['unknown'] ?? 0,
    0,
  );
  const sourceMax = Math.max(
    fitWeights['referral'] ?? 0,
    fitWeights['email'] ?? 0,
    fitWeights['organic'] ?? 0,
    fitWeights['paid_search'] ?? 0,
    fitWeights['paid_social'] ?? 0,
    fitWeights['source_other'] ?? 0,
    0,
  );
  const existingMax = Math.max(fitWeights['existing_customer'] ?? 0, 0);
  const maxPossible = occupationMax + seniorityMax + sourceMax + existingMax;

  // Occupation type
  const occWeight = fitWeights[lead.occupationType] ?? 0;
  if (occWeight !== 0) {
    raw += occWeight;
    contributions.push({
      signal: `occupation:${lead.occupationType}`,
      category: 'fit',
      weight: occWeight,
      points: occWeight,
    });
  }

  // Seniority (defaults to 'unknown' when absent)
  const senKey = lead.seniority ?? 'unknown';
  const senWeight = fitWeights[senKey] ?? 0;
  if (senWeight !== 0) {
    raw += senWeight;
    contributions.push({
      signal: `seniority:${senKey}`,
      category: 'fit',
      weight: senWeight,
      points: senWeight,
    });
  }

  // Source channel (map 'other' → 'source_other' to avoid key collision)
  const srcKey = lead.sourceChannel === 'other' ? 'source_other' : lead.sourceChannel;
  const srcWeight = fitWeights[srcKey] ?? 0;
  if (srcWeight !== 0) {
    raw += srcWeight;
    contributions.push({
      signal: `source:${lead.sourceChannel}`,
      category: 'fit',
      weight: srcWeight,
      points: srcWeight,
    });
  }

  // Existing customer
  if (lead.isExistingCustomer) {
    const ecWeight = fitWeights['existing_customer'] ?? 0;
    if (ecWeight !== 0) {
      raw += ecWeight;
      contributions.push({
        signal: 'existing_customer',
        category: 'fit',
        weight: ecWeight,
        points: ecWeight,
      });
    }
  }

  return { raw, maxPossible, contributions };
}

// ---------------------------------------------------------------------------
// Intent scoring (activities + extracted signals, with time decay)
// ---------------------------------------------------------------------------

interface IntentResult {
  raw: number;
  maxPossible: number;
  contributions: Contribution[];
}

/**
 * Compute the base weight for a watch_percentage activity.
 *
 * If `masterclassPitchStartMinute` and `masterclassDurationMinutes` are
 * provided on the lead, watching past the pitch start point gets a 1.5x
 * boost (the lead sat through the sales pitch, which is a stronger signal).
 */
function watchPercentageWeight(
  activity: ActivityInput,
  lead: LeadInput,
  baseWeight: number,
): number {
  const pct = Math.min(100, Math.max(0, activity.numericValue ?? 0)) / 100;
  let weight = pct * baseWeight;

  // Boost if the lead watched past the pitch start point
  if (
    lead.masterclassPitchStartMinute != null &&
    lead.masterclassDurationMinutes != null &&
    lead.masterclassDurationMinutes > 0
  ) {
    const pitchStartPct =
      lead.masterclassPitchStartMinute / lead.masterclassDurationMinutes;
    if (pct > pitchStartPct) {
      // 1.5x boost for watching past the pitch
      weight *= 1.5;
    }
  }

  return weight;
}

function computeIntent(
  lead: LeadInput,
  activities: readonly ActivityInput[],
  signals: readonly SignalInput[],
  intentWeights: Record<string, number>,
  halfLifeDays: number,
  now: Date,
): IntentResult {
  const contributions: Contribution[] = [];
  let raw = 0;
  let maxPossible = 0;

  // --- Activities ---
  for (const activity of activities) {
    // Skip 'unsubscribed' (handled as disqualifier) and 'registered' (no intent weight by default)
    if (activity.type === 'unsubscribed') continue;

    let baseWeight: number;
    if (activity.type === 'watch_percentage') {
      baseWeight = watchPercentageWeight(
        activity,
        lead,
        intentWeights['watch_percentage'] ?? 0,
      );
    } else {
      baseWeight = intentWeights[activity.type] ?? 0;
    }

    if (baseWeight === 0) continue;

    const decay = computeDecay(activity.occurredAt, now, halfLifeDays);
    const points = Math.round(baseWeight * decay * 100) / 100;

    raw += points;
    // Only positive weights contribute to the theoretical max
    if (baseWeight > 0) {
      maxPossible += baseWeight; // un-decayed max (best case: happened now)
    }

    contributions.push({
      signal: `activity:${activity.type}`,
      category: baseWeight < 0 ? 'negative' : 'intent',
      weight: baseWeight,
      points,
    });
  }

  // --- Extracted signals (from LLM) ---
  for (const signal of signals) {
    const baseWeight = intentWeights[signal.signalType] ?? 0;
    if (baseWeight === 0) continue;

    const decay = computeDecay(signal.extractedAt, now, halfLifeDays);
    const points = Math.round(baseWeight * decay * signal.confidence * 100) / 100;

    raw += points;
    if (baseWeight > 0) {
      maxPossible += baseWeight;
    }

    contributions.push({
      signal: `signal:${signal.signalType}`,
      category: baseWeight < 0 ? 'negative' : 'intent',
      weight: baseWeight,
      points,
    });
  }

  return { raw, maxPossible, contributions };
}

// ---------------------------------------------------------------------------
// Band mapping (fit x intent quadrant)
// ---------------------------------------------------------------------------

/**
 * Map (fitScore, intentScore) to a Band using the hot/warm thresholds.
 *
 * Quadrant logic:
 *  - fit >= hot AND intent >= hot  → call_now
 *  - intent >= hot AND fit < hot   → qualify   (high intent, need to verify fit)
 *  - fit >= hot AND intent < hot   → nurture   (good fit, need to build intent)
 *  - fit >= warm OR intent >= warm  → qualify or nurture (whichever dimension is stronger)
 *  - below warm on both            → cold
 *
 * 'disqualified' is handled before this function is called.
 */
function determineBand(
  fitScore: number,
  intentScore: number,
  thresholds: { hot: number; warm: number },
): Band {
  const { hot, warm } = thresholds;

  if (fitScore >= hot && intentScore >= hot) {
    return 'call_now';
  }
  if (intentScore >= hot) {
    return 'qualify';
  }
  if (fitScore >= hot) {
    return 'nurture';
  }

  // Below hot on both — use warm threshold for granularity
  if (fitScore >= warm || intentScore >= warm) {
    // Whichever dimension is stronger determines the band
    return intentScore >= fitScore ? 'qualify' : 'nurture';
  }

  return 'cold';
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Score a single lead. **Pure function** — deterministic, idempotent,
 * no I/O, no LLM calls, no DB access.
 *
 * @param lead      - Stable lead attributes (projected from the Lead document)
 * @param activities - Behavioural events for this lead
 * @param signals    - LLM-extracted signals for this lead
 * @param config     - Scoring weights, thresholds, disqualifiers
 * @param now        - The reference timestamp for time-decay calculation
 *
 * @returns `{ fitScore, intentScore, band, contributions }` — the
 * contributions array IS the explainability; the UI renders it directly.
 */
export function scoreLead(
  lead: LeadInput,
  activities: readonly ActivityInput[],
  signals: readonly SignalInput[],
  config: ScoringConfig,
  now: Date,
): ScoringResult {
  const contributions: Contribution[] = [];

  // 1. Check disqualifiers first — they override everything
  const disqualifierHits = checkDisqualifiers(
    lead,
    activities,
    signals,
    config.disqualifiers,
  );

  if (disqualifierHits.length > 0) {
    contributions.push(...disqualifierHits);
    return {
      fitScore: 0,
      intentScore: 0,
      band: 'disqualified',
      contributions,
    };
  }

  // 2. Fit score (stable attributes, no decay)
  const fit = computeFit(lead, config.fitWeights);
  contributions.push(...fit.contributions);
  const fitScore = normalize(fit.raw, fit.maxPossible);

  // 3. Intent score (activities + signals, with time decay)
  const intent = computeIntent(
    lead,
    activities,
    signals,
    config.intentWeights,
    config.decayHalfLifeDays,
    now,
  );
  contributions.push(...intent.contributions);
  // Clamp raw to 0 before normalizing (negative activities can drag below zero)
  const intentScore =
    intent.maxPossible > 0
      ? normalize(Math.max(0, intent.raw), intent.maxPossible)
      : 0;

  // 4. Band (quadrant mapping)
  const band = determineBand(fitScore, intentScore, config.thresholds);

  return { fitScore, intentScore, band, contributions };
}
