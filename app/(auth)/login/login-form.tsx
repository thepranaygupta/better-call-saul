'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@saul.dev', password: 'admin123' },
  { label: 'Sales Lead', email: 'priya@saul.dev', password: 'priya123' },
  { label: 'BDA (Rahul)', email: 'rahul@saul.dev', password: 'rahul123' },
  { label: 'BDA (Neha)', email: 'neha@saul.dev', password: 'neha123' },
];

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/queue';

  async function doSignIn(email: string, password: string) {
    setPending(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await doSignIn(
      form.get('email') as string,
      form.get('password') as string,
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">
          Sign in
        </h2>
        <p className="mt-1 text-[13px] text-stone-500">
          Enter your credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="on" method="post">
        {error && (
          <div
            role="alert"
            className="border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium text-stone-700">
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
          <Label htmlFor="password" className="text-[13px] font-medium text-stone-700">
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

      <div className="mt-8 border-t border-stone-200 pt-6">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-stone-400">
          Demo accounts
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              disabled={pending}
              onClick={() => doSignIn(acct.email, acct.password)}
              className="flex flex-col items-start border border-stone-200 bg-white px-3 py-2 text-left transition-colors hover:border-amber-700/30 hover:bg-amber-50/50 disabled:opacity-50"
            >
              <span className="text-[12px] font-medium text-stone-800">{acct.label}</span>
              <span className="text-[10px] text-stone-400">{acct.email}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
