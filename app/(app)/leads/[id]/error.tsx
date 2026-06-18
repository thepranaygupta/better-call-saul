'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon } from 'lucide-react';

export default function LeadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Lead detail error:', error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Link
        href="/queue"
        className="inline-flex items-center gap-1 text-[12px] text-stone-500 transition-colors hover:text-amber-700"
      >
        <ChevronLeftIcon className="size-3.5" />
        <span>Back to queue</span>
      </Link>

      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <h2 className="text-sm font-medium text-stone-950">
          Failed to load lead details
        </h2>
        <p className="max-w-sm text-center text-xs text-stone-500">
          Could not retrieve this lead&apos;s information. The lead may not exist or you may not have access.
        </p>
        <div className="flex items-center gap-2">
          <Button
            onClick={reset}
            variant="outline"
            size="sm"
            className="h-7 text-xs font-semibold"
          >
            Try again
          </Button>
          <Link href="/queue">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-semibold text-stone-500"
            >
              Return to queue
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
