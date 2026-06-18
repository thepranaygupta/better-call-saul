import mongoose, { Schema, type Document } from 'mongoose';

export interface IScoreSnapshotContribution {
  signal: string;
  category: 'fit' | 'intent' | 'negative';
  weight: number;
  points: number;
}

export interface IScoreSnapshot extends Document {
  leadId: mongoose.Types.ObjectId;
  fitScore: number;
  intentScore: number;
  band: 'call_now' | 'qualify' | 'nurture' | 'cold' | 'disqualified';
  contributions: IScoreSnapshotContribution[];
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scoreSnapshotSchema = new Schema<IScoreSnapshot>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    fitScore: { type: Number, required: true },
    intentScore: { type: Number, required: true },
    band: {
      type: String,
      enum: ['call_now', 'qualify', 'nurture', 'cold', 'disqualified'],
      required: true,
    },
    contributions: [
      {
        signal: { type: String, required: true },
        category: {
          type: String,
          enum: ['fit', 'intent', 'negative'],
          required: true,
        },
        weight: { type: Number, required: true },
        points: { type: Number, required: true },
      },
    ],
    computedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ScoreSnapshotModel =
  mongoose.models.ScoreSnapshot ||
  mongoose.model<IScoreSnapshot>('ScoreSnapshot', scoreSnapshotSchema);
