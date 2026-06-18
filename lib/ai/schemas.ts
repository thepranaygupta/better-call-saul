import { z } from 'zod';

// ---- Signal extraction output (from /api/ai/extract) ----

export const signalTypeEnum = z.enum([
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
