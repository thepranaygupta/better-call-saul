import { describe, it, expect } from 'vitest';
import {
  createDispositionSchema,
  createUserSchema,
  createProjectSchema,
  generateBriefSchema,
  generateDraftSchema,
  updateLeadOutcomeSchema,
  updateScoringConfigSchema,
} from '@/lib/validation/schemas';

// ---------------------------------------------------------------------------
// Zod validation – integration tests
// ---------------------------------------------------------------------------
// These tests verify that Zod schemas reject invalid input, strip unknown
// fields, and accept well-formed data at every mutation boundary.
// ---------------------------------------------------------------------------

describe('createDispositionSchema', () => {
  it('rejects disposition with invalid outcome', () => {
    expect(() =>
      createDispositionSchema.parse({
        leadId: '123',
        outcome: 'hacked',
      }),
    ).toThrow();
  });

  it('rejects disposition with empty leadId', () => {
    expect(() =>
      createDispositionSchema.parse({
        leadId: '',
        outcome: 'connected',
      }),
    ).toThrow();
  });

  it('rejects disposition with missing required fields', () => {
    expect(() =>
      createDispositionSchema.parse({
        notes: 'some note',
      }),
    ).toThrow();
  });

  it('strips unknown fields (no malicious payload passthrough)', () => {
    const result = createDispositionSchema.parse({
      leadId: '123',
      outcome: 'connected',
      malicious: 'payload',
      $where: 'db.dropDatabase()',
    });
    expect((result as Record<string, unknown>).malicious).toBeUndefined();
    expect((result as Record<string, unknown>).$where).toBeUndefined();
  });

  it('accepts valid disposition with all optional fields', () => {
    const result = createDispositionSchema.parse({
      leadId: '123',
      outcome: 'enrolled',
      notes: 'Paid full amount',
      nextActionAt: '2026-06-20T10:00:00Z',
    });
    expect(result.outcome).toBe('enrolled');
    expect(result.notes).toBe('Paid full amount');
    expect(result.nextActionAt).toBeInstanceOf(Date);
  });

  it('accepts valid disposition with minimal fields', () => {
    const result = createDispositionSchema.parse({
      leadId: 'abc',
      outcome: 'not_connected',
    });
    expect(result.outcome).toBe('not_connected');
    expect(result.notes).toBeUndefined();
  });

  it('rejects notes exceeding 1000 characters', () => {
    expect(() =>
      createDispositionSchema.parse({
        leadId: '123',
        outcome: 'connected',
        notes: 'x'.repeat(1001),
      }),
    ).toThrow();
  });

  it('accepts all valid outcome values', () => {
    const validOutcomes = [
      'connected',
      'not_connected',
      'callback_scheduled',
      'not_interested',
      'enrolled',
      'wrong_number',
    ];
    for (const outcome of validOutcomes) {
      const result = createDispositionSchema.parse({ leadId: '1', outcome });
      expect(result.outcome).toBe(outcome);
    }
  });
});

describe('createUserSchema', () => {
  it('rejects user with short password (< 8 chars)', () => {
    expect(() =>
      createUserSchema.parse({
        name: 'Test',
        email: 'a@b.com',
        password: '123',
        role: 'bda',
      }),
    ).toThrow();
  });

  it('rejects user with invalid email', () => {
    expect(() =>
      createUserSchema.parse({
        name: 'Test',
        email: 'not-an-email',
        password: 'password123',
        role: 'bda',
      }),
    ).toThrow();
  });

  it('rejects user with invalid role', () => {
    expect(() =>
      createUserSchema.parse({
        name: 'Test',
        email: 'a@b.com',
        password: 'password123',
        role: 'superadmin',
      }),
    ).toThrow();
  });

  it('rejects user with empty name', () => {
    expect(() =>
      createUserSchema.parse({
        name: '',
        email: 'a@b.com',
        password: 'password123',
        role: 'bda',
      }),
    ).toThrow();
  });

  it('accepts valid user with defaults', () => {
    const result = createUserSchema.parse({
      name: 'Jane Doe',
      email: 'jane@company.com',
      password: 'securepass',
      role: 'sales_lead',
    });
    expect(result.name).toBe('Jane Doe');
    expect(result.role).toBe('sales_lead');
    expect(result.assignedProjectIds).toEqual([]);
  });

  it('accepts valid user with assigned projects', () => {
    const result = createUserSchema.parse({
      name: 'BDA User',
      email: 'bda@company.com',
      password: 'securepass',
      role: 'bda',
      assignedProjectIds: ['proj1', 'proj2'],
    });
    expect(result.assignedProjectIds).toEqual(['proj1', 'proj2']);
  });

  it('accepts all valid role values', () => {
    const roles = ['admin', 'sales_lead', 'bda'] as const;
    for (const role of roles) {
      const result = createUserSchema.parse({
        name: 'User',
        email: 'u@b.com',
        password: 'password123',
        role,
      });
      expect(result.role).toBe(role);
    }
  });
});

describe('createProjectSchema', () => {
  it('rejects project with invalid slug (uppercase)', () => {
    expect(() =>
      createProjectSchema.parse({
        name: 'Be10X',
        slug: 'Be10X',
      }),
    ).toThrow();
  });

  it('rejects project with slug containing spaces', () => {
    expect(() =>
      createProjectSchema.parse({
        name: 'Be10X',
        slug: 'be 10x',
      }),
    ).toThrow();
  });

  it('accepts valid project with lowercase-hyphenated slug', () => {
    const result = createProjectSchema.parse({
      name: 'Be10X',
      slug: 'be10x',
      description: 'AI skills brand',
    });
    expect(result.slug).toBe('be10x');
  });

  it('rejects project with empty name', () => {
    expect(() =>
      createProjectSchema.parse({
        name: '',
        slug: 'test',
      }),
    ).toThrow();
  });
});

describe('generateBriefSchema', () => {
  it('rejects brief request with invalid language', () => {
    expect(() =>
      generateBriefSchema.parse({
        leadId: '123',
        language: 'french',
      }),
    ).toThrow();
  });

  it('accepts valid brief request', () => {
    const result = generateBriefSchema.parse({
      leadId: '123',
      language: 'hinglish',
    });
    expect(result.language).toBe('hinglish');
  });
});

describe('generateDraftSchema', () => {
  it('rejects draft request with invalid channel', () => {
    expect(() =>
      generateDraftSchema.parse({
        leadId: '123',
        channel: 'telegram',
        language: 'en',
      }),
    ).toThrow();
  });

  it('accepts valid draft request', () => {
    const result = generateDraftSchema.parse({
      leadId: '123',
      channel: 'whatsapp',
      language: 'hi',
    });
    expect(result.channel).toBe('whatsapp');
    expect(result.language).toBe('hi');
  });
});

describe('updateLeadOutcomeSchema', () => {
  it('rejects invalid outcome value', () => {
    expect(() =>
      updateLeadOutcomeSchema.parse({
        leadId: '123',
        outcome: 'cancelled',
      }),
    ).toThrow();
  });

  it('accepts valid outcome', () => {
    const result = updateLeadOutcomeSchema.parse({
      leadId: '123',
      outcome: 'enrolled',
    });
    expect(result.outcome).toBe('enrolled');
  });
});

describe('updateScoringConfigSchema', () => {
  it('rejects decay half-life below 1', () => {
    expect(() =>
      updateScoringConfigSchema.parse({
        fitWeights: { working_professional: 30 },
        intentWeights: { attended_live: 20 },
        decayHalfLifeDays: 0,
        disqualifiers: [],
        thresholds: { hot: 70, warm: 40 },
      }),
    ).toThrow();
  });

  it('rejects threshold above 100', () => {
    expect(() =>
      updateScoringConfigSchema.parse({
        fitWeights: { working_professional: 30 },
        intentWeights: { attended_live: 20 },
        decayHalfLifeDays: 7,
        disqualifiers: [],
        thresholds: { hot: 150, warm: 40 },
      }),
    ).toThrow();
  });

  it('accepts valid scoring config', () => {
    const result = updateScoringConfigSchema.parse({
      fitWeights: { working_professional: 30, referral: 15 },
      intentWeights: { attended_live: 20, clicked_offer: 25 },
      decayHalfLifeDays: 7,
      disqualifiers: ['student_email_domain', 'unsubscribed'],
      thresholds: { hot: 70, warm: 40 },
    });
    expect(result.decayHalfLifeDays).toBe(7);
    expect(result.disqualifiers).toContain('unsubscribed');
  });
});
