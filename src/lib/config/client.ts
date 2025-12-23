/**
 * Client-Safe Configuration
 * 
 * Only NEXT_PUBLIC_* environment variables
 * Safe to import in client-side code
 */

// Client-safe configuration (only public env vars)
export const clientConfig = {
  // -------- Application Metadata --------
  app: {
    name: 'Celora',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    supportEmail: 'support@celora.com',
  },

  // -------- Firebase Client SDK --------
  firebase: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  },

  // -------- reCAPTCHA Configuration --------
  recaptcha: {
    v3: {
      siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY || '',
      scoreThreshold: 0.5,
    },
  },

  // -------- Blockchain RPCs (Client-side) --------
  blockchain: {
    solana: {
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta',
    },
    helius: {
      apiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY || '',
      rpcUrl: process.env.NEXT_PUBLIC_HELIUS_RPC_URL || '',
      devnetUrl: process.env.NEXT_PUBLIC_HELIUS_DEVNET_URL || '',
    },
  },

  // -------- Feature Flags --------
  features: {
    telegram: (process.env.NEXT_PUBLIC_ENABLE_TELEGRAM || 'false') === 'true',
    walletConnect: (process.env.NEXT_PUBLIC_ENABLE_WALLET_CONNECT || 'false') === 'true',
  },

  // -------- API Endpoints --------
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
  },
};

// Type export for usage
export type ClientConfig = typeof clientConfig;

// Helper to check if running on client
export const isClient = typeof window !== 'undefined';
