import { getCachedJson, setCachedJson } from '../cache/redisCache';
import { WalletHolding, WalletSummary } from '@/types/api';
import { Connection } from '@solana/web3.js';
import { appConfig } from '@/lib/config/app';

const CACHE_KEY_PREFIX = 'wallet:summary:';
const CACHE_TTL_MS = 60_000; // 1 minute cache

// RPC provider fallback with retry/backoff
const SOLANA_ENDPOINTS: string[] = [
  appConfig.blockchain.solana.rpcUrl,
  appConfig.blockchain.helius.mainnetRpc,
].filter(Boolean);

async function tryConnections<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  const errors: Error[] = [];
  for (let i = 0; i < SOLANA_ENDPOINTS.length; i++) {
    const endpoint = SOLANA_ENDPOINTS[i];
    try {
      const conn = new Connection(endpoint, 'confirmed');
      return await fn(conn);
    } catch (e) {
      errors.push(e as Error);
      await new Promise(r => setTimeout(r, Math.min(500 * (i + 1), 2000)));
    }
  }
  throw new Error(`All RPC providers failed: ${errors.map(e => e.message).join('; ')}`);
}

// TODO: Implement platform API client
async function callPlatformApi<T>(
  config: { path: string; method: string; userToken?: string },
  fallbackFn: () => Promise<T>
): Promise<T> {
  try {
    // Placeholder: attempt a lightweight network check before using platform API
    await tryConnections(async (conn) => {
      // Ping by getting epoch info; cheap and validates network
      await conn.getEpochInfo();
      return null as unknown as T;
    });
  } catch {
    // If RPC tests fail, use fallback immediately
    return fallbackFn();
  }

  // For now, still use fallback until platform API is implemented
  return fallbackFn();
}

const FALLBACK_SUMMARY: WalletSummary = {
  totalBalance: 0,
  currency: 'USD',
  holdings: [],
  lastUpdated: new Date().toISOString(),
};

type PlatformWalletResponse = {
  totalBalance?: number;
  currency?: string;
  holdings?: WalletHolding[];
  lastUpdated?: string;
};

function normalizeSummary(payload: PlatformWalletResponse | WalletSummary): WalletSummary {
  return {
    totalBalance: typeof payload.totalBalance === 'number' ? payload.totalBalance : 0,
    currency: payload.currency ?? 'USD',
    holdings: Array.isArray(payload.holdings) ? payload.holdings : [],
    lastUpdated: payload.lastUpdated ?? new Date().toISOString(),
  };
}

export async function getWalletSummary(userId: string | null, userToken: string | null): Promise<WalletSummary> {
  const cacheKey = userId ? `${CACHE_KEY_PREFIX}${userId}` : null;

  if (cacheKey) {
    const cached = await getCachedJson<WalletSummary>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const headers: Record<string, string> = {};
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const summary = await callPlatformApi<PlatformWalletResponse>(
    {
      path: '/wallets/summary',
      method: 'GET',
      userToken: userToken ?? undefined,
    },
    async () => FALLBACK_SUMMARY
  );

  const normalized = normalizeSummary(summary);

  if (cacheKey) {
    await setCachedJson(cacheKey, normalized, CACHE_TTL_MS);
  }

  return normalized;
}

