/**
 * Scoring engine types — pure definitions, no I/O or DB imports.
 *
 * These mirror the domain model shapes but are decoupled from Mongoose
 * so that `scoreLead()` remains a pure function of plain data.
 */

// ---------------------------------------------------------------------------
// Enums / union types
// ---------------------------------------------------------------------------

export type OccupationType = 'working_professional' | 'student' | 'other';

export type Seniority = 'junior' | 'mid' | 'senior' | 'unknown';

export type SourceChannel =
  | 'referral'
  | 'email'
  | 'paid_search'
  | 'paid_social'
  | 'organic'
  | 'other';

export type Band =
  | 'call_now'
  | 'qualify'
  | 'nurture'
  | 'cold'
  | 'disqualified';

export type ActivityType =
  | 'registered'
  | 'attended_live'
  | 'watched_replay'
  | 'no_show'
  | 'watch_percentage'
  | 'chat_message'
  | 'question_asked'
  | 'poll_response'
  | 'clicked_offer'
  | 'reregistered'
  | 'unsubscribed';

export type SignalType =
  // Chat/Q&A signals (original 10)
  | 'asked_emi'
  | 'asked_price'
  | 'asked_job_outcome'
  | 'asked_time_commitment'
  | 'asked_refund_guarantee'
  | 'expressed_career_switch'
  | 'price_objection'
  | 'high_enthusiasm'
  | 'competitor_mention'
  | 'not_interested'
  // Call-specific: strong positive
  | 'ready_to_enroll_verbally'
  | 'agreed_to_callback'
  | 'requested_demo'
  | 'asked_enrollment_process'
  | 'mentioned_budget_available'
  | 'referral_intent'
  // Call-specific: engagement
  | 'asked_curriculum_details'
  | 'asked_instructor_credentials'
  | 'asked_batch_timing'
  | 'shared_personal_goals'
  | 'positive_past_experience'
  // Call-specific: neutral
  | 'spouse_approval_needed'
  | 'comparing_alternatives'
  | 'asked_certificate_value'
  | 'time_constraint_mentioned'
  | 'employer_sponsorship_query'
  // Call-specific: negative
  | 'call_back_later_stall'
  | 'not_the_decision_maker'
  | 'expressed_distrust'
  | 'explicit_rejection'
  | 'wrong_timing';

// ---------------------------------------------------------------------------
// Scoring inputs — plain-object projections the caller builds from DB docs
// ---------------------------------------------------------------------------

export interface LeadInput {
  occupationType: OccupationType;
  seniority?: Seniority;
  sourceChannel: SourceChannel;
  isExistingCustomer: boolean;
  email: string;
  /**
   * Optional: the minute in the masterclass when the sales pitch starts.
   * When present and the activity is `watch_percentage`, watch-% past
   * the pitch point scores higher than watch-% before it.
   */
  masterclassPitchStartMinute?: number;
  /**
   * Optional: total masterclass duration in minutes.
   * Needed alongside `masterclassPitchStartMinute` to determine whether
   * the lead watched past the pitch start.
   */
  masterclassDurationMinutes?: number;
}

export interface ActivityInput {
  type: ActivityType;
  /** e.g. watch percentage (0–100) */
  numericValue?: number;
  occurredAt: Date;
}

export interface SignalInput {
  signalType: SignalType;
  polarity: 'positive' | 'negative' | 'neutral';
  /** 0–1 confidence from the LLM extractor */
  confidence: number;
  extractedAt: Date;
}

// ---------------------------------------------------------------------------
// Scoring output
// ---------------------------------------------------------------------------

export interface Contribution {
  /** Human-readable label, e.g. "occupation:working_professional" or "signal:asked_emi" */
  signal: string;
  category: 'fit' | 'intent' | 'negative';
  /** The base weight from config before decay / scaling */
  weight: number;
  /** The actual points contributed (after decay, confidence, normalization) */
  points: number;
}

export interface ScoringResult {
  fitScore: number; // 0–100
  intentScore: number; // 0–100
  band: Band;
  contributions: Contribution[];
}

// ---------------------------------------------------------------------------
// Configuration (admin-editable, versioned)
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  fitWeights: Record<string, number>;
  intentWeights: Record<string, number>;
  decayHalfLifeDays: number;
  disqualifiers: string[];
  thresholds: {
    hot: number;
    warm: number;
  };
}
