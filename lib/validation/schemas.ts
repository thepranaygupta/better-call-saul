import { z } from 'zod';

// --- Disposition ---
export const createDispositionSchema = z.object({
  leadId: z.string().min(1),
  outcome: z.enum([
    'connected',
    'not_connected',
    'callback_scheduled',
    'not_interested',
    'enrolled',
    'wrong_number',
  ]),
  notes: z.string().max(1000).optional(),
  nextActionAt: z.coerce.date().optional(),
});
export type CreateDispositionInput = z.infer<typeof createDispositionSchema>;

// --- Lead outcome ---
export const updateLeadOutcomeSchema = z.object({
  leadId: z.string().min(1),
  outcome: z.enum(['enrolled', 'not_enrolled', 'undecided']),
});
export type UpdateLeadOutcomeInput = z.infer<typeof updateLeadOutcomeSchema>;

// --- AI: Call brief ---
export const generateBriefSchema = z.object({
  leadId: z.string().min(1),
  language: z.enum(['en', 'hi', 'hinglish']),
});
export type GenerateBriefInput = z.infer<typeof generateBriefSchema>;

// --- AI: Message draft ---
export const generateDraftSchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(['whatsapp', 'email', 'sms']),
  language: z.enum(['en', 'hi', 'hinglish']),
});
export type GenerateDraftInput = z.infer<typeof generateDraftSchema>;

// --- Admin: Project ---
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// --- Admin: User ---
export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'sales_lead', 'bda']),
  assignedProjectIds: z.array(z.string()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// --- Admin: Update user ---
export const updateUserSchema = z.object({
  role: z.enum(['admin', 'sales_lead', 'bda']).optional(),
  assignedProjectIds: z.array(z.string()).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// --- Bulk lead import ---
export const bulkLeadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(1).max(30),
  projectId: z.string().min(1),
  masterclassId: z.string().min(1),
  occupationType: z.enum(['working_professional', 'student', 'other']),
  jobTitle: z.string().max(200).optional(),
  seniority: z.enum(['junior', 'mid', 'senior', 'unknown']).optional(),
  city: z.string().max(200).optional(),
  sourceChannel: z.enum([
    'referral',
    'email',
    'paid_search',
    'paid_social',
    'organic',
    'other',
  ]),
  isExistingCustomer: z.boolean().optional().default(false),
});
export type BulkLeadInput = z.infer<typeof bulkLeadSchema>;

export const bulkLeadImportSchema = z.object({
  leads: z.array(bulkLeadSchema).min(1).max(5000),
});
export type BulkLeadImportInput = z.infer<typeof bulkLeadImportSchema>;

// --- Lead assignment ---
export const assignLeadSchema = z.object({
  leadId: z.string().min(1),
  bdaId: z.string().min(1).nullable(),
});
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

export const bulkAssignLeadsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  bdaId: z.string().min(1).nullable(),
});
export type BulkAssignLeadsInput = z.infer<typeof bulkAssignLeadsSchema>;

// --- Admin: Scoring config ---
export const updateScoringConfigSchema = z.object({
  projectId: z.string().optional(),
  fitWeights: z.record(z.string(), z.number()),
  intentWeights: z.record(z.string(), z.number()),
  decayHalfLifeDays: z.number().min(1).max(365),
  disqualifiers: z.array(z.string()),
  thresholds: z.object({
    hot: z.number().min(0).max(100),
    warm: z.number().min(0).max(100),
  }),
});
export type UpdateScoringConfigInput = z.infer<typeof updateScoringConfigSchema>;
