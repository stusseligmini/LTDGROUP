import { NextRequest, NextResponse } from 'next/server';
import { csrfMiddleware, setCsrfTokenCookie } from '@/lib/security/csrfProtection';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/security/rateLimit';
import * as Sentry from '@sentry/nextjs';

/**
 * Root middleware for request handling and security
 * ✅ SECURITY: CSRF protection + Rate limiting activated
 * ✅ MONITORING: Sentry error tracking enabled
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Apply rate limiting to API routes
  if (path.startsWith('/api/')) {
    // Determine rate limit based on endpoint
    let rateLimitConfig = RateLimitPresets.api; // Default: 1000 req/min

    if (path.includes('/auth/') || path.includes('/login') || path.includes('/register')) {
      rateLimitConfig = RateLimitPresets.auth; // 500 req/min
    } else if (path.includes('/wallet/send') || path.includes('/wallet/create') || path.includes('/cards/')) {
      rateLimitConfig = RateLimitPresets.transaction; // 120 req/min
    } else if (path.includes('/wallet/') || path.includes('/balance')) {
      rateLimitConfig = RateLimitPresets.read; // 500 req/min
    }

    const rateLimitResult = await rateLimitMiddleware(request, {
      ...rateLimitConfig,
      endpoint: path,
    });

    if (rateLimitResult) return rateLimitResult;
  }

  // Skip CSRF for Telegram endpoints that enforce HMAC or webhook signatures
  const csrfBypassPaths = ['/api/telegram/'];
  const bypass = csrfBypassPaths.some(p => path.startsWith(p));

  // Validate CSRF for state-changing requests if not bypassed
  if (!bypass) {
    const csrfResult = csrfMiddleware(request);
    if (csrfResult) return csrfResult;
  }

  // Ensure CSRF token cookie is set for browsers on GET requests
  const method = request.method.toUpperCase();
  if (method === 'GET') {
    const response = NextResponse.next();
    return setCsrfTokenCookie(response);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
