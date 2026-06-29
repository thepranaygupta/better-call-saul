import mongoose, { Schema, type Document } from 'mongoose';

export interface IExtractedSignal extends Document {
  leadId: mongoose.Types.ObjectId;
  sourceActivityIds: mongoose.Types.ObjectId[];
  signalType:
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
  polarity: 'positive' | 'negative' | 'neutral';
  confidence: number;
  evidenceQuote: string;
  modelUsed: string;
  extractedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const extractedSignalSchema = new Schema<IExtractedSignal>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    sourceActivityIds: [
      { type: Schema.Types.ObjectId, ref: 'Activity' },
    ],
    signalType: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    polarity: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      required: true,
    },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    evidenceQuote: { type: String, required: true },
    modelUsed: { type: String, required: true },
    extractedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ExtractedSignalModel =
  mongoose.models.ExtractedSignal ||
  mongoose.model<IExtractedSignal>('ExtractedSignal', extractedSignalSchema);
