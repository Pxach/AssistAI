import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const fetchSite = request.headers.get('sec-fetch-site');
  const referer = request.headers.get('referer');

  // 1. BLOCK DIRECT ADDRESS BAR ENTRY
  // If sec-fetch-site is 'none' OR referer is missing, the user typed the URL directly
  const isDirectAddressBarEntry = fetchSite === 'none' || !referer;

  if (isDirectAddressBarEntry) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. BLOCK UNAUTHENTICATED ACCESS
  if (!token || token === 'undefined') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/chat-analytics',
    '/chat-analytics/:path*',
    '/review-analytics',
    '/review-analytics/:path*',
    '/booking-analytics',
    '/booking-analytics/:path*',
  ],
};