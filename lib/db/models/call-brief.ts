import mongoose, { Schema, type Document } from 'mongoose';

export interface ICallBrief extends Document {
  leadId: mongoose.Types.ObjectId;
  language: 'en' | 'hi' | 'hinglish';
  summary: string;
  talkingPoints: string[];
  likelyObjections: {
    objection: string;
    response: string;
  }[];
  modelUsed: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const callBriefSchema = new Schema<ICallBrief>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'hinglish'],
      required: true,
    },
    summary: { type: String, required: true },
    talkingPoints: [{ type: String }],
    likelyObjections: [
      {
        objection: { type: String, required: true },
        response: { type: String, required: true },
      },
    ],
    modelUsed: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const CallBriefModel =
  mongoose.models.CallBrief ||
  mongoose.model<ICallBrief>('CallBrief', callBriefSchema);
