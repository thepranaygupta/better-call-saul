import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';

export type Role = 'admin' | 'sales_lead' | 'bda';

/**
 * Require an authenticated session. Redirects to /login if no session exists.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  return session;
}

/**
 * Require an authenticated session with one of the specified roles.
 * Redirects to /login if unauthenticated; throws 403 if role doesn't match.
 */
export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role as Role)) {
    throw new Error('Forbidden');
  }
  return session;
}

/**
 * Scope a generic Mongoose query to the user's assigned projects.
 * Admins bypass scoping entirely.
 *
 * Use this for any collection that has a `projectId` field.
 */
export function scopeQueryToUser(
  session: { user: { role?: string; assignedProjectIds?: string[] } },
  query: Record<string, unknown> = {},
): Record<string, unknown> {
  if (session.user.role === 'admin') return query;

  return {
    ...query,
    projectId: { $in: session.user.assignedProjectIds ?? [] },
  };
}

/**
 * Scope a Lead query to the user's assigned projects.
 * Admins bypass scoping entirely.
 *
 * Per spec Section 5: both Sales Leads AND BDAs see ALL leads
 * in their assigned projects — NOT only leads assigned to them.
 * There is no `assignedBdaId` filter here by design.
 */
export function scopeLeadQueryToUser(
  session: { user: { id: string; role?: string; assignedProjectIds?: string[] } },
  query: Record<string, unknown> = {},
): Record<string, unknown> {
  if (session.user.role === 'admin') return query;

  // Both sales_lead and bda are scoped to their assigned projects only
  return {
    ...query,
    projectId: { $in: session.user.assignedProjectIds ?? [] },
  };
}
