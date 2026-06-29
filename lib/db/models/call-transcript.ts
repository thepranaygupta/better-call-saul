import mongoose, { Schema, type Document } from 'mongoose';

export interface ICallTranscript extends Document {
  leadId: mongoose.Types.ObjectId;
  bdaId: mongoose.Types.ObjectId;
  turns: { speaker: 'agent' | 'customer'; text: string }[];
  language?: string;
  extractedSignalIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const callTranscriptSchema = new Schema<ICallTranscript>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    bdaId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    turns: [
      {
        speaker: { type: String, enum: ['agent', 'customer'], required: true },
        text: { type: String, required: true },
      },
    ],
    language: String,
    extractedSignalIds: [
      { type: Schema.Types.ObjectId, ref: 'ExtractedSignal' },
    ],
  },
  { timestamps: true },
);

export const CallTranscriptModel =
  mongoose.models.CallTranscript ||
  mongoose.model<ICallTranscript>('CallTranscript', callTranscriptSchema);
