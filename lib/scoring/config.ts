import type { ScoringConfig } from './types';

/**
 * Default scoring configuration.
 *
 * This is the fallback used when no project-specific ScoringConfig document
 * exists in the database. Admins can override any of these values via the
 * versioned weight editor (/admin).
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  // ---- Fit weights (stable lead attributes, no time decay) ----
  fitWeights: {
    // Occupation type
    working_professional: 30,
    student: 5,
    other: 10,
    // Seniority
    senior: 20,
    mid: 15,
    junior: 10,
    unknown: 5,
    // Source channel
    referral: 25,
    email: 20,
    organic: 15,
    paid_search: 10,
    paid_social: 5,
    source_other: 5,
    // Existing customer
    existing_customer: 15,
  },

  // ---- Intent weights (behavioural activities + LLM-extracted signals) ----
  intentWeights: {
    // Activity events
    attended_live: 30,
    watched_replay: 15,
    clicked_offer: 25,
    watch_percentage: 20,
    chat_message: 5,
    question_asked: 10,
    poll_response: 5,
    reregistered: 10,
    no_show: -10,
    // Extracted signals (from LLM)
    asked_emi: 20,
    asked_price: 15,
    asked_job_outcome: 15,
    expressed_career_switch: 20,
    high_enthusiasm: 15,
    price_objection: 5,
    competitor_mention: 5,
    not_interested: -30,
    asked_time_commitment: 10,
    asked_refund_guarantee: 10,
  },

  decayHalfLifeDays: 7,

  disqualifiers: ['student_email_domain', 'unsubscribed', 'not_interested'],

  thresholds: {
    hot: 60,
    warm: 35,
  },
};
