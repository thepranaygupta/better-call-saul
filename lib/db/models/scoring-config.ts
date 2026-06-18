import mongoose, { Schema, type Document } from 'mongoose';

export interface IScoringConfig extends Document {
  projectId?: mongoose.Types.ObjectId;
  version: number;
  fitWeights: Record<string, number>;
  intentWeights: Record<string, number>;
  decayHalfLifeDays: number;
  disqualifiers: string[];
  thresholds: {
    hot: number;
    warm: number;
  };
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const scoringConfigSchema = new Schema<IScoringConfig>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    version: { type: Number, required: true },
    fitWeights: { type: Schema.Types.Mixed, required: true },
    intentWeights: { type: Schema.Types.Mixed, required: true },
    decayHalfLifeDays: { type: Number, required: true },
    disqualifiers: [{ type: String }],
    thresholds: {
      hot: { type: Number, required: true },
      warm: { type: Number, required: true },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

export const ScoringConfigModel =
  mongoose.models.ScoringConfig ||
  mongoose.model<IScoringConfig>('ScoringConfig', scoringConfigSchema);
