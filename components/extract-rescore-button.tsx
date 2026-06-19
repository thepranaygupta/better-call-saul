'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SparklesIcon, LoaderIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import { rescoreLead } from '@/app/(app)/leads/[id]/actions';

interface ExtractRescoreButtonProps {
  leadId: string;
  hasChatMessages: boolean;
  aiAvailable: boolean;
}

type Phase = 'idle' | 'extracting' | 'rescoring' | 'done' | 'error';

export function ExtractRescoreButton({
  leadId,
  hasChatMessages,
  aiAvailable,
}: ExtractRescoreButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signalCount, setSignalCount] = useState<number>(0);

  const handleClick = useCallback(async () => {
    setPhase('extracting');
    setErrorMessage(null);
    setSignalCount(0);

    try {
      // Step 1: Call the extraction API
      const extractRes = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });

      if (!extractRes.ok) {
        const data = await extractRes.json().catch(() => null);
        throw new Error(
          data?.error?.message ?? `Extraction failed (${extractRes.status})`
        );
      }

      const extractData = await extractRes.json();
      const extracted = extractData.signals?.length ?? 0;
      setSignalCount(extracted);

      // Step 2: Rescore the lead
      setPhase('rescoring');
      const rescoreResult = await rescoreLead(leadId);
      if (!rescoreResult.success) {
        throw new Error(rescoreResult.error ?? 'Rescoring failed');
      }

      setPhase('done');
      router.refresh();

      // Reset to idle after a brief success indication
      setTimeout(() => setPhase('idle'), 3000);
    } catch (err) {
      setPhase('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
      // Reset to idle after showing the error
      setTimeout(() => {
        setPhase('idle');
        setErrorMessage(null);
      }, 5000);
    }
  }, [leadId, router]);

  // If no chat messages, nothing to extract
  if (!hasChatMessages) {
    return null;
  }

  // AI not configured
  if (!aiAvailable) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-stone-400">
        <SparklesIcon className="size-3.5" aria-hidden />
        <span>AI extraction unavailable (not configured)</span>
      </div>
    );
  }

  const isWorking = phase === 'extracting' || phase === 'rescoring';

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleClick}
        disabled={isWorking}
        variant="outline"
        size="sm"
        className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900 disabled:opacity-60"
      >
        {isWorking ? (
          <LoaderIcon data-icon="inline-start" className="size-3.5 animate-spin" />
        ) : phase === 'done' ? (
          <CheckCircle2Icon data-icon="inline-start" className="size-3.5 text-teal-700" />
        ) : phase === 'error' ? (
          <AlertCircleIcon data-icon="inline-start" className="size-3.5 text-red-800" />
        ) : (
          <SparklesIcon data-icon="inline-start" className="size-3.5" />
        )}
        {phase === 'extracting' && 'Extracting signals...'}
        {phase === 'rescoring' && 'Rescoring...'}
        {phase === 'done' && `Done${signalCount > 0 ? ` (${signalCount} signals)` : ''}`}
        {phase === 'error' && 'Failed'}
        {phase === 'idle' && 'Extract & Rescore'}
      </Button>

      {phase === 'error' && errorMessage && (
        <span className="text-[11px] text-red-800">{errorMessage}</span>
      )}
    </div>
  );
}
