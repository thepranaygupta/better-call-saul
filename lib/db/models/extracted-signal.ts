import mongoose, { Schema, type Document } from 'mongoose';

export interface IExtractedSignal extends Document {
  leadId: mongoose.Types.ObjectId;
  sourceActivityIds: mongoose.Types.ObjectId[];
  signalType:
    | 'asked_emi'
    | 'asked_price'
    | 'asked_job_outcome'
    | 'asked_time_commitment'
    | 'asked_refund_guarantee'
    | 'expressed_career_switch'
    | 'price_objection'
    | 'high_enthusiasm'
    | 'competitor_mention'
    | 'not_interested';
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
