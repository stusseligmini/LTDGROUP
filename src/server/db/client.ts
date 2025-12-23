/**
 * Prisma Client Singleton with PgBouncer Support
 * 
 * Implements connection pooling strategy for:
 * - Development: Direct connection
 * - Production: PgBouncer transaction pooling mode
 * 
 * Features:
 * - Singleton pattern to prevent multiple instances
 * - Graceful shutdown handling
 * - Connection retry logic
 * - Query logging in development
 */

import { PrismaClient } from '@prisma/client';

// Global singleton to prevent multiple Prisma instances
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create Prisma client with optimized settings
 */
export const prisma =
  globalForPrisma.prisma ??
  (process.env.DATABASE_URL
    ? new PrismaClient({
        log:
          process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
        
        // PgBouncer compatibility settings
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      })
    : null) as PrismaClient;

// Store singleton in development to prevent hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute query with retry logic for transient failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors or unique constraint violations
      if (
        lastError.message.includes('Unique constraint') ||
        lastError.message.includes('Invalid')
      ) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt))
        );
      }
    }
  }
  
  throw lastError!;
}

// Graceful shutdown on process termination
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}
