import { connectDB } from '@/lib/db/connection';
import { AuditLogModel } from '@/lib/db/models';

/**
 * Log an auditable action. Uses fire-and-forget when called with `void`
 * on read paths (e.g. viewing a lead) to avoid slowing down page loads.
 *
 * On write paths (dispositions, config changes, user creation) it is
 * safe to `await` so errors surface.
 */
export async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await connectDB();
    await AuditLogModel.create({
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date(),
    });
  } catch (err) {
    // Audit logging must never crash the main request.
    // In production this would go to an external logger (e.g. Sentry).
    console.error('[audit] Failed to write audit log entry:', err);
  }
}
