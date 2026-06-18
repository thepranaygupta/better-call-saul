import mongoose, { Schema, type Document } from 'mongoose';

export interface ILead extends Document {
  projectId: mongoose.Types.ObjectId;
  masterclassId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  occupationType: 'working_professional' | 'student' | 'other';
  jobTitle?: string;
  seniority?: 'junior' | 'mid' | 'senior' | 'unknown';
  city?: string;
  timezone?: string;
  sourceChannel:
    | 'referral'
    | 'email'
    | 'paid_search'
    | 'paid_social'
    | 'organic'
    | 'other';
  isExistingCustomer: boolean;
  assignedBdaId?: mongoose.Types.ObjectId;
  outcome: 'enrolled' | 'not_enrolled' | 'undecided';
  fitScore: number;
  intentScore: number;
  band: 'call_now' | 'qualify' | 'nurture' | 'cold' | 'disqualified';
  lastScoredAt?: Date;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    masterclassId: {
      type: Schema.Types.ObjectId,
      ref: 'Masterclass',
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    occupationType: {
      type: String,
      enum: ['working_professional', 'student', 'other'],
      required: true,
    },
    jobTitle: String,
    seniority: { type: String, enum: ['junior', 'mid', 'senior', 'unknown'] },
    city: String,
    timezone: String,
    sourceChannel: {
      type: String,
      enum: [
        'referral',
        'email',
        'paid_search',
        'paid_social',
        'organic',
        'other',
      ],
      required: true,
    },
    isExistingCustomer: { type: Boolean, default: false },
    assignedBdaId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    outcome: {
      type: String,
      enum: ['enrolled', 'not_enrolled', 'undecided'],
      default: 'undecided',
    },
    fitScore: { type: Number, default: 0 },
    intentScore: { type: Number, default: 0 },
    band: {
      type: String,
      enum: ['call_now', 'qualify', 'nurture', 'cold', 'disqualified'],
      default: 'cold',
      index: true,
    },
    lastScoredAt: Date,
    registeredAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const LeadModel =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', leadSchema);
