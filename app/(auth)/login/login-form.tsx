'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/queue';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const result = await signIn('credentials', {
      email: form.get('email') as string,
      password: form.get('password') as string,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password.');
      setPending(false);
      return;
    }

    window.location.href = callbackUrl;
  }

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="on" method="post">
          {error && (
            <div
              role="alert"
              className="border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
            >
              {error}
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
              autoComplete="username"
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
            className="mt-1 h-9 w-full bg-amber-700 text-[13px] font-medium text-white hover:bg-amber-800"
            disabled={pending}
          >
            {pending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
