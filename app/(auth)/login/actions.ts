'use server';

import { signIn } from '@/lib/auth/config';
import { AuthError } from 'next-auth';

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  try {
    await signIn('credentials', {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      redirectTo: '/queue',
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password.' };
    }
    // next-auth throws a NEXT_REDIRECT error on successful sign-in — rethrow it
    throw error;
  }
}
