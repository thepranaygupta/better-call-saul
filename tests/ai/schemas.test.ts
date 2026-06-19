import { describe, it, expect } from 'vitest';
import {
  extractedSignalSchema,
  callBriefSchema,
  messageDraftSchema,
} from '@/lib/ai/schemas';

// ---------------------------------------------------------------------------
// AI Zod schema tests — verify that the schemas enforce the contracts
// from Section 6 / Section 8 of the spec.
// ---------------------------------------------------------------------------

describe('extractedSignalSchema', () => {
  it('accepts a valid signal array', () => {
    const input = {
      signals: [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 0.95,
          evidenceQuote: 'Can I pay in EMI?',
        },
        {
          signalType: 'price_objection',
          polarity: 'negative',
          confidence: 0.7,
          evidenceQuote: 'Too expensive for me',
        },
      ],
    };
    const result = extractedSignalSchema.parse(input);
    expect(result.signals).toHaveLength(2);
    expect(result.signals[0]!.signalType).toBe('asked_emi');
  });

  it('rejects invalid signalType (not in enum)', () => {
    const input = {
      signals: [
        {
          signalType: 'invented_type',
          polarity: 'positive',
          confidence: 0.5,
          evidenceQuote: 'test',
        },
      ],
    };
    expect(() => extractedSignalSchema.parse(input)).toThrow();
  });

  it('rejects confidence above 1', () => {
    const input = {
      signals: [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: 1.5,
          evidenceQuote: 'test',
        },
      ],
    };
    expect(() => extractedSignalSchema.parse(input)).toThrow();
  });

  it('rejects confidence below 0', () => {
    const input = {
      signals: [
        {
          signalType: 'asked_emi',
          polarity: 'positive',
          confidence: -0.1,
          evidenceQuote: 'test',
        },
      ],
    };
    expect(() => extractedSignalSchema.parse(input)).toThrow();
  });

  it('rejects missing required fields', () => {
    // Missing signalType
    expect(() =>
      extractedSignalSchema.parse({
        signals: [{ polarity: 'positive', confidence: 0.5, evidenceQuote: 'x' }],
      }),
    ).toThrow();

    // Missing polarity
    expect(() =>
      extractedSignalSchema.parse({
        signals: [{ signalType: 'asked_emi', confidence: 0.5, evidenceQuote: 'x' }],
      }),
    ).toThrow();

    // Missing confidence
    expect(() =>
      extractedSignalSchema.parse({
        signals: [{ signalType: 'asked_emi', polarity: 'positive', evidenceQuote: 'x' }],
      }),
    ).toThrow();

    // Missing evidenceQuote
    expect(() =>
      extractedSignalSchema.parse({
        signals: [{ signalType: 'asked_emi', polarity: 'positive', confidence: 0.5 }],
      }),
    ).toThrow();
  });

  it('accepts empty signals array', () => {
    const result = extractedSignalSchema.parse({ signals: [] });
    expect(result.signals).toEqual([]);
  });

  it('rejects invalid polarity value', () => {
    const input = {
      signals: [
        {
          signalType: 'asked_emi',
          polarity: 'maybe',
          confidence: 0.5,
          evidenceQuote: 'test',
        },
      ],
    };
    expect(() => extractedSignalSchema.parse(input)).toThrow();
  });

  it('accepts all valid signal types', () => {
    const validTypes = [
      'asked_emi', 'asked_price', 'asked_job_outcome',
      'asked_time_commitment', 'asked_refund_guarantee',
      'expressed_career_switch', 'price_objection',
      'high_enthusiasm', 'competitor_mention', 'not_interested',
    ];
    for (const signalType of validTypes) {
      const result = extractedSignalSchema.parse({
        signals: [
          { signalType, polarity: 'positive', confidence: 0.5, evidenceQuote: 'test' },
        ],
      });
      expect(result.signals[0]!.signalType).toBe(signalType);
    }
  });

  it('accepts boundary confidence values (0 and 1)', () => {
    const zero = extractedSignalSchema.parse({
      signals: [
        { signalType: 'asked_emi', polarity: 'positive', confidence: 0, evidenceQuote: 'x' },
      ],
    });
    expect(zero.signals[0]!.confidence).toBe(0);

    const one = extractedSignalSchema.parse({
      signals: [
        { signalType: 'asked_emi', polarity: 'positive', confidence: 1, evidenceQuote: 'x' },
      ],
    });
    expect(one.signals[0]!.confidence).toBe(1);
  });
});

describe('callBriefSchema', () => {
  it('accepts valid brief', () => {
    const input = {
      summary: 'High-intent professional lead',
      talkingPoints: ['Watched full masterclass', 'Asked about EMI'],
      likelyObjections: [
        { objection: 'Price too high', response: 'Offer EMI option' },
      ],
    };
    const result = callBriefSchema.parse(input);
    expect(result.summary).toBe('High-intent professional lead');
    expect(result.talkingPoints).toHaveLength(2);
    expect(result.likelyObjections).toHaveLength(1);
  });

  it('rejects missing summary', () => {
    expect(() =>
      callBriefSchema.parse({
        talkingPoints: ['point'],
        likelyObjections: [],
      }),
    ).toThrow();
  });

  it('rejects missing talkingPoints', () => {
    expect(() =>
      callBriefSchema.parse({
        summary: 'Test',
        likelyObjections: [],
      }),
    ).toThrow();
  });

  it('rejects missing likelyObjections', () => {
    expect(() =>
      callBriefSchema.parse({
        summary: 'Test',
        talkingPoints: ['point'],
      }),
    ).toThrow();
  });

  it('accepts brief with empty arrays', () => {
    const result = callBriefSchema.parse({
      summary: 'Minimal brief',
      talkingPoints: [],
      likelyObjections: [],
    });
    expect(result.talkingPoints).toEqual([]);
    expect(result.likelyObjections).toEqual([]);
  });

  it('rejects objection missing response field', () => {
    expect(() =>
      callBriefSchema.parse({
        summary: 'Test',
        talkingPoints: [],
        likelyObjections: [{ objection: 'Too expensive' }],
      }),
    ).toThrow();
  });
});

describe('messageDraftSchema', () => {
  it('accepts draft with subject (email)', () => {
    const result = messageDraftSchema.parse({
      subject: 'Follow up on Be10X masterclass',
      body: 'Hi, thanks for attending...',
    });
    expect(result.subject).toBe('Follow up on Be10X masterclass');
    expect(result.body).toBe('Hi, thanks for attending...');
  });

  it('accepts draft without subject (whatsapp/sms)', () => {
    const result = messageDraftSchema.parse({
      body: 'Hi! Thanks for attending the masterclass. Would you like to learn more about the course?',
    });
    expect(result.subject).toBeUndefined();
    expect(result.body).toBeDefined();
  });

  it('rejects missing body', () => {
    expect(() =>
      messageDraftSchema.parse({
        subject: 'Hello',
      }),
    ).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => messageDraftSchema.parse({})).toThrow();
  });

  it('accepts draft with empty subject string', () => {
    const result = messageDraftSchema.parse({
      subject: '',
      body: 'Message content',
    });
    expect(result.subject).toBe('');
  });
});
