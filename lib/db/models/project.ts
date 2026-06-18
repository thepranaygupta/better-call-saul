import mongoose, { Schema, type Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProjectModel =
  mongoose.models.Project || mongoose.model<IProject>('Project', projectSchema);
