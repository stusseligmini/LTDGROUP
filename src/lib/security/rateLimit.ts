/**
 * Rate Limiting with optional database persistence.
 * Defaults to in-memory, but can use Prisma-backed RateLimit table when RATE_LIMIT_DRIVER=database.
 * @server-only
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

type StorageDriver = 'memory' | 'database';

// In-memory store for single-instance scenarios
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

// Lazy Prisma client for DB-backed rate limits
let prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
  endpoint?: string;
  storage?: StorageDriver;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  endpoint?: string;
}

function defaultKeyGenerator(request: NextRequest): string {
  // Prefer authenticated identity to avoid shared-IP collisions
  const userKey = request.headers.get('x-user-id') || request.headers.get('x-user');
  if (userKey) return `user:${userKey}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0].trim() || realIp || 'unknown';
  return `ip:${ip}`;
}

function cleanupInMemoryStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  inMemoryStore.forEach((value, key) => {
    if (now > value.resetTime) keysToDelete.push(key);
  });
  keysToDelete.forEach((key) => inMemoryStore.delete(key));
}

async function rateLimitInMemory(
  key: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (Math.random() < 0.01) cleanupInMemoryStore();

  const now = Date.now();
  const resetTime = now + windowMs;
  let record = inMemoryStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime };
    inMemoryStore.set(key, record);
  }

  record.count += 1;
  const success = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);

  return { success, limit, remaining, resetTime: record.resetTime, endpoint };
}

async function rateLimitDatabase(
  key: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartTs = now - (now % windowMs);
  const windowEndTs = windowStartTs + windowMs;
  const windowStart = new Date(windowStartTs);
  const windowEnd = new Date(windowEndTs);

  const client = getPrisma();

  const record = await client.rateLimit.upsert({
    where: {
      identifier_endpoint_windowStart: {
        identifier: key,
        endpoint,
        windowStart,
      },
    },
    update: {
      requests: { increment: 1 },
      windowEnd,
    },
    create: {
      identifier: key,
      endpoint,
      requests: 1,
      windowStart,
      windowEnd,
    },
  });

  const success = record.requests <= limit;
  const remaining = Math.max(0, limit - record.requests);

  return { success, limit, remaining, resetTime: windowEndTs, endpoint };
}

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const {
    limit,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    storage = process.env.RATE_LIMIT_DRIVER === 'database' ? 'database' : 'memory',
    endpoint,
  } = config;

  const key = keyGenerator(request);
  const storeKey = `ratelimit:${key}`;
  const target = endpoint || request.nextUrl.pathname || 'unknown';

  if (storage === 'database') {
    return rateLimitDatabase(storeKey, target, limit, windowMs);
  }

  return rateLimitInMemory(storeKey, target, limit, windowMs);
}

export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const result = await rateLimit(request, config);

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter,
          limit: result.limit,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000)),
          'X-RateLimit-Endpoint': result.endpoint || '',
        },
      }
    );
  }

  return null;
}

export const RateLimitPresets = {
  api: { limit: 1000, windowMs: 60 * 1000 },
  auth: { limit: 500, windowMs: 60 * 1000 }, // Increased from 10 (production) - splash/auth pages need more headroom
  write: { limit: 300, windowMs: 60 * 1000 }, // Increased from 30
  transaction: { limit: 120, windowMs: 60 * 1000 },
  read: { limit: 500, windowMs: 60 * 1000 }, // Increased from 200
  strict: { limit: 50, windowMs: 60 * 1000 }, // Increased from 5
};

export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetTime / 1000)));
  if (result.endpoint) response.headers.set('X-RateLimit-Endpoint', result.endpoint);
  return response;
}
