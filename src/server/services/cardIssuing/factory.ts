/**
 * Factory for creating card issuing provider instances
 * Routes to the appropriate provider based on user preferences
 */

import type { ICardIssuingProvider } from './interface';
import type { CardProvider } from './types';
import { MockCardProvider } from './mock/provider';
import { logger } from '@/lib/logger';
import { GnosisPayProvider } from './gnosis/provider';
import { HighnoteProvider } from './highnote/provider';
// import { DeserveProvider } from './deserve/provider';

// Provider registry
const providers: Map<CardProvider, ICardIssuingProvider> = new Map();
let providersInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Register a provider
 */
export function registerProvider(name: CardProvider, provider: ICardIssuingProvider): void {
  providers.set(name, provider);
}

/**
 * Get a provider instance
 */
export function getProvider(name: CardProvider): ICardIssuingProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Card provider '${name}' not found. Available: ${Array.from(providers.keys()).join(', ')}`);
  }
  return provider;
}

/**
 * Initialize all providers with their configurations
 */
async function setupProviders(): Promise<void> {
  providers.clear();

  // Register mock provider (always available for development/testing)
  const mockProvider = new MockCardProvider();
  await mockProvider.initialize({ environment: 'sandbox' });
  registerProvider('mock', mockProvider);
  
  // Initialize Gnosis Pay if configured
  if (process.env.GNOSIS_PAY_ENABLED === 'true') {
    try {
      const gnosisProvider = new GnosisPayProvider();
      await gnosisProvider.initialize({
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
        apiKey: process.env.GNOSIS_PAY_API_KEY,
        apiSecret: process.env.GNOSIS_PAY_API_SECRET,
        apiBaseUrl: process.env.GNOSIS_PAY_API_BASE_URL,
        safeAddress: process.env.GNOSIS_SAFE_ADDRESS,
        rpcUrl: process.env.GNOSIS_CHAIN_RPC_URL,
        webhookSecret: process.env.GNOSIS_PAY_WEBHOOK_SECRET,
      });
      registerProvider('gnosis', gnosisProvider);
    } catch (error) {
      logger.error('Failed to initialize Gnosis Pay provider', error);
    }
  }
  
  // Initialize Highnote if configured
  if (process.env.HIGHNOTE_API_KEY && process.env.HIGHNOTE_API_SECRET) {
    try {
      const highnoteProvider = new HighnoteProvider();
      await highnoteProvider.initialize({
        apiKey: process.env.HIGHNOTE_API_KEY,
        apiSecret: process.env.HIGHNOTE_API_SECRET,
        apiBaseUrl: process.env.HIGHNOTE_API_BASE_URL,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
        webhookSecret: process.env.HIGHNOTE_WEBHOOK_SECRET,
        programId: process.env.HIGHNOTE_PROGRAM_ID,
      });
      registerProvider('highnote', highnoteProvider);
    } catch (error) {
      logger.error('Failed to initialize Highnote provider', error);
    }
  }
  
  // Initialize Deserve if configured
  if (process.env.DESERVE_API_KEY) {
    // const deserveProvider = new DeserveProvider();
    // await deserveProvider.initialize({
    //   apiKey: process.env.DESERVE_API_KEY,
    //   environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    // });
    // registerProvider('deserve', deserveProvider);
    logger.info('Deserve provider not yet implemented');
  }
  
  logger.info('Card issuing providers initialized', {
    providerCount: providers.size,
    providers: Array.from(providers.keys()),
  });
}

export async function initializeProviders(): Promise<void> {
  if (providersInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await setupProviders();
    providersInitialized = true;
    initializationPromise = null;
  })();

  return initializationPromise;
}

export async function ensureProvidersInitialized(): Promise<void> {
  await initializeProviders();
}

/**
 * Select the best provider for a user based on their preferences and card type
 */
export function selectProviderForUser(
  userPreference?: CardProvider,
  cardType?: 'crypto-native' | 'traditional'
): CardProvider {
  // If user has explicit preference and it's available, use it
  if (userPreference && providers.has(userPreference)) {
    return userPreference;
  }
  
  // Auto-select based on card type
  if (cardType === 'crypto-native') {
    // Prefer Gnosis Pay for crypto-native cards
    if (providers.has('gnosis')) {
      return 'gnosis';
    }
  } else if (cardType === 'traditional') {
    // Prefer Highnote for traditional cards (lowest fees)
    if (providers.has('highnote')) {
      return 'highnote';
    }
    // Fallback to Deserve
    if (providers.has('deserve')) {
      return 'deserve';
    }
  }
  
  // Default to mock for development/testing
  return 'mock';
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): CardProvider[] {
  return Array.from(providers.keys());
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(name: CardProvider): boolean {
  return providers.has(name);
}

