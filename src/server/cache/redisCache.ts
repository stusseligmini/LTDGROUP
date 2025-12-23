/**
 * In-Memory Cache Implementation
 * 
 * Simple cache using Map for development and single-instance deployments.
 * For production with multiple instances, implement distributed caching
 * using a managed Redis provider (Upstash, Redis Enterprise, cloud provider Redis, etc.)
 */

import { logger } from '@/lib/logger';

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const TTL_MS_DEFAULT = 60_000;
const memoryCache = new Map<string, CacheEntry>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  memoryCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => memoryCache.delete(key));
  
  if (keysToDelete.length > 0) {
    logger.info(`Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}, 60_000); // Run every minute

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const entry = memoryCache.get(key);
  
  if (!entry) {
    return null;
  }
  
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return null;
  }
  
  try {
    return JSON.parse(entry.value) as T;
  } catch (error) {
    logger.warn('Failed to parse cached value', { key, error });
    memoryCache.delete(key);
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlMs = TTL_MS_DEFAULT): Promise<void> {
  const serialized = JSON.stringify(value);
  
  memoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function clearCache(key?: string): Promise<void> {
  if (!key) {
    memoryCache.clear();
    logger.info('Cleared all cache entries');
    return;
  }

  memoryCache.delete(key);
  logger.info('Cleared cache entry', { key });
}

