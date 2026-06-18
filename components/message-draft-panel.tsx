'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AIUnavailable } from '@/components/ai-unavailable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, Check, Loader2, Mail, MessageSquare, Smartphone } from 'lucide-react';

type Channel = 'whatsapp' | 'email' | 'sms';
type Language = 'en' | 'hi' | 'hinglish';

interface DraftResult {
  subject?: string;
  body: string;
  cached: boolean;
}

interface MessageDraftPanelProps {
  leadId: string;
}

const CHANNEL_LABELS: Record<Channel, { label: string; icon: typeof Mail }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageSquare },
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: Smartphone },
};

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'EN',
  hi: 'HI',
  hinglish: 'HINGLISH',
};

export function MessageDraftPanel({ leadId }: MessageDraftPanelProps) {
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [language, setLanguage] = useState<Language>('en');
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDraft(null);

    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, channel, language }),
      });

      if (res.status === 503) {
        setError('ai_unavailable');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as Record<string, string>).error ?? 'Failed to generate draft',
        );
        return;
      }

      const data = (await res.json()) as DraftResult;
      setDraft(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [leadId, channel, language]);

  const handleCopy = useCallback(async () => {
    if (!draft) return;

    const text =
      draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [draft]);

  // Reset draft when channel or language changes
  const handleChannelChange = useCallback(
    (value: unknown) => {
      const ch = value as Channel;
      if (ch !== channel) {
        setChannel(ch);
        setDraft(null);
        setError(null);
      }
    },
    [channel],
  );

  return (
    <div className="border border-stone-200 bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          MESSAGE DRAFT
        </span>
      </div>

      <div className="space-y-3 p-4">
        {/* Channel tabs */}
        <Tabs
          value={channel}
          onValueChange={handleChannelChange}
        >
          <TabsList variant="line" className="gap-0">
            {(Object.entries(CHANNEL_LABELS) as [Channel, typeof CHANNEL_LABELS.whatsapp][]).map(
              ([key, { label, icon: Icon }]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest"
                >
                  <Icon className="size-3" />
                  {label}
                </TabsTrigger>
              ),
            )}
          </TabsList>

          {/* Language selector */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              LANGUAGE
            </span>
            <div className="flex gap-1">
              {(Object.entries(LANGUAGE_LABELS) as [Language, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key !== language) {
                        setLanguage(key);
                        setDraft(null);
                        setError(null);
                      }
                    }}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                      language === key
                        ? 'bg-amber-700 text-white'
                        : 'text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Content for each channel — same layout, different channel context */}
          {(['whatsapp', 'email', 'sms'] as Channel[]).map((ch) => (
            <TabsContent key={ch} value={ch}>
              {/* Generate button or result */}
              {error === 'ai_unavailable' ? (
                <AIUnavailable onRetry={generateDraft} />
              ) : error ? (
                <div className="space-y-2 py-3">
                  <p className="text-[11px] text-red-800">{error}</p>
                  <Button
                    onClick={generateDraft}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-semibold"
                  >
                    Retry
                  </Button>
                </div>
              ) : draft ? (
                <div className="mt-2 space-y-2">
                  {/* Subject line for email */}
                  {draft.subject && (
                    <div>
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                        SUBJECT
                      </span>
                      <p className="mt-0.5 text-xs font-medium text-stone-950">
                        {draft.subject}
                      </p>
                    </div>
                  )}

                  {/* Body */}
                  <div>
                    {draft.subject && (
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                        BODY
                      </span>
                    )}
                    <div className="mt-0.5 whitespace-pre-wrap border border-stone-100 bg-stone-50 p-3 text-xs leading-relaxed text-stone-800">
                      {draft.body}
                    </div>
                  </div>

                  {/* Copy + regenerate */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px] font-semibold"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-teal-700" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={generateDraft}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] font-semibold text-stone-500 hover:text-stone-700"
                    >
                      Regenerate
                    </Button>
                    {draft.cached && (
                      <span className="text-[9px] text-stone-400">cached</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <Button
                    onClick={generateDraft}
                    disabled={loading}
                    className="h-7 gap-1.5 bg-amber-700 text-[11px] font-semibold text-white hover:bg-amber-800"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate draft'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
