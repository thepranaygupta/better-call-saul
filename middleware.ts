import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth.js v5 uses different cookie names on HTTPS vs HTTP
  // Try both NEXTAUTH_SECRET and AUTH_SECRET
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  // On production HTTPS, Auth.js v5 prefixes cookies with __Secure-
  const secureCookie = request.cookies.get('__Secure-authjs.session-token');
  const devCookie = request.cookies.get('authjs.session-token');
  const hasSession = !!(secureCookie || devCookie);

  // Also try getToken as fallback
  let token = null;
  try {
    token = await getToken({ req: request, secret });
  } catch {
    // getToken can fail if secret doesn't match cookie encryption
  }

  const isAuthenticated = hasSession || !!token;
  const isLoginPage = pathname === '/login';
  const isLandingPage = pathname === '/';

  // Role-based landing: admins go to /analytics, everyone else to /queue
  if (isAuthenticated && (isLoginPage || isLandingPage)) {
    const dest = token?.role === 'admin' ? '/analytics' : '/queue';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Admins should not land on the BDA call queue
  if (isAuthenticated && pathname === '/queue' && token?.role === 'admin') {
    return NextResponse.redirect(new URL('/analytics', request.url));
  }

  if (!isAuthenticated && !isLoginPage && !isLandingPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
