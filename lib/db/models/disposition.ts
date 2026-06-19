import mongoose, { Schema, type Document } from 'mongoose';

export interface IDisposition extends Document {
  leadId: mongoose.Types.ObjectId;
  bdaId: mongoose.Types.ObjectId;
  outcome:
    | 'connected'
    | 'not_connected'
    | 'callback_scheduled'
    | 'not_interested'
    | 'enrolled'
    | 'wrong_number';
  notes?: string;
  nextActionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dispositionSchema = new Schema<IDisposition>(
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
    outcome: {
      type: String,
      enum: [
        'connected',
        'not_connected',
        'callback_scheduled',
        'not_interested',
        'enrolled',
        'wrong_number',
      ],
      required: true,
    },
    notes: String,
    nextActionAt: Date,
  },
  { timestamps: true },
);

export const DispositionModel =
  mongoose.models.Disposition ||
  mongoose.model<IDisposition>('Disposition', dispositionSchema);
