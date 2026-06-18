'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toggleProjectActive } from '@/app/(app)/admin/actions';

interface ProjectActiveToggleProps {
  projectId: string;
  active: boolean;
}

export function ProjectActiveToggle({
  projectId,
  active,
}: ProjectActiveToggleProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleProjectActive(projectId);
    });
  }

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={handleToggle}
      disabled={isPending}
      className="text-[11px] text-stone-500 hover:text-stone-950"
    >
      {isPending ? '...' : active ? 'Deactivate' : 'Activate'}
    </Button>
  );
}
