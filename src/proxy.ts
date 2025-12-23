/**
 * Next.js Proxy (replacing deprecated Middleware)
 *
 * Responsibilities:
 * - Lightweight auth gating & redirects
 * - CSP + security headers with nonce
 * - CSRF token cookie refresh on non-API requests
 * - Optional rate limiting (prod only)
 * - Correlation + performance headers
 *
 * NOTE: Heavy logic should stay in API routes. Keep proxy lean.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { addCspHeaders, generateCspNonce } from './lib/security/contentSecurityPolicy';
import { csrfMiddleware, setCsrfTokenCookie } from './lib/security/csrfProtection';
import { rateLimitMiddleware, RateLimitPresets, rateLimit, addRateLimitHeaders } from './lib/security/rateLimit';
import { decodeJwt } from './lib/jwtUtils';

const ACCESS_TOKEN_COOKIE = 'auth-token';
const ID_TOKEN_COOKIE = 'auth-id-token';
const SESSION_COOKIE = '__session';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function getUserFromRequest(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    try {
      const payload = decodeJwt(sessionToken);
      if (payload && (!payload.exp || payload.exp > Math.floor(Date.now() / 1000))) {
        return {
          id: payload.uid || payload.sub,
          email: payload.email,
          roles: [],
          authTime: payload.auth_time,
        };
      }
    } catch {
      // swallow
    }
  }
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const idToken = request.cookies.get(ID_TOKEN_COOKIE)?.value;
  const token = accessToken || idToken;
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload) return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  const roles = Array.isArray(payload.roles)
    ? payload.roles
    : Array.isArray((payload as any)['extension_Roles'])
    ? (payload as any)['extension_Roles']
    : [];
  const email = (payload as any).email || (payload as any).preferred_username || (Array.isArray((payload as any).emails) ? (payload as any).emails[0] : undefined);
  return {
    id: payload.sub,
    email,
    roles,
    authTime: (payload as any).auth_time ? Number((payload as any).auth_time) : undefined,
  };
}

export default async function proxy(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || generateUUID();
  const path = request.nextUrl.pathname;
  const method = request.method;

  const isApiRoute = path.startsWith('/api/');
  const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  const isAuthRoute = path.startsWith('/splash') || path.startsWith('/signup') || path.startsWith('/api/auth');

  if (process.env.NODE_ENV === 'production') {
    // Only rate limit API routes - skip page navigation to avoid redirect loops
    if (isApiRoute) {
      if (isAuthRoute) {
        const rl = await rateLimitMiddleware(request, RateLimitPresets.auth);
        if (rl) return rl;
      } else {
        const isTransactionEndpoint = path.startsWith('/api/solana/send') || path.startsWith('/api/wallet/send') || path.startsWith('/api/swap');
        const preset = isWriteOperation
          ? (isTransactionEndpoint ? (RateLimitPresets as any).transaction ?? RateLimitPresets.write : RateLimitPresets.write)
          : RateLimitPresets.read;
        const rl = await rateLimitMiddleware(request, preset);
        if (rl) return rl;
      }
    }
  }

  if (isApiRoute) {
    const csrf = csrfMiddleware(request);
    if (csrf) return csrf;
  }

  const user = await getUserFromRequest(request);
  const authPages = ['/splash', '/signup', '/reset-password', '/update-password'];
  const protectedPrefixes = ['/wallet', '/cards', '/casino', '/settings', '/profile'];
  const publicPrefixes = ['/api/', '/offline', '/fresh', '/_next/', '/favicon.ico', '/icons/', '/images/', '/splash'];
  const currentPath = request.nextUrl.pathname;
  const isPublicPath = publicPrefixes.some((prefix) => currentPath.startsWith(prefix));
  const isAuthPage = authPages.includes(currentPath);
  const isProtectedRoute = protectedPrefixes.some((route) => currentPath.startsWith(route));

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtectedRoute && !isPublicPath && currentPath !== '/splash') {
    return NextResponse.redirect(new URL('/splash', request.url));
  }
  
  // Note: Authenticated users on auth pages will be handled client-side
  // to ensure auth state and cookies are fully settled before redirect.

  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);

  // CSP disabled - Next.js 16 with Turbopack requires inline scripts/styles
  // TODO: Re-enable with nonce-based CSP after setting up proper injection
  // if (process.env.NODE_ENV === 'production') {
  //   const nonce = generateCspNonce();
  //   addCspHeaders(response, nonce, false);
  // }

  if (!isApiRoute) {
    setCsrfTokenCookie(response);
  }

  if (isApiRoute) {
    const isTransactionEndpoint = path.startsWith('/api/solana/send') || path.startsWith('/api/wallet/send') || path.startsWith('/api/swap');
    const preset = isWriteOperation
      ? (isTransactionEndpoint ? (RateLimitPresets as any).transaction ?? RateLimitPresets.write : RateLimitPresets.write)
      : RateLimitPresets.read;
    const info = await rateLimit(request, preset);
    addRateLimitHeaders(response, info);
  }

  const responseTime = Date.now() - startTime;
  response.headers.set('x-response-time', `${responseTime}ms`);

  if (!response.headers.has('Cache-Control')) {
    const cacheableRoutes = ['/_next/static', '/public', '/icons', '/images'];
    const isCacheable = cacheableRoutes.some(route => path.startsWith(route));
    response.headers.set(
      'Cache-Control',
      isCacheable ? 'public, max-age=31536000, immutable' : 'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt).*)'],
};