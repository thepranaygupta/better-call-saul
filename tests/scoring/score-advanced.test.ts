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

// ---------------------------------------------------------------------------
// Advanced scoring edge cases
// ---------------------------------------------------------------------------

describe('scoreLead advanced', () => {
  it('signal confidence affects intent score (confidence 0.5 vs 1.0)', () => {
    const highConf: SignalInput[] = [
      {
        signalType: 'expressed_career_switch',
        polarity: 'positive',
        confidence: 1.0,
        extractedAt: NOW,
      },
    ];
    const lowConf: SignalInput[] = [
      {
        signalType: 'expressed_career_switch',
        polarity: 'positive',
        confidence: 0.5,
        extractedAt: NOW,
      },
    ];
    const resultHigh = scoreLead(baseLead, [], highConf, DEFAULT_SCORING_CONFIG, NOW);
    const resultLow = scoreLead(baseLead, [], lowConf, DEFAULT_SCORING_CONFIG, NOW);

    expect(resultHigh.intentScore).toBeGreaterThan(resultLow.intentScore);

    // Verify contributions reflect the confidence difference
    const contribHigh = resultHigh.contributions.find(
      (c) => c.signal === 'signal:expressed_career_switch',
    );
    const contribLow = resultLow.contributions.find(
      (c) => c.signal === 'signal:expressed_career_switch',
    );
    expect(contribHigh).toBeDefined();
    expect(contribLow).toBeDefined();
    expect(contribHigh!.points).toBeGreaterThan(contribLow!.points);
  });

  it('multiple activities of same type accumulate in raw points', () => {
    const single: ActivityInput[] = [
      { type: 'chat_message', occurredAt: NOW },
    ];
    const multiple: ActivityInput[] = [
      { type: 'chat_message', occurredAt: NOW },
      { type: 'chat_message', occurredAt: new Date(NOW.getTime() - 60000) },
      { type: 'chat_message', occurredAt: new Date(NOW.getTime() - 120000) },
    ];

    const resultSingle = scoreLead(baseLead, single, [], DEFAULT_SCORING_CONFIG, NOW);
    const resultMultiple = scoreLead(baseLead, multiple, [], DEFAULT_SCORING_CONFIG, NOW);

    // Should have 3 chat_message contributions (accumulated, not collapsed)
    const chatContribs = resultMultiple.contributions.filter(
      (c) => c.signal === 'activity:chat_message',
    );
    expect(chatContribs).toHaveLength(3);

    // Total raw points from 3 messages > 1 message
    const singleContribs = resultSingle.contributions.filter(
      (c) => c.signal === 'activity:chat_message',
    );
    const totalMultiple = chatContribs.reduce((s, c) => s + c.points, 0);
    const totalSingle = singleContribs.reduce((s, c) => s + c.points, 0);
    expect(totalMultiple).toBeGreaterThan(totalSingle);
  });

  it('negative signals reduce intent score', () => {
    const positiveOnly: ActivityInput[] = [
      { type: 'attended_live', occurredAt: NOW },
      { type: 'clicked_offer', occurredAt: NOW },
    ];
    const withNegative: ActivityInput[] = [
      { type: 'attended_live', occurredAt: NOW },
      { type: 'clicked_offer', occurredAt: NOW },
      { type: 'no_show', occurredAt: NOW },
    ];

    const resultPositive = scoreLead(baseLead, positiveOnly, [], DEFAULT_SCORING_CONFIG, NOW);
    const resultMixed = scoreLead(baseLead, withNegative, [], DEFAULT_SCORING_CONFIG, NOW);

    expect(resultPositive.intentScore).toBeGreaterThan(resultMixed.intentScore);
  });

  it('all-negative signals result in 0 intent (not negative)', () => {
    const activities: ActivityInput[] = [
      { type: 'no_show', occurredAt: NOW },
    ];
    // Use a config without 'not_interested' disqualifier to avoid disqualification
    const configNoDisqualNotInterested: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      disqualifiers: ['student_email_domain', 'unsubscribed'],
    };
    const signals: SignalInput[] = [
      {
        signalType: 'not_interested',
        polarity: 'neutral',  // neutral polarity avoids disqualifier
        confidence: 0.8,
        extractedAt: NOW,
      },
    ];

    const result = scoreLead(
      baseLead,
      activities,
      signals,
      configNoDisqualNotInterested,
      NOW,
    );

    // Intent should be clamped to 0, never negative
    expect(result.intentScore).toBe(0);
    expect(result.intentScore).toBeGreaterThanOrEqual(0);
  });

  it('empty lead (no occupation detail, minimal attributes) still returns valid result', () => {
    const minimalLead: LeadInput = {
      occupationType: 'other',
      seniority: undefined,
      sourceChannel: 'other',
      isExistingCustomer: false,
      email: 'someone@example.com',
    };

    const result = scoreLead(minimalLead, [], [], DEFAULT_SCORING_CONFIG, NOW);

    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.fitScore).toBeLessThanOrEqual(100);
    expect(result.intentScore).toBe(0);
    expect(typeof result.band).toBe('string');
    expect(Array.isArray(result.contributions)).toBe(true);
  });

  it('custom config with all zero weights returns 0 scores', () => {
    const zeroConfig: ScoringConfig = {
      fitWeights: {
        working_professional: 0,
        student: 0,
        other: 0,
        senior: 0,
        mid: 0,
        junior: 0,
        unknown: 0,
        referral: 0,
        email: 0,
        organic: 0,
        paid_search: 0,
        paid_social: 0,
        source_other: 0,
        existing_customer: 0,
      },
      intentWeights: {
        attended_live: 0,
        watched_replay: 0,
        clicked_offer: 0,
        watch_percentage: 0,
        chat_message: 0,
        question_asked: 0,
        poll_response: 0,
        reregistered: 0,
        no_show: 0,
        asked_emi: 0,
        asked_price: 0,
        asked_job_outcome: 0,
        expressed_career_switch: 0,
        high_enthusiasm: 0,
        price_objection: 0,
        competitor_mention: 0,
        not_interested: 0,
        asked_time_commitment: 0,
        asked_refund_guarantee: 0,
      },
      decayHalfLifeDays: 7,
      disqualifiers: [],
      thresholds: { hot: 60, warm: 35 },
    };

    const activities: ActivityInput[] = [
      { type: 'attended_live', occurredAt: NOW },
      { type: 'clicked_offer', occurredAt: NOW },
    ];
    const signals: SignalInput[] = [
      { signalType: 'asked_emi', polarity: 'positive', confidence: 1.0, extractedAt: NOW },
    ];

    const result = scoreLead(baseLead, activities, signals, zeroConfig, NOW);

    expect(result.fitScore).toBe(0);
    expect(result.intentScore).toBe(0);
    // With all zeros, both below warm threshold -> cold
    expect(result.band).toBe('cold');
  });

  it('very old activities (30+ days) have negligible impact with 7-day half-life', () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oldActivities: ActivityInput[] = [
      { type: 'attended_live', occurredAt: thirtyDaysAgo },
      { type: 'clicked_offer', occurredAt: thirtyDaysAgo },
    ];
    const freshActivities: ActivityInput[] = [
      { type: 'attended_live', occurredAt: NOW },
      { type: 'clicked_offer', occurredAt: NOW },
    ];

    const resultOld = scoreLead(baseLead, oldActivities, [], DEFAULT_SCORING_CONFIG, NOW);
    const resultFresh = scoreLead(baseLead, freshActivities, [], DEFAULT_SCORING_CONFIG, NOW);

    // After ~4.3 half-lives (30/7), decay is ~2^(-4.3) ~ 0.05 — negligible
    expect(resultOld.intentScore).toBeLessThan(resultFresh.intentScore * 0.15);

    // Verify actual contribution points are near zero
    const oldContribs = resultOld.contributions.filter((c) => c.category === 'intent');
    for (const c of oldContribs) {
      expect(Math.abs(c.points)).toBeLessThan(c.weight * 0.1);
    }
  });

  it('mixing activities and signals produces higher raw intent points than either alone', () => {
    const activities: ActivityInput[] = [
      { type: 'attended_live', occurredAt: NOW },
    ];
    const signals: SignalInput[] = [
      { signalType: 'asked_emi', polarity: 'positive', confidence: 0.9, extractedAt: NOW },
    ];

    const actOnly = scoreLead(baseLead, activities, [], DEFAULT_SCORING_CONFIG, NOW);
    const sigOnly = scoreLead(baseLead, [], signals, DEFAULT_SCORING_CONFIG, NOW);
    const both = scoreLead(baseLead, activities, signals, DEFAULT_SCORING_CONFIG, NOW);

    // Compare raw contribution points (not normalized score, since normalization
    // adjusts for maxPossible which also grows when both are present)
    const rawAct = actOnly.contributions
      .filter((c) => c.category === 'intent')
      .reduce((s, c) => s + c.points, 0);
    const rawSig = sigOnly.contributions
      .filter((c) => c.category === 'intent')
      .reduce((s, c) => s + c.points, 0);
    const rawBoth = both.contributions
      .filter((c) => c.category === 'intent')
      .reduce((s, c) => s + c.points, 0);

    expect(rawBoth).toBeGreaterThan(rawAct);
    expect(rawBoth).toBeGreaterThan(rawSig);

    // The combined result should include contributions from both activities and signals
    expect(both.contributions.some((c) => c.signal === 'activity:attended_live')).toBe(true);
    expect(both.contributions.some((c) => c.signal === 'signal:asked_emi')).toBe(true);
  });

  it('config with only fit weights set (empty intent weights) still scores correctly', () => {
    const fitOnlyConfig: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      intentWeights: {},
    };

    const activities: ActivityInput[] = [
      { type: 'attended_live', occurredAt: NOW },
    ];

    const result = scoreLead(baseLead, activities, [], fitOnlyConfig, NOW);

    // Fit should still work
    expect(result.fitScore).toBeGreaterThan(0);
    // Intent should be 0 because no weights match
    expect(result.intentScore).toBe(0);
  });

  it('reregistered activity contributes positively to intent', () => {
    const activities: ActivityInput[] = [
      { type: 'reregistered', occurredAt: NOW },
    ];

    const result = scoreLead(baseLead, activities, [], DEFAULT_SCORING_CONFIG, NOW);

    const contrib = result.contributions.find(
      (c) => c.signal === 'activity:reregistered',
    );
    expect(contrib).toBeDefined();
    expect(contrib!.category).toBe('intent');
    expect(contrib!.points).toBeGreaterThan(0);
  });
});
