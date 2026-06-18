import mongoose, { Schema, type Document } from 'mongoose';

export interface IMessageDraft extends Document {
  leadId: mongoose.Types.ObjectId;
  channel: 'whatsapp' | 'email' | 'sms';
  language: 'en' | 'hi' | 'hinglish';
  subject?: string;
  body: string;
  modelUsed: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageDraftSchema = new Schema<IMessageDraft>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'email', 'sms'],
      required: true,
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'hinglish'],
      required: true,
    },
    subject: String,
    body: { type: String, required: true },
    modelUsed: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const MessageDraftModel =
  mongoose.models.MessageDraft ||
  mongoose.model<IMessageDraft>('MessageDraft', messageDraftSchema);
