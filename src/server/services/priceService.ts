/**
 * Price Oracle Service
 * Aggregates prices from multiple sources with caching
 */

import { getCachedJson, setCachedJson } from '../cache/redisCache';
import { logger } from '@/lib/logger';

const CACHE_TTL_MS = 60_000; // 1 minute cache
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface PriceData {
  symbol: string;
  price: number;
  currency: string;
  change24h: number;
  lastUpdated: string;
}

/**
 * Mapping of blockchain symbols to CoinGecko IDs
 */
const COIN_IDS: Record<string, string> = {
  bitcoin: 'bitcoin',
  btc: 'bitcoin',
  ethereum: 'ethereum',
  eth: 'ethereum',
  solana: 'solana',
  sol: 'solana',
  celo: 'celo',
};

/**
 * Get price for a single cryptocurrency
 */
export async function getPrice(
  symbol: string,
  currency: string = 'usd'
): Promise<PriceData | null> {
  const cacheKey = `price:${symbol.toLowerCase()}:${currency.toLowerCase()}`;
  
  // Check cache first
  const cached = await getCachedJson<PriceData>(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    // Get CoinGecko ID
    const coinId = COIN_IDS[symbol.toLowerCase()];
    if (!coinId) {
      logger.warn('Unknown symbol', { symbol });
      return null;
    }
    
    // Fetch from CoinGecko
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=${currency}&include_24hr_change=true`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const coinData = data[coinId];
    
    if (!coinData) {
      return null;
    }
    
    const priceData: PriceData = {
      symbol: symbol.toUpperCase(),
      price: coinData[currency],
      currency: currency.toUpperCase(),
      change24h: coinData[`${currency}_24h_change`] || 0,
      lastUpdated: new Date().toISOString(),
    };
    
    // Cache result
    await setCachedJson(cacheKey, priceData, CACHE_TTL_MS);
    
    return priceData;
    
  } catch (error) {
    logger.error('Error fetching price', error, { symbol, currency });
    return null;
  }
}

/**
 * Get prices for multiple cryptocurrencies
 */
export async function getPrices(
  symbols: string[],
  currency: string = 'usd'
): Promise<Record<string, PriceData>> {
  const results: Record<string, PriceData> = {};
  
  // Fetch all prices in parallel
  const promises = symbols.map(symbol => getPrice(symbol, currency));
  const prices = await Promise.all(promises);
  
  symbols.forEach((symbol, index) => {
    const price = prices[index];
    if (price) {
      results[symbol.toLowerCase()] = price;
    }
  });
  
  return results;
}

/**
 * Convert crypto amount to fiat
 */
export async function convertToFiat(
  symbol: string,
  amount: string | number,
  currency: string = 'usd'
): Promise<number | null> {
  const price = await getPrice(symbol, currency);
  if (!price) return null;
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount * price.price;
}

/**
 * Convert fiat to crypto amount
 */
export async function convertToCrypto(
  symbol: string,
  fiatAmount: number,
  currency: string = 'usd'
): Promise<number | null> {
  const price = await getPrice(symbol, currency);
  if (!price) return null;
  
  return fiatAmount / price.price;
}

/**
 * Get market data for a cryptocurrency
 */
export async function getMarketData(coinId: string): Promise<any> {
  const cacheKey = `market:${coinId}`;
  
  // Check cache
  const cached = await getCachedJson(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache for 5 minutes
    await setCachedJson(cacheKey, data, 5 * 60 * 1000);
    
    return data;
    
  } catch (error) {
    logger.error('Error fetching market data', error, { coinId });
    return null;
  }
}

