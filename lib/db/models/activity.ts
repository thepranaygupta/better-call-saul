import mongoose, { Schema, type Document } from 'mongoose';

export interface IActivity extends Document {
  leadId: mongoose.Types.ObjectId;
  type:
    | 'registered'
    | 'attended_live'
    | 'watched_replay'
    | 'no_show'
    | 'watch_percentage'
    | 'chat_message'
    | 'question_asked'
    | 'poll_response'
    | 'clicked_offer'
    | 'reregistered'
    | 'unsubscribed';
  numericValue?: number;
  text?: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'registered',
        'attended_live',
        'watched_replay',
        'no_show',
        'watch_percentage',
        'chat_message',
        'question_asked',
        'poll_response',
        'clicked_offer',
        'reregistered',
        'unsubscribed',
      ],
      required: true,
    },
    numericValue: Number,
    text: String,
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ActivityModel =
  mongoose.models.Activity ||
  mongoose.model<IActivity>('Activity', activitySchema);
