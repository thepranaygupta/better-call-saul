import { z } from 'zod';

// ---- Signal extraction output (from /api/ai/extract) ----

export const signalTypeEnum = z.enum([
  // Chat/Q&A signals (original 10)
  'asked_emi',
  'asked_price',
  'asked_job_outcome',
  'asked_time_commitment',
  'asked_refund_guarantee',
  'expressed_career_switch',
  'price_objection',
  'high_enthusiasm',
  'competitor_mention',
  'not_interested',
  // Call-specific: strong positive
  'ready_to_enroll_verbally',
  'agreed_to_callback',
  'requested_demo',
  'asked_enrollment_process',
  'mentioned_budget_available',
  'referral_intent',
  // Call-specific: engagement
  'asked_curriculum_details',
  'asked_instructor_credentials',
  'asked_batch_timing',
  'shared_personal_goals',
  'positive_past_experience',
  // Call-specific: neutral
  'spouse_approval_needed',
  'comparing_alternatives',
  'asked_certificate_value',
  'time_constraint_mentioned',
  'employer_sponsorship_query',
  // Call-specific: negative
  'call_back_later_stall',
  'not_the_decision_maker',
  'expressed_distrust',
  'explicit_rejection',
  'wrong_timing',
]);

export const polarityEnum = z.enum(['positive', 'negative', 'neutral']);

export const extractedSignalSchema = z.object({
  signals: z.array(
    z.object({
      signalType: signalTypeEnum,
      polarity: polarityEnum,
      confidence: z.number().min(0).max(1),
      evidenceQuote: z.string().max(200),
    })
  ),
});

export type ExtractedSignalOutput = z.infer<typeof extractedSignalSchema>;

// ---- Call brief output (from /api/ai/brief) ----

export const callBriefSchema = z.object({
  summary: z.string(),
  talkingPoints: z.array(z.string()),
  likelyObjections: z.array(
    z.object({
      objection: z.string(),
      response: z.string(),
    })
  ),
});

export type CallBriefOutput = z.infer<typeof callBriefSchema>;

// ---- Message draft output (from /api/ai/draft) ----

export const messageDraftSchema = z.object({
  subject: z.string().optional(),
  body: z.string(),
});

export type MessageDraftOutput = z.infer<typeof messageDraftSchema>;
