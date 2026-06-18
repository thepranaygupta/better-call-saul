'use server';

import { requireRole } from '@/lib/auth/rbac';
import { connectDB } from '@/lib/db/connection';
import {
  ProjectModel,
  UserModel,
  ScoringConfigModel,
  LeadModel,
  ActivityModel,
  ExtractedSignalModel,
  ScoreSnapshotModel,
  MasterclassModel,
} from '@/lib/db/models';
import type { ILead } from '@/lib/db/models';
import {
  createProjectSchema,
  createUserSchema,
  updateScoringConfigSchema,
} from '@/lib/validation/schemas';
import { scoreLead } from '@/lib/scoring';
import type {
  ActivityInput,
  LeadInput,
  ScoringConfig,
  SignalInput,
} from '@/lib/scoring';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';

// --- Serialized types for client consumption ---

export interface SerializedProject {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface SerializedUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'sales_lead' | 'bda';
  assignedProjectIds: string[];
  createdAt: string;
}

// --- Server actions ---

export async function getProjects(): Promise<SerializedProject[]> {
  await requireRole('admin');
  await connectDB();
  const projects = await ProjectModel.find().sort({ createdAt: -1 }).lean();
  return JSON.parse(JSON.stringify(projects)) as SerializedProject[];
}

export async function createProject(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  await requireRole('admin');

  const parsed = createProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await connectDB();

  // Check for duplicate slug
  const existing = await (ProjectModel as any).findOne({ slug: parsed.data.slug }).lean();
  if (existing) {
    return { success: false, error: 'A project with this slug already exists' };
  }

  await (ProjectModel as any).create({ ...parsed.data, active: true });
  revalidatePath('/admin');
  return { success: true };
}

export async function toggleProjectActive(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole('admin');
  await connectDB();

  const project = await (ProjectModel as any).findById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  project.active = !project.active;
  await project.save();
  revalidatePath('/admin');
  return { success: true };
}

export async function getUsers(): Promise<SerializedUser[]> {
  await requireRole('admin');
  await connectDB();
  const users = await UserModel.find()
    .select('-passwordHash')
    .sort({ createdAt: -1 })
    .lean();
  return JSON.parse(JSON.stringify(users)) as SerializedUser[];
}

export async function createUser(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole('admin');

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await connectDB();

  // Check for duplicate email
  const existing = await (UserModel as any).findOne({ email: parsed.data.email }).lean();
  if (existing) {
    return { success: false, error: 'A user with this email already exists' };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const newUser = await (UserModel as any).create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
    assignedProjectIds: parsed.data.assignedProjectIds,
  });

  await logAudit(session.user.id, 'create_user', 'user', String(newUser._id), {
    email: parsed.data.email,
    role: parsed.data.role,
  });

  revalidatePath('/admin');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Scoring config actions
// ---------------------------------------------------------------------------

export interface ScoringConfigData {
  _id: string;
  projectId?: string;
  version: number;
  fitWeights: Record<string, number>;
  intentWeights: Record<string, number>;
  decayHalfLifeDays: number;
  disqualifiers: string[];
  thresholds: { hot: number; warm: number };
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

/**
 * Get the latest scoring config version for a project (or global if no projectId).
 */
export async function getScoringConfig(
  projectId?: string,
): Promise<ScoringConfigData | null> {
  await requireRole('admin');
  await connectDB();

  const filter = projectId
    ? { projectId }
    : { projectId: { $exists: false } };

  const config = await (ScoringConfigModel as any).findOne(filter)
    .sort({ version: -1 })
    .lean();

  if (!config) return null;
  return JSON.parse(JSON.stringify(config)) as ScoringConfigData;
}

/**
 * Get all versions of a scoring config for history display.
 */
export async function getScoringConfigHistory(
  projectId?: string,
): Promise<ScoringConfigData[]> {
  await requireRole('admin');
  await connectDB();

  const filter = projectId
    ? { projectId }
    : { projectId: { $exists: false } };

  const configs = await (ScoringConfigModel as any).find(filter)
    .sort({ version: -1 })
    .limit(20)
    .lean();

  return JSON.parse(JSON.stringify(configs)) as ScoringConfigData[];
}

/**
 * Save a new scoring config version. Auto-increments the version number.
 */
export async function updateScoringConfig(
  data: unknown,
): Promise<{ version: number }> {
  const session = await requireRole('admin');
  const parsed = updateScoringConfigSchema.parse(data);
  await connectDB();

  const filter = parsed.projectId
    ? { projectId: parsed.projectId }
    : { projectId: { $exists: false } };

  const current = await (ScoringConfigModel as any).findOne(filter)
    .sort({ version: -1 })
    .lean();

  const newVersion = (current?.version ?? 0) + 1;

  const newConfig = await (ScoringConfigModel as any).create({
    ...parsed,
    version: newVersion,
    updatedBy: session.user.id,
    updatedAt: new Date(),
  });

  await logAudit(
    session.user.id,
    'update_scoring_config',
    'scoring_config',
    String(newConfig._id),
    { version: newVersion },
  );

  revalidatePath('/admin/scoring');
  return { version: newVersion };
}

/**
 * Re-score all leads (optionally scoped to a project).
 * Fetches config, then for each lead: fetch activities + signals, run scoreLead(),
 * update lead scores, and create ScoreSnapshots.
 *
 * In production this would be a background job. For demo: process in chunks of 50.
 */
export async function rescoreAllLeads(
  projectId?: string,
): Promise<{ rescored: number }> {
  await requireRole('admin');
  await connectDB();

  const configFilter = projectId
    ? { projectId }
    : { projectId: { $exists: false } };
  const configDoc = await (ScoringConfigModel as any).findOne(configFilter)
    .sort({ version: -1 })
    .lean();

  if (!configDoc) {
    throw new Error('No scoring config found. Save a config first.');
  }

  const config: ScoringConfig = {
    fitWeights: configDoc.fitWeights as Record<string, number>,
    intentWeights: configDoc.intentWeights as Record<string, number>,
    decayHalfLifeDays: configDoc.decayHalfLifeDays as number,
    disqualifiers: configDoc.disqualifiers as string[],
    thresholds: configDoc.thresholds as { hot: number; warm: number },
  };

  const leadFilter = projectId ? { projectId } : {};
  const leads = (await (LeadModel as any).find(leadFilter).lean()) as ILead[];

  if (leads.length === 0) {
    return { rescored: 0 };
  }

  const now = new Date();
  const CHUNK_SIZE = 50;
  let rescored = 0;

  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    const chunk = leads.slice(i, i + CHUNK_SIZE);

    const bulkLeadOps: any[] = [];
    const snapshotsToInsert: any[] = [];

    await Promise.all(
      chunk.map(async (lead) => {
        const leadId = lead._id;

        const [activities, signals] = await Promise.all([
          (ActivityModel as any).find({ leadId }).lean(),
          (ExtractedSignalModel as any).find({ leadId }).lean(),
        ]);

        const masterclass = await (MasterclassModel as any).findById(
          lead.masterclassId,
        ).lean();

        const leadInput: LeadInput = {
          occupationType: lead.occupationType,
          seniority: lead.seniority ?? undefined,
          sourceChannel: lead.sourceChannel,
          isExistingCustomer: lead.isExistingCustomer,
          email: lead.email,
          masterclassPitchStartMinute: masterclass
            ? (masterclass.pitchStartMinute as number)
            : undefined,
          masterclassDurationMinutes: masterclass
            ? (masterclass.durationMinutes as number)
            : undefined,
        };

        const activityInputs: ActivityInput[] = (activities as any[]).map((a: any) => ({
          type: a.type,
          numericValue: a.numericValue ?? undefined,
          occurredAt: new Date(a.occurredAt),
        }));

        const signalInputs: SignalInput[] = (signals as any[]).map((s: any) => ({
          signalType: s.signalType,
          polarity: s.polarity,
          confidence: s.confidence,
          extractedAt: new Date(s.extractedAt),
        }));

        const result = scoreLead(
          leadInput,
          activityInputs,
          signalInputs,
          config,
          now,
        );

        bulkLeadOps.push({
          updateOne: {
            filter: { _id: leadId },
            update: {
              $set: {
                fitScore: result.fitScore,
                intentScore: result.intentScore,
                band: result.band,
                lastScoredAt: now,
              },
            },
          },
        });

        snapshotsToInsert.push({
          leadId,
          fitScore: result.fitScore,
          intentScore: result.intentScore,
          band: result.band,
          contributions: result.contributions,
          computedAt: now,
        });
      }),
    );

    if (bulkLeadOps.length > 0) {
      await (LeadModel as any).bulkWrite(bulkLeadOps);
    }
    if (snapshotsToInsert.length > 0) {
      await (ScoreSnapshotModel as any).insertMany(snapshotsToInsert);
    }

    rescored += chunk.length;
  }

  revalidatePath('/queue');
  revalidatePath('/analytics');
  revalidatePath('/admin/scoring');

  return { rescored };
}
