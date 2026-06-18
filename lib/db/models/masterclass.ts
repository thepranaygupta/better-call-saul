import mongoose, { Schema, type Document } from 'mongoose';

export interface IMasterclass extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  pitchStartMinute: number;
  offerPriceINR: number;
  status: 'scheduled' | 'live' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const masterclassSchema = new Schema<IMasterclass>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    pitchStartMinute: { type: Number, required: true },
    offerPriceINR: { type: Number, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'completed'],
      default: 'scheduled',
    },
  },
  { timestamps: true },
);

export const MasterclassModel =
  mongoose.models.Masterclass ||
  mongoose.model<IMasterclass>('Masterclass', masterclassSchema);
