'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logDisposition } from '@/app/(app)/leads/[id]/actions';
import type { LeadDetailDisposition } from '@/app/(app)/leads/[id]/actions';

const OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'not_connected', label: 'Not connected' },
  { value: 'callback_scheduled', label: 'Callback scheduled' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'wrong_number', label: 'Wrong number' },
] as const;

const OUTCOME_COLORS: Record<string, string> = {
  connected: 'text-teal-700',
  enrolled: 'text-teal-700',
  not_connected: 'text-stone-500',
  callback_scheduled: 'text-amber-700',
  not_interested: 'text-red-800',
  wrong_number: 'text-stone-400',
};

interface DispositionFormProps {
  leadId: string;
  onDispositionLogged?: (d: LeadDetailDisposition) => void;
}

export function DispositionForm({ leadId, onDispositionLogged }: DispositionFormProps) {
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!outcome) {
      setError('Select an outcome');
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const result = await logDisposition({
          leadId,
          outcome,
          notes: notes.trim() || undefined,
          nextActionAt: nextActionAt || undefined,
        });

        if (result.success && result.disposition && onDispositionLogged) {
          onDispositionLogged(result.disposition);
        }

        // Reset form
        setOutcome('');
        setNotes('');
        setNextActionAt('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to log disposition');
      }
    });
  };

  return (
    <div className="border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          LOG DISPOSITION
        </span>
      </div>

      <div className="space-y-3 p-4">
        {/* Outcome select */}
        <div className="space-y-1">
          <Label htmlFor="disposition-outcome" className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            OUTCOME
          </Label>
          <Select value={outcome} onValueChange={(v) => setOutcome(v ?? '')}>
            <SelectTrigger id="disposition-outcome" className="h-8 text-xs">
              <SelectValue placeholder="Select outcome" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className={OUTCOME_COLORS[o.value]}>{o.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label htmlFor="disposition-notes" className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            NOTES
          </Label>
          <Textarea
            id="disposition-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Call notes (optional)"
            className="min-h-[60px] resize-none text-xs"
            maxLength={1000}
          />
        </div>

        {/* Next action — only show for callback_scheduled */}
        {outcome === 'callback_scheduled' && (
          <div className="space-y-1">
            <Label htmlFor="disposition-callback" className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              CALLBACK DATE
            </Label>
            <Input
              id="disposition-callback"
              type="datetime-local"
              value={nextActionAt}
              onChange={(e) => setNextActionAt(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[11px] text-red-800">{error}</p>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={isPending || !outcome}
          className="h-8 w-full bg-amber-700 text-xs font-semibold text-white hover:bg-amber-800"
        >
          {isPending ? 'Logging...' : 'Log disposition'}
        </Button>
      </div>
    </div>
  );
}
