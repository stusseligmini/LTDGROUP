/**
 * CoinGecko Price Feed Service
 * Provides real-time crypto prices with caching
 */

export interface PriceData {
  usd: number;
  usd_24h_change: number;
  last_updated: number;
}

interface CachedPrice {
  data: PriceData;
  timestamp: number;
}

const CACHE_DURATION = 30_000; // 30 seconds
const priceCache = new Map<string, CachedPrice>();

// CoinGecko coin IDs
const COIN_IDS: Record<string, string> = {
  SOL: 'solana',
  ETH: 'ethereum',
  BTC: 'bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  CELO: 'celo',
  MATIC: 'matic-network',
  ARB: 'arbitrum',
  OP: 'optimism',
};

/**
 * Get price for a single token
 */
export async function getTokenPrice(symbol: string): Promise<PriceData | null> {
  const coinId = COIN_IDS[symbol.toUpperCase()];
  if (!coinId) {
    console.warn(`No CoinGecko ID for symbol: ${symbol}`);
    return null;
  }

  // Check cache
  const cached = priceCache.get(coinId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 30 }, // Next.js cache
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const priceData: PriceData = {
      usd: data[coinId]?.usd || 0,
      usd_24h_change: data[coinId]?.usd_24h_change || 0,
      last_updated: data[coinId]?.last_updated_at || Date.now() / 1000,
    };

    // Update cache
    priceCache.set(coinId, {
      data: priceData,
      timestamp: Date.now(),
    });

    return priceData;
  } catch (error) {
    console.error(`Failed to fetch price for ${symbol}:`, error);
    // Return cached data even if expired, or null
    return cached?.data || null;
  }
}

/**
 * Get prices for multiple tokens
 */
export async function getTokenPrices(symbols: string[]): Promise<Record<string, PriceData | null>> {
  const coinIds = symbols
    .map(s => COIN_IDS[s.toUpperCase()])
    .filter(Boolean);

  if (coinIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const result: Record<string, PriceData | null> = {};

    symbols.forEach(symbol => {
      const coinId = COIN_IDS[symbol.toUpperCase()];
      if (coinId && data[coinId]) {
        const priceData: PriceData = {
          usd: data[coinId].usd || 0,
          usd_24h_change: data[coinId].usd_24h_change || 0,
          last_updated: data[coinId].last_updated_at || Date.now() / 1000,
        };
        result[symbol] = priceData;
        // Update cache
        priceCache.set(coinId, {
          data: priceData,
          timestamp: Date.now(),
        });
      } else {
        result[symbol] = null;
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to fetch multiple prices:', error);
    // Return empty object on error
    return {};
  }
}

/**
 * Convert crypto amount to USD
 */
export async function convertToUSD(symbol: string, amount: number): Promise<number> {
  const price = await getTokenPrice(symbol);
  if (!price) return 0;
  return amount * price.usd;
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(usd: number): string {
  if (usd >= 1) {
    return `$${usd.toFixed(2)}`;
  } else if (usd >= 0.01) {
    return `$${usd.toFixed(4)}`;
  } else {
    return `$${usd.toFixed(6)}`;
  }
}

/**
 * Format 24h change with color indicator
 */
export function format24hChange(change: number): { text: string; color: 'green' | 'red' | 'gray' } {
  if (change > 0) {
    return { text: `+${change.toFixed(2)}%`, color: 'green' };
  } else if (change < 0) {
    return { text: `${change.toFixed(2)}%`, color: 'red' };
  } else {
    return { text: '0.00%', color: 'gray' };
  }
}

/**
 * Clear price cache (for testing or manual refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
