/**
 * CSRF (Cross-Site Request Forgery) Protection
 * 
 * Production-ready CSRF protection with double-submit cookie pattern.
 * Uses Web Crypto API for Edge Runtime compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';

export const CSRF_TOKEN_COOKIE = 'celora-csrf-token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';
export const CSRF_TOKEN_PARAM = 'csrf_token';

/**
 * Generate cryptographically secure CSRF token using Web Crypto API
 */
export function generateCsrfToken(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  // Convert to base64url
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Timing-safe comparison to prevent timing attacks
 */
function compareTokens(token1: string, token2: string): boolean {
  if (!token1 || !token2) return false;
  if (token1.length !== token2.length) return false;
  
  // Use constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < token1.length; i++) {
    mismatch |= token1.charCodeAt(i) ^ token2.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Get CSRF token from request (header or body)
 */
export function getCsrfTokenFromRequest(request: NextRequest): string | null {
  // Try header first
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (headerToken) return headerToken;
  
  // Try URL params (for GET with forms)
  const urlToken = request.nextUrl.searchParams.get(CSRF_TOKEN_PARAM);
  if (urlToken) return urlToken;
  
  return null;
}

/**
 * Get CSRF token from cookie
 */
export function getCsrfTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_TOKEN_COOKIE)?.value || null;
}

/**
 * Validate CSRF token (double-submit cookie pattern)
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const requestToken = getCsrfTokenFromRequest(request);
  const cookieToken = getCsrfTokenFromCookie(request);
  
  if (!requestToken || !cookieToken) {
    return false;
  }
  
  return compareTokens(requestToken, cookieToken);
}

/**
 * Set CSRF token in cookie
 */
export function setCsrfTokenCookie(
  response: NextResponse,
  token?: string
): NextResponse {
  const csrfToken = token || generateCsrfToken();
  
  response.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return response;
}

/**
 * Clear CSRF token cookie
 */
export function clearCsrfTokenCookie(response: NextResponse): NextResponse {
  response.cookies.set(CSRF_TOKEN_COOKIE, '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  
  return response;
}

/**
 * Middleware to validate CSRF for state-changing requests
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  
  // Only validate CSRF for state-changing methods
  const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!statefulMethods.includes(method)) {
    return null; // Skip validation for GET, HEAD, OPTIONS
  }
  
  // Skip CSRF validation for certain paths
  const skipPaths = [
    '/api/auth/session',
    '/api/diagnostics/health',
    '/api/telegram/', // Telegram endpoints use HMAC/signature validation instead
  ];
  
  const pathname = request.nextUrl.pathname;
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return null;
  }
  
  // Validate CSRF token
  if (!validateCsrfToken(request)) {
    console.warn(`[CSRF] Validation failed for ${method} ${pathname}`);
    
    return NextResponse.json(
      {
        error: {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'Invalid or missing CSRF token',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 403 }
    );
  }
  
  return null; // Validation passed
}

/**
 * Client-side helper to get CSRF token from cookie
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_TOKEN_COOKIE}=([^;]+)`));
  return match ? match[2] : null;
}

/**
 * Client-side helper to add CSRF token to fetch headers
 */
export function addCsrfTokenToHeaders(headers: HeadersInit = {}): Headers {
  const token = getClientCsrfToken();
  const headerObj = new Headers(headers);
  
  if (token) {
    headerObj.set(CSRF_TOKEN_HEADER, token);
  }
  
  return headerObj;
}

/**
 * Client-side enhanced fetch with CSRF protection
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  // Only add CSRF token for state-changing methods
  if (statefulMethods.includes(method)) {
    options.headers = addCsrfTokenToHeaders(options.headers);
  }
  
  return fetch(url, options);
}
