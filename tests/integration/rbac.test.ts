import { describe, it, expect, vi } from 'vitest';

// Mock the auth config to avoid importing next-auth / next/server in vitest
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

import { scopeQueryToUser, scopeLeadQueryToUser } from '@/lib/auth/rbac';

// ---------------------------------------------------------------------------
// RBAC scoping – integration tests
// ---------------------------------------------------------------------------
// These tests verify that query-scoping helpers enforce project boundaries
// per the spec (Section 5). Admins bypass scoping; sales_lead and BDA are
// restricted to their assignedProjectIds.
// ---------------------------------------------------------------------------

describe('scopeQueryToUser (generic collection scoping)', () => {
  it('admin bypasses scoping — returns the original query unchanged', () => {
    const session = { user: { role: 'admin' as const, assignedProjectIds: [] } };
    const base = { status: 'active' };
    const query = scopeQueryToUser(session, base);
    expect(query).toEqual({ status: 'active' });
    expect(query).not.toHaveProperty('projectId');
  });

  it('BDA query is scoped to assigned projects', () => {
    const session = {
      user: { role: 'bda' as const, assignedProjectIds: ['p1', 'p2'] },
    };
    const query = scopeQueryToUser(session);
    expect(query.projectId).toEqual({ $in: ['p1', 'p2'] });
  });

  it('sales_lead query is scoped to assigned projects', () => {
    const session = {
      user: { role: 'sales_lead' as const, assignedProjectIds: ['p3'] },
    };
    const query = scopeQueryToUser(session);
    expect(query.projectId).toEqual({ $in: ['p3'] });
  });

  it('preserves existing query filters when scoping', () => {
    const session = {
      user: { role: 'bda' as const, assignedProjectIds: ['p1'] },
    };
    const query = scopeQueryToUser(session, { status: 'completed' });
    expect(query).toEqual({
      status: 'completed',
      projectId: { $in: ['p1'] },
    });
  });

  it('defaults to empty $in when assignedProjectIds is missing', () => {
    const session = { user: { role: 'bda' as const } };
    const query = scopeQueryToUser(session);
    expect(query.projectId).toEqual({ $in: [] });
  });
});

describe('scopeLeadQueryToUser (Lead-specific scoping)', () => {
  it('admin sees all leads — no projectId filter applied', () => {
    const session = {
      user: { id: 'admin1', role: 'admin' as const, assignedProjectIds: [] },
    };
    const query = scopeLeadQueryToUser(session);
    expect(query).toEqual({});
  });

  it('BDA query is scoped to assigned projects (no assignedBdaId filter)', () => {
    const session = {
      user: { id: 'bda1', role: 'bda' as const, assignedProjectIds: ['p1', 'p2'] },
    };
    const query = scopeLeadQueryToUser(session);
    expect(query.projectId).toEqual({ $in: ['p1', 'p2'] });
    // Per spec Section 5: BDAs see ALL leads in their assigned projects,
    // not only leads assigned to them. No assignedBdaId filter.
    expect(query).not.toHaveProperty('assignedBdaId');
  });

  it('sales_lead query is scoped to assigned projects only', () => {
    const session = {
      user: { id: 'sl1', role: 'sales_lead' as const, assignedProjectIds: ['p1'] },
    };
    const query = scopeLeadQueryToUser(session);
    expect(query.projectId).toEqual({ $in: ['p1'] });
    expect(query).not.toHaveProperty('assignedBdaId');
  });

  it('BDA with no assigned projects sees nothing', () => {
    const session = {
      user: { id: 'bda2', role: 'bda' as const, assignedProjectIds: [] },
    };
    const query = scopeLeadQueryToUser(session);
    expect(query.projectId).toEqual({ $in: [] });
  });

  it('preserves existing query filters when scoping lead queries', () => {
    const session = {
      user: { id: 'bda1', role: 'bda' as const, assignedProjectIds: ['p1'] },
    };
    const query = scopeLeadQueryToUser(session, { band: 'call_now' });
    expect(query).toEqual({
      band: 'call_now',
      projectId: { $in: ['p1'] },
    });
  });

  it('admin query preserves base filters without adding projectId', () => {
    const session = {
      user: { id: 'admin1', role: 'admin' as const, assignedProjectIds: [] },
    };
    const query = scopeLeadQueryToUser(session, { band: 'call_now' });
    expect(query).toEqual({ band: 'call_now' });
  });
});
