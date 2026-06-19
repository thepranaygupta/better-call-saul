'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deactivateUser } from '@/app/(app)/admin/actions';
import type { SerializedUser } from '@/app/(app)/admin/actions';
import { UserXIcon, UserCheckIcon } from 'lucide-react';

interface UserDeactivateButtonProps {
  user: SerializedUser;
}

export function UserDeactivateButton({ user }: UserDeactivateButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isActive = user.active !== false;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateUser(user._id);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? 'Failed to update user status');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setError(null); }}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className={`text-[11px] ${
              isActive
                ? 'text-stone-500 hover:text-red-800'
                : 'text-stone-500 hover:text-teal-700'
            }`}
          >
            {isActive ? (
              <>
                <UserXIcon data-icon="inline-start" className="size-3" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheckIcon data-icon="inline-start" className="size-3" />
                Reactivate
              </>
            )}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isActive ? 'Deactivate user' : 'Reactivate user'}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Are you sure you want to deactivate ${user.name}? They will lose access but their data will be preserved.`
              : `Reactivate ${user.name}? They will regain access with their previous role and project assignments.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-[11px] text-red-800">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="text-[11px] text-stone-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className={
              isActive
                ? 'bg-red-800 text-white hover:bg-red-900'
                : 'bg-teal-700 text-white hover:bg-teal-800'
            }
          >
            {isPending
              ? '...'
              : isActive
                ? 'Deactivate'
                : 'Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
