/**
 * Rate Limit Helper
 * 
 * Reusable helper for applying rate limiting to API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, RateLimitResult } from '@/lib/security/rateLimit';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope } from '@/lib/errors/envelope';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  endpoint: string;
}

/**
 * Apply rate limiting and return error response if limit exceeded
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param requestId - Request ID for logging
 * @returns NextResponse if rate limited, null if allowed
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  requestId: string
): Promise<NextResponse | null> {
  const rateLimitResult = await rateLimit(request, config);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.RATE_LIMITED,
        'Too many requests. Please wait before trying again.',
        requestId
      ),
      { 
        status: getStatusForErrorCode(ErrorCodes.RATE_LIMITED),
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        }
      }
    );
  }
  
  return null; // Rate limit check passed
}

/**
 * Apply rate limiting with custom error message
 */
export async function applyRateLimitWithMessage(
  request: NextRequest,
  config: RateLimitConfig,
  requestId: string,
  errorMessage: string
): Promise<NextResponse | null> {
  const rateLimitResult = await rateLimit(request, config);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.RATE_LIMITED,
        errorMessage,
        requestId
      ),
      { 
        status: getStatusForErrorCode(ErrorCodes.RATE_LIMITED),
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        }
      }
    );
  }
  
  return null;
}
