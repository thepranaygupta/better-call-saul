import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/** Routes that authenticated users should be redirected away from */
const AUTH_ROUTES = ['/login'];

/** The root landing page — redirect authenticated users to /queue */
const LANDING_ROUTE = '/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Authenticated users hitting landing page or login → redirect to /queue
  if (token && (pathname === LANDING_ROUTE || AUTH_ROUTES.some((r) => pathname.startsWith(r)))) {
    return NextResponse.redirect(new URL('/queue', request.url));
  }

  // Unauthenticated users hitting protected routes → redirect to /login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - api/auth (NextAuth endpoints)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     *
     * Note: "/" and "/login" ARE matched so we can redirect
     * authenticated users away from them.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
