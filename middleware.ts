import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  
  // Protect admin routes - require authentication
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/auth/signin', nextUrl));
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
};

// Made with Bob
