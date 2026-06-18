'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function QueueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Queue error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <h2 className="text-sm font-medium text-stone-950">
        Failed to load lead queue
      </h2>
      <p className="max-w-sm text-center text-xs text-stone-500">
        An error occurred while loading your leads. This may be a temporary issue.
      </p>
      <Button
        onClick={reset}
        variant="outline"
        size="sm"
        className="mt-1 h-7 text-xs font-semibold"
      >
        Try again
      </Button>
    </div>
  );
}
