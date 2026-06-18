'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Analytics error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <h2 className="text-sm font-medium text-stone-950">
        Failed to load analytics
      </h2>
      <p className="max-w-sm text-center text-xs text-stone-500">
        An error occurred while computing analytics data. Please try again.
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
