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
    // Call-specific: strong positive
    ready_to_enroll_verbally: 18,
    requested_demo: 14,
    agreed_to_callback: 12,
    asked_enrollment_process: 14,
    mentioned_budget_available: 10,
    referral_intent: 10,
    // Call-specific: engagement
    asked_curriculum_details: 8,
    asked_instructor_credentials: 6,
    asked_batch_timing: 8,
    shared_personal_goals: 6,
    positive_past_experience: 8,
    // Call-specific: neutral
    spouse_approval_needed: 3,
    comparing_alternatives: 4,
    asked_certificate_value: 6,
    time_constraint_mentioned: 2,
    employer_sponsorship_query: 8,
    // Call-specific: negative
    call_back_later_stall: -4,
    not_the_decision_maker: -2,
    expressed_distrust: -8,
    explicit_rejection: -15,
    wrong_timing: -3,
  },

  decayHalfLifeDays: 7,

  disqualifiers: ['student_email_domain', 'unsubscribed', 'not_interested'],

  thresholds: {
    hot: 60,
    warm: 35,
  },
};
