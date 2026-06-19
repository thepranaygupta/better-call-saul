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
      callbackUrl,
    });

    if (!result?.ok) {
      setError('Invalid email or password.');
      setPending(false);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
          Sign in
        </h2>
        <p className="mt-1.5 text-sm text-stone-500">
          Enter your credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" autoComplete="on" method="post">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="email"
            className="text-sm font-medium text-stone-700"
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
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-stone-700"
          >
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-10"
          />
        </div>

        <Button
          type="submit"
          className="mt-1 h-10 w-full bg-amber-600 text-sm font-medium text-white hover:bg-amber-700"
          disabled={pending}
        >
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </>
  );
}
