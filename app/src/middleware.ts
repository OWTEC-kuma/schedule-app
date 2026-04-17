import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionUsername } from '@/lib/auth';

const PUBLIC_FILE = /\.(.*)$/;
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/favicon.ico'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api/') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const username = await getSessionUsername(request as unknown as Request);
  if (!username) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|static|favicon.ico).*)'],
};
