import { describe, it, expect } from 'vitest';
import { scoreLead } from '@/lib/scoring/score';
import { DEFAULT_SCORING_CONFIG } from '@/lib/scoring/config';
import type {
  LeadInput,
  ActivityInput,
  SignalInput,
  ScoringConfig,
} from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-19T12:00:00Z');

const baseLead: LeadInput = {
  occupationType: 'working_professional',
  seniority: 'senior',
  sourceChannel: 'referral',
  isExistingCustomer: false,
  email: 'test@company.com',
};

const lowFitLead: LeadInput = {
  occupationType: 'student',
  seniority: 'junior',
  sourceChannel: 'paid_social',
  isExistingCustomer: false,
  email: 'student@gmail.com', // not a .edu — avoid accidental disqualification
};

// High-intent activities: attended live + clicked offer + high watch %
const highIntentActivities: ActivityInput[] = [
  { type: 'attended_live', occurredAt: NOW },
  { type: 'clicked_offer', occurredAt: NOW },
  { type: 'watch_percentage', numericValue: 95, occurredAt: NOW },
];

// High-intent extracted signals
const highIntentSignals: SignalInput[] = [
  {
    signalType: 'asked_emi',
    polarity: 'positive',
    confidence: 0.95,
    extractedAt: NOW,
  },
  {
    signalType: 'expressed_career_switch',
    polarity: 'positive',
    confidence: 0.9,
    extractedAt: NOW,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoreLead — pure scoring engine', () => {
  // ---- Fit scoring ----

  describe('fit scoring', () => {
    it('returns high fit for working_professional + senior + referral', () => {
      const result = scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      // working_professional=30, senior=20, referral=25 → raw 75
      // maxPossible = 30(occ) + 20(sen) + 25(src) + 15(existing) = 90
      // fitScore = round(75/90*100) = 83
      expect(result.fitScore).toBeGreaterThan(70);
    });

    it('returns low fit for student + junior + paid_social', () => {
      const result = scoreLead(
        lowFitLead,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // student=5, junior=10, paid_social=5 → raw 20
      // maxPossible = 30 + 20 + 25 + 15 = 90
      // fitScore = round(20/90*100) = 22
      expect(result.fitScore).toBeLessThan(30);
    });

    it('credits existing_customer when flag is true', () => {
      const existingCustomer: LeadInput = {
        ...baseLead,
        isExistingCustomer: true,
      };
      const withFlag = scoreLead(
        existingCustomer,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const withoutFlag = scoreLead(
        baseLead,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(withFlag.fitScore).toBeGreaterThan(withoutFlag.fitScore);
      expect(
        withFlag.contributions.some((c) => c.signal === 'existing_customer'),
      ).toBe(true);
    });

    it('handles missing seniority by defaulting to unknown', () => {
      const noSeniority: LeadInput = { ...baseLead, seniority: undefined };
      const result = scoreLead(
        noSeniority,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // Should use 'unknown' weight (5) instead of 'senior' (20)
      expect(result.fitScore).toBeLessThan(
        scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW).fitScore,
      );
      expect(
        result.contributions.some((c) => c.signal === 'seniority:unknown'),
      ).toBe(true);
    });
  });

  // ---- Intent scoring ----

  describe('intent scoring', () => {
    it('returns zero intent when no activities or signals', () => {
      const result = scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      expect(result.intentScore).toBe(0);
    });

    it('scores attended_live higher than watched_replay', () => {
      const attended: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      const replay: ActivityInput[] = [
        { type: 'watched_replay', occurredAt: NOW },
      ];
      const resultAttended = scoreLead(
        baseLead,
        attended,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const resultReplay = scoreLead(
        baseLead,
        replay,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // Compare raw contribution points — attended_live (30) > watched_replay (15)
      const attendedContrib = resultAttended.contributions.find(
        (c) => c.signal === 'activity:attended_live',
      );
      const replayContrib = resultReplay.contributions.find(
        (c) => c.signal === 'activity:watched_replay',
      );
      expect(attendedContrib).toBeDefined();
      expect(replayContrib).toBeDefined();
      expect(attendedContrib!.points).toBeGreaterThan(replayContrib!.points);
    });

    it('scales signal contributions by confidence', () => {
      const highConf: SignalInput[] = [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 1.0,
          extractedAt: NOW,
        },
      ];
      const lowConf: SignalInput[] = [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 0.5,
          extractedAt: NOW,
        },
      ];
      const resultHigh = scoreLead(
        baseLead,
        [],
        highConf,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const resultLow = scoreLead(
        baseLead,
        [],
        lowConf,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(resultHigh.intentScore).toBeGreaterThan(resultLow.intentScore);
    });

    it('applies watch_percentage boost when watched past pitch start', () => {
      const leadWithPitch: LeadInput = {
        ...baseLead,
        masterclassPitchStartMinute: 30,
        masterclassDurationMinutes: 60,
      };
      const leadNoPitch: LeadInput = { ...baseLead };
      // 80% watch = past the 50% pitch start → should get 1.5x boost
      const activities: ActivityInput[] = [
        { type: 'watch_percentage', numericValue: 80, occurredAt: NOW },
      ];
      const resultWithPitch = scoreLead(
        leadWithPitch,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const resultNoPitch = scoreLead(
        leadNoPitch,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // Compare the raw contribution points — the pitch-boosted version
      // should have higher points for the watch_percentage contribution
      const contribWithPitch = resultWithPitch.contributions.find(
        (c) => c.signal === 'activity:watch_percentage',
      );
      const contribNoPitch = resultNoPitch.contributions.find(
        (c) => c.signal === 'activity:watch_percentage',
      );
      expect(contribWithPitch).toBeDefined();
      expect(contribNoPitch).toBeDefined();
      expect(contribWithPitch!.points).toBeGreaterThan(
        contribNoPitch!.points,
      );
    });
  });

  // ---- Time decay ----

  describe('time decay', () => {
    it('reduces score for older activities', () => {
      const recent: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      // 14 days ago = 2 half-lives (default half-life = 7 days)
      const old: ActivityInput[] = [
        {
          type: 'attended_live',
          occurredAt: new Date('2026-06-05T12:00:00Z'),
        },
      ];
      const resultRecent = scoreLead(
        baseLead,
        recent,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const resultOld = scoreLead(
        baseLead,
        old,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(resultRecent.intentScore).toBeGreaterThan(resultOld.intentScore);
    });

    it('applies no decay to same-instant activities', () => {
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // With no decay, attended_live (weight 30) / maxPossible should normalize
      // Check that the intent contribution for attended_live has full points
      const attendedContrib = result.contributions.find(
        (c) => c.signal === 'activity:attended_live',
      );
      expect(attendedContrib).toBeDefined();
      expect(attendedContrib!.points).toBe(attendedContrib!.weight);
    });

    it('after one half-life, intent contribution is roughly halved', () => {
      const oneHalfLife = new Date(
        NOW.getTime() - DEFAULT_SCORING_CONFIG.decayHalfLifeDays * 24 * 60 * 60 * 1000,
      );
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: oneHalfLife },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const contrib = result.contributions.find(
        (c) => c.signal === 'activity:attended_live',
      );
      expect(contrib).toBeDefined();
      // After one half-life, decay = 0.5, so points ≈ weight * 0.5
      expect(contrib!.points).toBeCloseTo(contrib!.weight * 0.5, 0);
    });

    it('does not decay fit scores', () => {
      // Fit scores depend on stable attributes, not time — they should be
      // identical regardless of the `now` parameter.
      const past = new Date('2025-01-01T00:00:00Z');
      const future = new Date('2027-12-31T23:59:59Z');
      const resultPast = scoreLead(
        baseLead,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        past,
      );
      const resultFuture = scoreLead(
        baseLead,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        future,
      );
      expect(resultPast.fitScore).toBe(resultFuture.fitScore);
    });
  });

  // ---- Disqualifiers ----

  describe('disqualifiers', () => {
    it('disqualifies on student email domain (.edu)', () => {
      const lead: LeadInput = { ...baseLead, email: 'student@college.edu' };
      const result = scoreLead(lead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      expect(result.band).toBe('disqualified');
      expect(result.fitScore).toBe(0);
      expect(result.intentScore).toBe(0);
      expect(
        result.contributions.some((c) => c.signal === 'student_email_domain'),
      ).toBe(true);
    });

    it('disqualifies on Indian academic email domain (.ac.in)', () => {
      const lead: LeadInput = { ...baseLead, email: 'student@iitd.ac.in' };
      const result = scoreLead(lead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      expect(result.band).toBe('disqualified');
    });

    it('disqualifies on .edu.in email domain', () => {
      const lead: LeadInput = { ...baseLead, email: 'student@dtu.edu.in' };
      const result = scoreLead(lead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      expect(result.band).toBe('disqualified');
    });

    it('disqualifies on unsubscribed activity', () => {
      const activities: ActivityInput[] = [
        { type: 'unsubscribed', occurredAt: NOW },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('disqualified');
      expect(
        result.contributions.some((c) => c.signal === 'unsubscribed'),
      ).toBe(true);
    });

    it('disqualifies on not_interested signal with negative polarity', () => {
      const signals: SignalInput[] = [
        {
          signalType: 'not_interested',
          polarity: 'negative',
          confidence: 0.9,
          extractedAt: NOW,
        },
      ];
      const result = scoreLead(
        baseLead,
        [],
        signals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('disqualified');
    });

    it('overrides even high fit + high intent when disqualified', () => {
      const lead: LeadInput = { ...baseLead, email: 'user@mit.edu' };
      const result = scoreLead(
        lead,
        highIntentActivities,
        highIntentSignals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('disqualified');
      expect(result.fitScore).toBe(0);
      expect(result.intentScore).toBe(0);
    });

    it('does not disqualify non-student email domains', () => {
      const lead: LeadInput = { ...baseLead, email: 'pro@education.com' };
      const result = scoreLead(lead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      expect(result.band).not.toBe('disqualified');
    });

    it('respects custom disqualifiers list', () => {
      // Config with no disqualifiers — .edu email should NOT disqualify
      const noDisqualConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        disqualifiers: [],
      };
      const lead: LeadInput = { ...baseLead, email: 'student@college.edu' };
      const result = scoreLead(lead, [], [], noDisqualConfig, NOW);
      expect(result.band).not.toBe('disqualified');
    });
  });

  // ---- Band mapping (quadrant logic) ----

  describe('band mapping', () => {
    it('maps high fit + high intent to call_now', () => {
      const result = scoreLead(
        baseLead,
        highIntentActivities,
        highIntentSignals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('call_now');
      expect(result.fitScore).toBeGreaterThanOrEqual(
        DEFAULT_SCORING_CONFIG.thresholds.hot,
      );
      expect(result.intentScore).toBeGreaterThanOrEqual(
        DEFAULT_SCORING_CONFIG.thresholds.hot,
      );
    });

    it('maps high intent + low fit to qualify', () => {
      const result = scoreLead(
        lowFitLead,
        highIntentActivities,
        highIntentSignals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('qualify');
    });

    it('maps high fit + low intent to nurture', () => {
      const result = scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      // baseLead has fitScore ~83, no activities → intentScore 0
      expect(result.band).toBe('nurture');
      expect(result.fitScore).toBeGreaterThanOrEqual(
        DEFAULT_SCORING_CONFIG.thresholds.hot,
      );
      expect(result.intentScore).toBeLessThan(
        DEFAULT_SCORING_CONFIG.thresholds.hot,
      );
    });

    it('maps low fit + low intent to cold', () => {
      const coldLead: LeadInput = {
        occupationType: 'other',
        seniority: 'unknown',
        sourceChannel: 'other',
        isExistingCustomer: false,
        email: 'someone@gmail.com',
      };
      const result = scoreLead(
        coldLead,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // other=10, unknown=5, source_other=5 → raw 20, maxPossible 90 → ~22
      expect(result.band).toBe('cold');
      expect(result.fitScore).toBeLessThan(
        DEFAULT_SCORING_CONFIG.thresholds.warm,
      );
    });

    it('uses warm threshold for intermediate cases', () => {
      // Create a lead with moderate fit (above warm, below hot)
      const moderateLead: LeadInput = {
        occupationType: 'working_professional',
        seniority: 'unknown',
        sourceChannel: 'paid_social',
        isExistingCustomer: false,
        email: 'user@company.com',
      };
      const result = scoreLead(
        moderateLead,
        [],
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // working_professional=30, unknown=5, paid_social=5 → raw 40, max 90 → ~44
      // That is >= warm(35) but < hot(60), so with intent=0 → nurture
      expect(result.fitScore).toBeGreaterThanOrEqual(
        DEFAULT_SCORING_CONFIG.thresholds.warm,
      );
      expect(result.fitScore).toBeLessThan(
        DEFAULT_SCORING_CONFIG.thresholds.hot,
      );
      expect(result.band).toBe('nurture');
    });
  });

  // ---- Custom config thresholds ----

  describe('custom config thresholds', () => {
    it('respects stricter thresholds', () => {
      const strictConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        thresholds: { hot: 90, warm: 50 },
      };
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      const result = scoreLead(baseLead, activities, [], strictConfig, NOW);
      // With hot at 90, baseLead's fitScore (~83) won't reach 'call_now'
      expect(result.band).not.toBe('call_now');
    });

    it('respects looser thresholds', () => {
      const looseConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        thresholds: { hot: 20, warm: 10 },
      };
      // Even low-fit lead with minimal activity should reach call_now
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      const result = scoreLead(lowFitLead, activities, [], looseConfig, NOW);
      expect(result.fitScore).toBeGreaterThanOrEqual(20);
      expect(result.intentScore).toBeGreaterThanOrEqual(20);
      expect(result.band).toBe('call_now');
    });

    it('uses custom decay half-life', () => {
      // 1-day half-life: a 7-day-old activity should be nearly gone
      const fastDecay: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        decayHalfLifeDays: 1,
      };
      const weekOld: ActivityInput[] = [
        {
          type: 'attended_live',
          occurredAt: new Date('2026-06-12T12:00:00Z'),
        },
      ];
      const resultFast = scoreLead(baseLead, weekOld, [], fastDecay, NOW);
      const resultDefault = scoreLead(
        baseLead,
        weekOld,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // Faster decay → lower intent score for old activity
      expect(resultFast.intentScore).toBeLessThan(resultDefault.intentScore);
    });
  });

  // ---- Idempotency ----

  describe('idempotency', () => {
    it('returns identical output for identical input', () => {
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
        { type: 'clicked_offer', occurredAt: NOW },
      ];
      const signals: SignalInput[] = [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 0.9,
          extractedAt: NOW,
        },
      ];
      const r1 = scoreLead(
        baseLead,
        activities,
        signals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const r2 = scoreLead(
        baseLead,
        activities,
        signals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(r1).toEqual(r2);
    });

    it('produces stable results across multiple invocations', () => {
      const results = Array.from({ length: 10 }, () =>
        scoreLead(baseLead, highIntentActivities, highIntentSignals, DEFAULT_SCORING_CONFIG, NOW),
      );
      const first = results[0]!;
      for (const result of results) {
        expect(result.fitScore).toBe(first.fitScore);
        expect(result.intentScore).toBe(first.intentScore);
        expect(result.band).toBe(first.band);
        expect(result.contributions).toEqual(first.contributions);
      }
    });
  });

  // ---- Contributions explainability ----

  describe('contributions (explainability)', () => {
    it('always returns a non-empty contributions array for leads with fit attributes', () => {
      const result = scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      expect(Array.isArray(result.contributions)).toBe(true);
      expect(result.contributions.length).toBeGreaterThan(0);
    });

    it('every contribution has the required properties', () => {
      const result = scoreLead(
        baseLead,
        highIntentActivities,
        highIntentSignals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      for (const c of result.contributions) {
        expect(c).toHaveProperty('signal');
        expect(c).toHaveProperty('category');
        expect(c).toHaveProperty('weight');
        expect(c).toHaveProperty('points');
        expect(typeof c.signal).toBe('string');
        expect(['fit', 'intent', 'negative']).toContain(c.category);
        expect(typeof c.weight).toBe('number');
        expect(typeof c.points).toBe('number');
      }
    });

    it('includes fit contributions with correct signal names', () => {
      const result = scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      const fitContribs = result.contributions.filter(
        (c) => c.category === 'fit',
      );
      expect(fitContribs.length).toBeGreaterThan(0);
      const signals = fitContribs.map((c) => c.signal);
      expect(signals).toContain('occupation:working_professional');
      expect(signals).toContain('seniority:senior');
      expect(signals).toContain('source:referral');
    });

    it('includes intent contributions for activities', () => {
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const intentContribs = result.contributions.filter(
        (c) => c.category === 'intent',
      );
      expect(intentContribs.length).toBeGreaterThan(0);
      expect(
        intentContribs.some((c) => c.signal === 'activity:attended_live'),
      ).toBe(true);
    });

    it('includes signal contributions from LLM-extracted signals', () => {
      const signals: SignalInput[] = [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 0.9,
          extractedAt: NOW,
        },
      ];
      const result = scoreLead(
        baseLead,
        [],
        signals,
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(
        result.contributions.some((c) => c.signal === 'signal:asked_emi'),
      ).toBe(true);
    });

    it('includes negative contributions for disqualifiers', () => {
      const lead: LeadInput = { ...baseLead, email: 'user@school.edu' };
      const result = scoreLead(lead, [], [], DEFAULT_SCORING_CONFIG, NOW);
      const negativeContribs = result.contributions.filter(
        (c) => c.category === 'negative',
      );
      expect(negativeContribs.length).toBeGreaterThan(0);
      expect(negativeContribs[0]!.points).toBeLessThan(0);
    });

    it('marks no_show activity as negative category', () => {
      const activities: ActivityInput[] = [
        { type: 'no_show', occurredAt: NOW },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      const noShowContrib = result.contributions.find(
        (c) => c.signal === 'activity:no_show',
      );
      expect(noShowContrib).toBeDefined();
      expect(noShowContrib!.category).toBe('negative');
      expect(noShowContrib!.points).toBeLessThan(0);
    });
  });

  // ---- Graceful handling of edge cases ----

  describe('edge cases — graceful handling', () => {
    it('handles empty activities and signals without throwing', () => {
      expect(() =>
        scoreLead(baseLead, [], [], DEFAULT_SCORING_CONFIG, NOW),
      ).not.toThrow();
    });

    it('handles watch_percentage without numericValue', () => {
      const activities: ActivityInput[] = [
        { type: 'watch_percentage', occurredAt: NOW },
        // numericValue is undefined
      ];
      expect(() =>
        scoreLead(baseLead, activities, [], DEFAULT_SCORING_CONFIG, NOW),
      ).not.toThrow();
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // watch_percentage with numericValue=undefined → treated as 0% → 0 weight → skipped
      // so there should be no watch_percentage contribution (0 * weight = 0)
      expect(result.intentScore).toBe(0);
    });

    it('handles activities with zero-weight types gracefully', () => {
      // 'registered' has no intent weight by default
      const activities: ActivityInput[] = [
        { type: 'registered', occurredAt: NOW },
      ];
      expect(() =>
        scoreLead(baseLead, activities, [], DEFAULT_SCORING_CONFIG, NOW),
      ).not.toThrow();
    });

    it('handles future-dated activities (decay clamp to 1)', () => {
      const futureActivity: ActivityInput[] = [
        {
          type: 'attended_live',
          occurredAt: new Date('2026-06-25T12:00:00Z'),
        },
      ];
      const result = scoreLead(
        baseLead,
        futureActivity,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // Future activity should have decay=1 (no boost, no penalty)
      const contrib = result.contributions.find(
        (c) => c.signal === 'activity:attended_live',
      );
      expect(contrib).toBeDefined();
      expect(contrib!.points).toBe(contrib!.weight);
    });

    it('clamps negative intent raw to zero before normalizing', () => {
      // All negative activities, no positive ones
      const activities: ActivityInput[] = [
        { type: 'no_show', occurredAt: NOW },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.intentScore).toBe(0);
    });

    it('handles large number of activities without issues', () => {
      const manyActivities: ActivityInput[] = Array.from(
        { length: 100 },
        (_, i) => ({
          type: 'chat_message' as const,
          occurredAt: new Date(NOW.getTime() - i * 60 * 60 * 1000),
        }),
      );
      expect(() =>
        scoreLead(baseLead, manyActivities, [], DEFAULT_SCORING_CONFIG, NOW),
      ).not.toThrow();
      const result = scoreLead(
        baseLead,
        manyActivities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.intentScore).toBeGreaterThan(0);
    });

    it('handles watch_percentage with numericValue over 100', () => {
      const activities: ActivityInput[] = [
        { type: 'watch_percentage', numericValue: 150, occurredAt: NOW },
      ];
      // Should clamp to 100% via min(100, max(0, value))
      expect(() =>
        scoreLead(baseLead, activities, [], DEFAULT_SCORING_CONFIG, NOW),
      ).not.toThrow();
    });

    it('handles config with zero decayHalfLifeDays', () => {
      const zeroDecayConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        decayHalfLifeDays: 0,
      };
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
      ];
      // halfLifeDays=0 → decay returns 0 → all intent should be 0
      expect(() =>
        scoreLead(baseLead, activities, [], zeroDecayConfig, NOW),
      ).not.toThrow();
    });
  });

  // ---- Integration-level scenarios ----

  describe('realistic scenarios', () => {
    it('high-engagement professional gets call_now', () => {
      const lead: LeadInput = {
        occupationType: 'working_professional',
        seniority: 'senior',
        sourceChannel: 'referral',
        isExistingCustomer: true,
        email: 'vp@bigcorp.com',
        masterclassPitchStartMinute: 30,
        masterclassDurationMinutes: 60,
      };
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
        { type: 'watch_percentage', numericValue: 90, occurredAt: NOW },
        { type: 'clicked_offer', occurredAt: NOW },
        { type: 'question_asked', occurredAt: NOW },
      ];
      const signals: SignalInput[] = [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 0.95,
          extractedAt: NOW,
        },
        {
          signalType: 'expressed_career_switch',
          polarity: 'positive',
          confidence: 0.85,
          extractedAt: NOW,
        },
      ];
      const result = scoreLead(lead, activities, signals, DEFAULT_SCORING_CONFIG, NOW);
      expect(result.band).toBe('call_now');
      expect(result.fitScore).toBeGreaterThanOrEqual(80);
      expect(result.intentScore).toBeGreaterThanOrEqual(60);
    });

    it('disinterested student is disqualified despite high engagement', () => {
      const lead: LeadInput = {
        occupationType: 'student',
        seniority: 'junior',
        sourceChannel: 'paid_social',
        isExistingCustomer: false,
        email: 'student@university.edu',
      };
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
        { type: 'clicked_offer', occurredAt: NOW },
      ];
      const result = scoreLead(
        lead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      // .edu → disqualified, regardless of intent
      expect(result.band).toBe('disqualified');
    });

    it('cold lead with stale activity stays cold', () => {
      const coldLead: LeadInput = {
        occupationType: 'other',
        seniority: 'unknown',
        sourceChannel: 'other',
        isExistingCustomer: false,
        email: 'someone@gmail.com',
      };
      // Activity from 30 days ago — heavily decayed
      const staleActivities: ActivityInput[] = [
        {
          type: 'watched_replay',
          occurredAt: new Date('2026-05-20T12:00:00Z'),
        },
      ];
      const result = scoreLead(
        coldLead,
        staleActivities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('cold');
    });

    it('unsubscribed override works even with multiple positive activities', () => {
      const activities: ActivityInput[] = [
        { type: 'attended_live', occurredAt: NOW },
        { type: 'clicked_offer', occurredAt: NOW },
        { type: 'watch_percentage', numericValue: 100, occurredAt: NOW },
        { type: 'unsubscribed', occurredAt: NOW },
      ];
      const result = scoreLead(
        baseLead,
        activities,
        [],
        DEFAULT_SCORING_CONFIG,
        NOW,
      );
      expect(result.band).toBe('disqualified');
    });
  });
});
