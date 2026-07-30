import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    '/', 
    '/(de|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};