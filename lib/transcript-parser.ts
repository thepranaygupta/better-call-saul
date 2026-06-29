const AGENT_LABELS = ['agent', 'bda', 'rep', 'caller'];
const CUSTOMER_LABELS = ['customer', 'lead', 'client', 'prospect'];
const ALL_LABELS = [...AGENT_LABELS, ...CUSTOMER_LABELS];

const SPEAKER_REGEX = new RegExp(
  `^(${ALL_LABELS.join('|')}):\\s*`,
  'i',
);

export interface TranscriptTurn {
  speaker: 'agent' | 'customer';
  text: string;
}

export function parseTranscript(raw: string): TranscriptTurn[] {
  if (!raw.trim()) return [];

  const lines = raw.split('\n');
  const turns: TranscriptTurn[] = [];
  let currentSpeaker: 'agent' | 'customer' | null = null;
  let currentText: string[] = [];

  for (const line of lines) {
    const match = line.match(SPEAKER_REGEX);

    if (match) {
      if (currentSpeaker && currentText.length > 0) {
        turns.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
      }

      const label = match[1]!.toLowerCase();
      currentSpeaker = AGENT_LABELS.includes(label) ? 'agent' : 'customer';
      currentText = [line.replace(SPEAKER_REGEX, '')];
    } else {
      currentText.push(line);
    }
  }

  if (currentSpeaker && currentText.length > 0) {
    turns.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
  }

  if (turns.length === 0 && raw.trim().length > 0) {
    throw new Error('No speaker labels found. Expected format: "Agent: ..." / "Customer: ..."');
  }

  return turns;
}
