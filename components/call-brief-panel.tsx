'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

type Language = 'en' | 'hi' | 'hinglish';

interface CallBrief {
  summary: string;
  talkingPoints: string[];
  likelyObjections: { objection: string; response: string }[];
  language: Language;
  generatedAt: string;
  cached: boolean;
}

interface CallBriefPanelProps {
  leadId: string;
  isAIAvailable: boolean;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'hi', label: 'HI' },
  { value: 'hinglish', label: 'HINGLISH' },
];

export function CallBriefPanel({ leadId, isAIAvailable: aiAvailable }: CallBriefPanelProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [brief, setBrief] = useState<Record<Language, CallBrief | null>>({
    en: null,
    hi: null,
    hinglish: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBrief = brief[language];

  useEffect(() => {
    async function loadCached() {
      for (const lang of ['en', 'hi', 'hinglish'] as Language[]) {
        try {
          const res = await fetch(`/api/ai/brief?leadId=${leadId}&language=${lang}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.brief) setBrief((prev) => ({ ...prev, [lang]: data.brief as CallBrief }));
        } catch { /* no cached brief for this language */ }
      }
    }
    loadCached();
  }, [leadId]);

  const generateBrief = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, language }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      setBrief((prev) => ({
        ...prev,
        [language]: data.brief as CallBrief,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      setLoading(false);
    }
  }, [leadId, language]);

  return (
    <div className="border border-stone-200 bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          AI CALL BRIEF
        </span>
      </div>

      <div className="space-y-3 p-4">
        {/* Language selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            LANGUAGE
          </span>
          <div className="flex gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                disabled={!aiAvailable}
                className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  language === lang.value
                    ? 'bg-stone-950 text-white'
                    : 'text-stone-400 hover:text-stone-600'
                } ${!aiAvailable ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI unavailable state */}
        {!aiAvailable && (
          <div className="flex flex-col items-center justify-center border border-dashed border-stone-200 py-6">
            <p className="text-xs text-stone-400">
              AI is not configured. Call briefs require Azure OpenAI credentials.
            </p>
            <p className="mt-1 text-[10px] text-stone-400">
              The queue, scoring, and dispositions work without AI.
            </p>
          </div>
        )}

        {/* Generate button + loading state */}
        {aiAvailable && !currentBrief && !loading && (
          <div className="flex flex-col items-center justify-center border border-dashed border-stone-200 py-6">
            <p className="text-xs text-stone-400">
              Generate a call prep brief for this lead
            </p>
            <Button
              onClick={generateBrief}
              className="mt-2 h-7 bg-amber-700 text-[11px] font-semibold text-white hover:bg-amber-800"
            >
              Generate brief
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center border border-dashed border-stone-200 py-6">
            <div className="flex items-center gap-2">
              <div className="size-3 animate-spin rounded-full border-2 border-stone-300 border-t-amber-700" />
              <p className="text-xs text-stone-500">Generating brief...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-800">{error}</p>
            <button
              onClick={generateBrief}
              className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700 hover:text-amber-800"
            >
              RETRY
            </button>
          </div>
        )}

        {/* Brief content */}
        {currentBrief && !loading && (
          <div className="space-y-4">
            {/* Summary */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                SUMMARY
              </span>
              <p className="mt-1 text-[13px] leading-relaxed text-stone-800">
                {currentBrief.summary}
              </p>
            </div>

            {/* Talking Points */}
            {currentBrief.talkingPoints.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                  TALKING POINTS
                </span>
                <ul className="mt-1 space-y-1">
                  {currentBrief.talkingPoints.map((point, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] leading-relaxed text-stone-700"
                    >
                      <span className="mt-0.5 shrink-0 text-amber-700">&bull;</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Objections */}
            {currentBrief.likelyObjections.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                  LIKELY OBJECTIONS
                </span>
                <div className="mt-1 space-y-2">
                  {currentBrief.likelyObjections.map((obj, i) => (
                    <div key={i} className="border-l-2 border-stone-200 pl-3">
                      <p className="text-[12px] font-medium text-stone-800">
                        &ldquo;{obj.objection}&rdquo;
                      </p>
                      <p className="mt-0.5 text-[12px] text-stone-600">
                        {obj.response}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regenerate + metadata */}
            <div className="flex items-center justify-between border-t border-stone-100 pt-2">
              <span className="text-[10px] text-stone-400">
                {currentBrief.cached ? 'Cached' : 'Generated'}{' '}
                {new Date(currentBrief.generatedAt).toLocaleString()}
              </span>
              <button
                onClick={generateBrief}
                className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 hover:text-amber-800"
              >
                REGENERATE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
