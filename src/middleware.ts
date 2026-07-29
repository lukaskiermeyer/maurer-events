import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const intlMiddleware = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  // Check if it's an admin route (e.g., /de/admin or /admin)
  if (req.nextUrl.pathname.includes('/admin')) {
    const basicAuth = req.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      const validUser = process.env.ADMIN_USER || 'admin';
      const validPassword = process.env.ADMIN_PASSWORD || 'maurer2025';

      if (user === validUser && pwd === validPassword) {
        return intlMiddleware(req);
      }
    }

    return new NextResponse('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/', '/(de|en)/:path*']
};