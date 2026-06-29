'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TranscriptData } from '@/app/(app)/leads/[id]/actions';

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

interface CallTranscriptSectionProps {
  leadId: string;
  leadName: string;
  transcripts: TranscriptData[];
  aiAvailable: boolean;
}

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'bengali', label: 'Bengali' },
  { value: 'other', label: 'Other' },
] as const;

type ImportPhase = 'idle' | 'importing' | 'done' | 'error';
type ExtractPhase = 'idle' | 'extracting' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Transcript card (single transcript display)
// ---------------------------------------------------------------------------

function TranscriptCard({
  transcript,
  leadId,
  leadName,
  aiAvailable,
}: {
  transcript: TranscriptData;
  leadId: string;
  leadName: string;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [extractPhase, setExtractPhase] = useState<ExtractPhase>('idle');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasSignals = transcript.extractedSignalIds.length > 0;
  const canExtract = aiAvailable && !hasSignals;

  const handleExtract = useCallback(async () => {
    setExtractPhase('extracting');
    setExtractError(null);

    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, transcriptId: transcript._id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error?.message ?? `Extraction failed (${res.status})`
        );
      }

      setExtractPhase('done');
      router.refresh();

      setTimeout(() => setExtractPhase('idle'), 3000);
    } catch (err) {
      setExtractPhase('error');
      setExtractError(
        err instanceof Error ? err.message : 'Extraction failed'
      );
      setTimeout(() => {
        setExtractPhase('idle');
        setExtractError(null);
      }, 5000);
    }
  }, [leadId, transcript._id, router]);

  const date = new Date(transcript.createdAt);
  const dateStr = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Show first 4 turns when collapsed, all when expanded
  const visibleTurns = expanded
    ? transcript.turns
    : transcript.turns.slice(0, 4);
  const hasMore = transcript.turns.length > 4;

  return (
    <div className="border border-stone-200 bg-white">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-stone-700">
            {transcript.bdaName}
          </span>
          <span className="text-[11px] text-stone-400">
            {dateStr}, {timeStr}
          </span>
          {transcript.language && (
            <span className="px-1 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-stone-400 bg-stone-50">
              {transcript.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasSignals && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-700 bg-amber-50">
              {transcript.extractedSignalIds.length} signal{transcript.extractedSignalIds.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[10px] text-stone-400">
            {transcript.turns.length} turn{transcript.turns.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Turns */}
      <div className="px-3 py-2 space-y-1.5">
        {visibleTurns.map((turn, i) => (
          <div key={i} className="flex gap-2">
            <span
              className={`shrink-0 w-[64px] text-[10px] font-semibold uppercase tracking-widest pt-0.5 ${
                turn.speaker === 'agent'
                  ? 'text-stone-400'
                  : 'text-amber-700'
              }`}
            >
              {turn.speaker === 'agent' ? transcript.bdaName.split(' ')[0] : leadName.split(' ')[0]}
            </span>
            <p
              className={`text-[13px] leading-relaxed ${
                turn.speaker === 'agent'
                  ? 'text-stone-400'
                  : 'text-stone-800'
              }`}
            >
              {turn.text}
            </p>
          </div>
        ))}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 transition-colors"
          >
            {expanded
              ? 'Show less'
              : `Show all ${transcript.turns.length} turns`}
          </button>
        )}
      </div>

      {/* Extract button (if no signals yet and AI available) */}
      {canExtract && (
        <div className="border-t border-stone-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExtract}
              disabled={extractPhase === 'extracting'}
              variant="outline"
              size="sm"
              className="h-6 border-amber-200 bg-amber-50 text-[11px] text-amber-800 hover:bg-amber-100 hover:text-amber-900 disabled:opacity-60"
            >
              {extractPhase === 'extracting' && (
                <>
                  <span className="mr-1.5 inline-block size-3 animate-spin rounded-full border-2 border-stone-300 border-t-amber-700" />
                  Extracting...
                </>
              )}
              {extractPhase === 'done' && 'Signals extracted'}
              {extractPhase === 'error' && 'Failed'}
              {extractPhase === 'idle' && 'Extract signals'}
            </Button>
            {extractPhase === 'error' && extractError && (
              <span className="text-[11px] text-red-800">{extractError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import form (paste or file upload)
// ---------------------------------------------------------------------------

function ImportForm({
  leadId,
  onImported,
}: {
  leadId: string;
  onImported: (transcriptId: string) => void;
}) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('auto');
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastTranscriptId, setLastTranscriptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.txt')) {
        setErrorMsg('Only .txt files are supported');
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result;
        if (typeof content === 'string') {
          setText(content);
          setErrorMsg(null);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read file');
      };
      reader.readAsText(file);
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (text.trim().length < 10) {
      setErrorMsg('Transcript must be at least 10 characters');
      return;
    }

    setPhase('importing');
    setErrorMsg(null);

    try {
      const body: Record<string, string> = { leadId, text };
      if (language && language !== 'auto') body.language = language;

      const res = await fetch('/api/transcripts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error?.message ?? `Import failed (${res.status})`
        );
      }

      const data = await res.json();
      setPhase('done');
      setLastTranscriptId(data.transcriptId);
      setText('');
      setLanguage('auto');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImported(data.transcriptId);

      setTimeout(() => setPhase('idle'), 3000);
    } catch (err) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
    }
  }, [leadId, text, language, onImported]);

  return (
    <div className="space-y-3">
      {/* Text input */}
      <div className="space-y-1">
        <Label
          htmlFor="transcript-text"
          className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
        >
          PASTE TRANSCRIPT
        </Label>
        <Textarea
          id="transcript-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder={'Agent: Hello, this is Rahul from Be10X.\nCustomer: Hi, I attended the masterclass yesterday...'}
          className="min-h-[100px] resize-y text-[13px] font-mono leading-relaxed"
          maxLength={50000}
        />
        <p className="text-[10px] text-stone-400">
          Use &quot;Agent:&quot; and &quot;Customer:&quot; prefixes (also accepts BDA/Rep/Lead/Client).
        </p>
      </div>

      {/* File upload */}
      <div className="space-y-1">
        <Label
          htmlFor="transcript-file"
          className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
        >
          OR UPLOAD .TXT FILE
        </Label>
        <input
          ref={fileInputRef}
          id="transcript-file"
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileChange}
          className="block w-full text-[12px] text-stone-600 file:mr-2 file:border file:border-stone-200 file:bg-stone-50 file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-stone-700 file:cursor-pointer hover:file:bg-stone-100"
        />
      </div>

      {/* Language selector */}
      <div className="space-y-1">
        <Label
          htmlFor="transcript-language"
          className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
        >
          LANGUAGE (OPTIONAL)
        </Label>
        <Select value={language} onValueChange={(v) => setLanguage(v ?? 'auto')}>
          <SelectTrigger id="transcript-language" className="h-8 w-48 text-xs">
            <SelectValue placeholder="Auto-detect" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-[11px] text-red-800">{errorMsg}</p>
      )}

      {/* Success */}
      {phase === 'done' && lastTranscriptId && (
        <p className="text-[11px] text-teal-700">
          Transcript imported successfully.
        </p>
      )}

      {/* Import button */}
      <Button
        onClick={handleImport}
        disabled={phase === 'importing' || text.trim().length < 10}
        className="h-8 bg-amber-700 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
      >
        {phase === 'importing' ? (
          <>
            <span className="mr-1.5 inline-block size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Importing...
          </>
        ) : (
          'Import'
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

export function CallTranscriptSection({
  leadId,
  leadName,
  transcripts: initialTranscripts,
  aiAvailable,
}: CallTranscriptSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const handleImported = useCallback(
    (_transcriptId: string) => {
      router.refresh();
    },
    [router]
  );

  return (
    <div className="border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          CALL TRANSCRIPTS
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 hover:text-amber-800 transition-colors"
        >
          {showForm ? 'CANCEL' : 'ADD TRANSCRIPT'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Import form (collapsible) */}
        {showForm && (
          <div className="border border-dashed border-stone-200 p-3">
            <ImportForm leadId={leadId} onImported={handleImported} />
          </div>
        )}

        {/* Transcript list */}
        {initialTranscripts.length > 0 ? (
          <div className="space-y-3">
            {initialTranscripts.map((t) => (
              <TranscriptCard
                key={t._id}
                transcript={t}
                leadId={leadId}
                leadName={leadName}
                aiAvailable={aiAvailable}
              />
            ))}
          </div>
        ) : (
          !showForm && (
            <div className="flex flex-col items-center justify-center border border-dashed border-stone-200 py-6">
              <p className="text-xs text-stone-400">
                No call transcripts yet. Add one after your next call.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
