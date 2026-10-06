import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function proxy(req: NextRequest) {
  const response = intlMiddleware(req);
  const rewrite = response.headers.get('x-middleware-rewrite');
  if (rewrite) {
    // Keep locale rewrites inside this server. The incoming public origin can
    // differ from Next's listener origin behind a reverse proxy or in Docker.
    const destination = new URL(rewrite);
    if (destination.origin === new URL(req.url).origin) {
      response.headers.set('x-middleware-rewrite', destination.pathname + destination.search);
    }
  }
  return response;
}

export const config = {
  matcher: [
    '/', 
    '/(de|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
