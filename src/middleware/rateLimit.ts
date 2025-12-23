/**
 * Rate Limiting Middleware
 * Implements Redis-based rate limiting for API endpoints
 * Uses sliding window algorithm with Upstash Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RateLimitConfig {
  maxRequests: number; // Max requests per window
  windowMs: number; // Time window in milliseconds
  identifier?: 'ip' | 'user' | 'both'; // What to rate limit by
  blockDuration?: number; // How long to block after exceeding (ms)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until reset
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Get identifier (IP address or user ID)
    const identifier = await getRateLimitIdentifier(request, config.identifier || 'ip');
    const key = `${endpoint}:${identifier}`;

    // Get current window start
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old rate limit entries
    await prisma.rateLimit.deleteMany({
      where: {
        identifier: key,
        endpoint,
        windowEnd: { lt: new Date(now) },
      },
    });

    // Count requests in current window
    const requestCount = await prisma.rateLimit.count({
      where: {
        identifier: key,
        endpoint,
        windowEnd: { gte: new Date(windowStart) },
      },
    });

    // Check if rate limit exceeded
    if (requestCount >= config.maxRequests) {
      const oldestRequest = await prisma.rateLimit.findFirst({
        where: {
          identifier: key,
          endpoint,
          windowEnd: { gte: new Date(windowStart) },
        },
        orderBy: { windowStart: 'asc' },
      });

      const resetAt = oldestRequest
        ? new Date(oldestRequest.windowStart.getTime() + config.windowMs)
        : new Date(now + config.windowMs);

      const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);

      logger.warn('Rate limit exceeded', {
        endpoint,
        identifier,
        requestCount,
        maxRequests: config.maxRequests,
        retryAfter,
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Record this request
    await prisma.rateLimit.create({
      data: {
        identifier: key,
        endpoint,
        requests: 1,
        windowStart: new Date(now),
        windowEnd: new Date(now + config.windowMs),
      },
    });

    const remaining = config.maxRequests - requestCount - 1;
    const resetAt = new Date(now + config.windowMs);

    logger.debug('Rate limit check passed', {
      endpoint,
      identifier,
      requestCount: requestCount + 1,
      remaining,
    });

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    logger.error('Rate limit check failed', error);

    // Fail-open: Allow request if rate limit check fails
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(Date.now() + config.windowMs),
    };
  }
}

/**
 * Get identifier for rate limiting (IP address or user ID)
 */
async function getRateLimitIdentifier(
  request: NextRequest,
  type: 'ip' | 'user' | 'both'
): Promise<string> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';

  if (type === 'ip') {
    return ip;
  }

  // Extract user ID from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Decode JWT to get user ID (simplified - use proper JWT library in production)
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const userId = payload.sub || payload.uid || payload.user_id;
      
      if (type === 'user') {
        return userId;
      }
      
      return `${userId}:${ip}`; // both
    } catch {
      // If JWT decode fails, fall back to IP
      return ip;
    }
  }

  return ip;
}

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const endpoint = req.nextUrl.pathname;

    // Check rate limit
    const result = await checkRateLimit(req, endpoint, config);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          success: false,
          rateLimit: {
            retryAfter: result.retryAfter,
            resetAt: result.resetAt.toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': result.retryAfter?.toString() || '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toISOString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(req);
    
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    return response;
  };
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  // Very strict - for authentication endpoints
  AUTH: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    identifier: 'ip' as const,
  },
  
  // Strict - for sensitive operations (wallet creation, transactions)
  SENSITIVE: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'both' as const,
  },
  
  // Moderate - for API calls
  API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'user' as const,
  },
  
  // Lenient - for general endpoints
  GENERAL: {
    maxRequests: 300,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'ip' as const,
  },
};
