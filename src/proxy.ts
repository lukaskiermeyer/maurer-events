import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function proxy(req: NextRequest) {
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    '/', 
    '/(de|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
