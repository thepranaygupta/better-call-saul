'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="w-full max-w-[340px]">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#18181B]">
          Saul
        </h1>
        <p className="mt-1 text-[13px] text-[#71717A]">
          Sign in to access the lead queue.
        </p>
      </div>

      <div className="border border-[#E4E4E7] bg-white p-5">
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <div
              role="alert"
              className="border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
            >
              {state.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="email"
              className="text-[12px] font-medium text-[#71717A]"
            >
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              className="h-9 rounded-none border-[#E4E4E7] text-[13px] focus-visible:ring-[#18181B]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="password"
              className="text-[12px] font-medium text-[#71717A]"
            >
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-9 rounded-none border-[#E4E4E7] text-[13px] focus-visible:ring-[#18181B]"
            />
          </div>

          <Button
            type="submit"
            className="mt-1 h-9 w-full rounded-none bg-[#18181B] text-[13px] font-medium text-white hover:bg-[#27272A]"
            disabled={isPending}
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
