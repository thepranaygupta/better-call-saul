import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../lib/transcript-parser';

describe('parseTranscript', () => {
  it('parses Agent:/Customer: labels', () => {
    const raw = 'Agent: Hello\nCustomer: Hi there\nAgent: How are you?';
    const turns = parseTranscript(raw);
    expect(turns).toEqual([
      { speaker: 'agent', text: 'Hello' },
      { speaker: 'customer', text: 'Hi there' },
      { speaker: 'agent', text: 'How are you?' },
    ]);
  });

  it('normalizes BDA/Rep/Caller to agent', () => {
    const raw = 'BDA: Hi\nLead: Hello';
    const turns = parseTranscript(raw);
    expect(turns[0]!.speaker).toBe('agent');
    expect(turns[1]!.speaker).toBe('customer');
  });

  it('normalizes Lead/Client/Prospect to customer', () => {
    const raw = 'Rep: Hello\nProspect: Hi\nCaller: Follow up\nClient: Thanks';
    const turns = parseTranscript(raw);
    expect(turns[0]!.speaker).toBe('agent');
    expect(turns[1]!.speaker).toBe('customer');
    expect(turns[2]!.speaker).toBe('agent');
    expect(turns[3]!.speaker).toBe('customer');
  });

  it('handles multiline turns (text before next speaker label)', () => {
    const raw = 'Agent: Hello, this is Rahul\nfrom Be10X.\nCustomer: Oh hi!';
    const turns = parseTranscript(raw);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.text).toBe('Hello, this is Rahul\nfrom Be10X.');
    expect(turns[1]!.text).toBe('Oh hi!');
  });

  it('trims whitespace from turns', () => {
    const raw = 'Agent:  Hello  \nCustomer:  Hi  ';
    const turns = parseTranscript(raw);
    expect(turns[0]!.text).toBe('Hello');
    expect(turns[1]!.text).toBe('Hi');
  });

  it('returns empty array for empty input', () => {
    expect(parseTranscript('')).toEqual([]);
  });

  it('throws on input with no speaker labels', () => {
    expect(() => parseTranscript('just some random text without labels')).toThrow();
  });
});
