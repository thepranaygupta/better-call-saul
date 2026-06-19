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
        <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">
          Saul
        </h1>
        <p className="mt-1 text-[13px] text-stone-500">
          Sign in to access the lead queue.
        </p>
      </div>

      <div className="border border-stone-200 bg-white p-5">
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
              className="text-[12px] font-medium uppercase tracking-widest text-stone-500"
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
              className="h-9 text-[13px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="password"
              className="text-[12px] font-medium uppercase tracking-widest text-stone-500"
            >
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-9 text-[13px]"
            />
          </div>

          <Button
            type="submit"
            className="mt-1 h-9 w-full rounded-none bg-amber-700 text-[13px] font-medium text-white hover:bg-amber-800"
            disabled={isPending}
          >
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
