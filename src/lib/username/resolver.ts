/**
 * Unified Username Resolver
 * Provides a typed status-oriented API over existing client resolution logic.
 * Does NOT break existing imports; components may adopt this gradually.
 */

import { resolveUsername as legacyResolve } from '@/lib/username/client';

export enum UsernameResolveStatus {
  OK = 'ok',
  NOT_FOUND = 'not_found',
  ERROR = 'error',
  NETWORK = 'network',
}

export interface UsernameResolution {
  username: string;
  address: string | null;
  status: UsernameResolveStatus;
  cached: boolean;
  errorMessage?: string;
  resolvedAt: number;
}

interface CacheEntry {
  result: UsernameResolution;
  timestamp: number;
}

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function normalize(u: string): string {
  return u.toLowerCase().trim().replace(/^@/, '');
}

/** Resolve a single username; returns structured status. */
export async function resolveUsernameStatus(username: string): Promise<UsernameResolution> {
  const key = normalize(username);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_MS) {
    return { ...cached.result, cached: true };
  }

  try {
    const address = await legacyResolve(key);
    const resolution: UsernameResolution = {
      username: key,
      address,
      status: address ? UsernameResolveStatus.OK : UsernameResolveStatus.NOT_FOUND,
      cached: false,
      resolvedAt: Date.now(),
    };
    cache.set(key, { result: resolution, timestamp: Date.now() });
    return resolution;
  } catch (e: any) {
    const resolution: UsernameResolution = {
      username: key,
      address: null,
      status: e?.message?.includes('Network') ? UsernameResolveStatus.NETWORK : UsernameResolveStatus.ERROR,
      cached: false,
      errorMessage: e?.message || 'Unknown error',
      resolvedAt: Date.now(),
    };
    cache.set(key, { result: resolution, timestamp: Date.now() });
    return resolution;
  }
}

/** Batch resolve usernames with controlled concurrency. */
export async function batchResolveUsernames(usernames: string[], concurrency = 5): Promise<UsernameResolution[]> {
  const normalized = usernames.map(normalize);
  const results: UsernameResolution[] = [];
  for (let i = 0; i < normalized.length; i += concurrency) {
    const slice = normalized.slice(i, i + concurrency);
    const batch = await Promise.all(slice.map(u => resolveUsernameStatus(u)));
    results.push(...batch);
  }
  return results;
}

/** Invalidate cache entry for a username (after registration/change). */
export function invalidateUsernameCache(username: string): void {
  cache.delete(normalize(username));
}

/** Clear entire resolver cache. */
export function clearUsernameResolverCache(): void {
  cache.clear();
}
