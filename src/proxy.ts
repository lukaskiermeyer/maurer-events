import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

const HOME_PATHS = new Set(['/', '/de', '/en', '/bar']);

export default function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  // Stripe-Success-Redirect hier statt in der Homepage, damit diese ISR-cachbar bleibt.
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (searchParams.get('success') === 'true' && HOME_PATHS.has(normalized)) {
    const locale = normalized === '/en' ? 'en' : normalized === '/bar' ? 'bar' : routing.defaultLocale;
    const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
    const target = new URL(`${prefix}/reservierung/erfolgreich`, req.url);
    const sessionId = searchParams.get('session_id');
    if (sessionId) target.searchParams.set('session_id', sessionId);
    return NextResponse.redirect(target, 307);
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    '/',
    '/(de|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
