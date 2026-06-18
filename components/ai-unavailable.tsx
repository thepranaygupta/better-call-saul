'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIUnavailableProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * Reusable fallback shown when AI features are unavailable.
 * Per spec Section 8: AI panels show a clear "AI unavailable" state
 * with a retry button, not a crash.
 */
export function AIUnavailable({
  message = 'AI features are currently unavailable',
  onRetry,
}: AIUnavailableProps) {
  return (
    <div className="flex flex-col items-center gap-2 border border-dashed border-stone-200 py-6 text-center">
      <AlertTriangle className="size-6 text-stone-400" />
      <p className="text-xs text-stone-400">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1 h-7 text-[11px] font-semibold"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
