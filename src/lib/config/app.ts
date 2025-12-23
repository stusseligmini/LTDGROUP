/**
 * Centralized Application Configuration
 * 
 * SINGLE SOURCE OF TRUTH for all app settings
 * No hardcoding. All values from environment or validation.
 * 
 * Usage: import { appConfig } from '@/lib/config/app'
 */

// Validation helper
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================

export const appConfig = {
  // -------- Application Metadata --------
  app: {
    name: 'Celora',
    url: getOptionalEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    supportEmail: getOptionalEnvVar('SUPPORT_EMAIL', 'support@celora.com'),
  },

  // -------- Firebase Configuration --------
  firebase: {
    projectId: getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    apiKey: getEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: getEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    appId: getEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID'),
    storageBucket: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    measurementId: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'),
  },

  // -------- reCAPTCHA Configuration --------
  recaptcha: {
    projectId: getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID'), // Re-use Firebase project ID
    v3: {
      siteKey: getEnvVar('NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY'),
      scoreThreshold: 0.5, // 0.0 = bot, 1.0 = human
      actions: {
        LOGIN: 'login',
        SIGNUP: 'signup',
        WALLET_CREATE: 'wallet_create',
        WALLET_IMPORT: 'wallet_import',
        TRANSACTION: 'transaction',
        SWAP: 'swap',
        USERNAME_REGISTER: 'username_register',
        PASSWORD_RESET: 'password_reset',
        LINK_TELEGRAM: 'link_telegram',
      },
    },
    secretKey: getOptionalEnvVar('RECAPTCHA_SECRET_KEY'),
    apiEndpoint: 'https://recaptchaenterprise.googleapis.com/v1',
  },

  // -------- Telegram Configuration --------
  telegram: {
    botToken: getOptionalEnvVar('TELEGRAM_BOT_TOKEN'),
    miniAppUrl: getOptionalEnvVar(
      'TELEGRAM_MINI_APP_URL',
      getOptionalEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    ),
  },

  // -------- Blockchain RPC Configuration --------
  blockchain: {
    solana: {
      rpcUrl: getOptionalEnvVar('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
      wssUrl: getOptionalEnvVar('SOLANA_WSS_URL'),
      testnetRpc: getOptionalEnvVar('SOLANA_TESTNET_RPC_URL', 'https://api.testnet.solana.com'),
    },
    helius: {
      apiKey: getOptionalEnvVar('HELIUS_API_KEY'),
      mainnetRpc: getOptionalEnvVar('NEXT_PUBLIC_HELIUS_RPC_URL'),
      devnetRpc: getOptionalEnvVar('NEXT_PUBLIC_HELIUS_DEVNET_URL'),
    },
    ethereum: {
      rpcUrl: getOptionalEnvVar('ETHEREUM_RPC_URL', 'https://eth.llamarpc.com'),
      sepoliaRpc: getOptionalEnvVar('ETHEREUM_SEPOLIA_RPC_URL'),
      privateKey: getOptionalEnvVar('ETHEREUM_PRIVATE_KEY'),
    },
    bitcoin: {
      rpcUrl: getOptionalEnvVar('BITCOIN_RPC_URL'),
      testnetRpc: getOptionalEnvVar('BITCOIN_TESTNET_RPC_URL'),
      privateKey: getOptionalEnvVar('BITCOIN_PRIVATE_KEY'),
    },
  },

  // -------- External APIs --------
  externalApis: {
    coingecko: {
      apiKey: getOptionalEnvVar('COINGECKO_API_KEY'),
      endpoint: 'https://api.coingecko.com/api/v3',
    },
    alchemy: {
      apiKey: getOptionalEnvVar('ALCHEMY_API_KEY'),
    },
    blockchair: {
      apiKey: getOptionalEnvVar('BLOCKCHAIR_API_KEY'),
    },
    oneInch: {
      apiKey: getOptionalEnvVar('ONE_INCH_API_KEY'),
      endpoint: 'https://api.1inch.dev/swap/v6.0',
    },
    jupiter: {
      endpoint: 'https://quote-api.jup.ag/v6',
    },
  },

  // -------- Card Issuers Configuration --------
  cardIssuers: {
    gnosis: {
      enabled: process.env.GNOSIS_PAY_ENABLED === 'true',
      apiKey: getOptionalEnvVar('GNOSIS_PAY_API_KEY'),
      apiSecret: getOptionalEnvVar('GNOSIS_PAY_API_SECRET'),
      apiBaseUrl: getOptionalEnvVar('GNOSIS_PAY_API_BASE_URL', 'https://api.sandbox.gnosis-pay.com'),
      safeAddress: getOptionalEnvVar('GNOSIS_SAFE_ADDRESS'),
      chainRpcUrl: getOptionalEnvVar('GNOSIS_CHAIN_RPC_URL'),
      webhookSecret: getOptionalEnvVar('GNOSIS_PAY_WEBHOOK_SECRET'),
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    },
    highnote: {
      enabled: !!getOptionalEnvVar('HIGHNOTE_API_KEY'),
      apiKey: getOptionalEnvVar('HIGHNOTE_API_KEY'),
      apiSecret: getOptionalEnvVar('HIGHNOTE_API_SECRET'),
      apiBaseUrl: getOptionalEnvVar('HIGHNOTE_API_BASE_URL', 'https://api.sandbox.highnote.com/v1'),
      webhookSecret: getOptionalEnvVar('HIGHNOTE_WEBHOOK_SECRET'),
      programId: getOptionalEnvVar('HIGHNOTE_PROGRAM_ID'),
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    },
    deserve: {
      enabled: !!getOptionalEnvVar('DESERVE_API_KEY'),
      apiKey: getOptionalEnvVar('DESERVE_API_KEY'),
    },
  },

  // -------- Hardware Wallet Configuration --------
  hardwareWallets: {
    trezor: {
      email: getOptionalEnvVar('SUPPORT_EMAIL', 'support@celora.com'),
      appUrl: getOptionalEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    },
  },

  // -------- WalletConnect Configuration --------
  walletConnect: {
    projectId: getOptionalEnvVar('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', getOptionalEnvVar('WALLETCONNECT_PROJECT_ID')),
  },

  // -------- Database Configuration --------
  database: {
    url: getEnvVar('DATABASE_URL'),
    directUrl: getOptionalEnvVar('DIRECT_DATABASE_URL'),
  },

  // -------- Encryption Configuration --------
  encryption: {
    masterKeyId: getOptionalEnvVar('KMS_MASTER_KEY_ID', 'default-master-key'),
    walletKey: getOptionalEnvVar('WALLET_ENCRYPTION_KEY'),
    seedPhraseKey: getOptionalEnvVar('SEED_PHRASE_ENCRYPTION_KEY'),
    masterKey: getOptionalEnvVar('MASTER_ENCRYPTION_KEY'),
    apiKey: getOptionalEnvVar('API_SECRET_KEY'),
    backupKey: getOptionalEnvVar('BACKUP_ENCRYPTION_KEY'),
    rotationDays: parseInt(getOptionalEnvVar('ENCRYPTION_KEY_ROTATION_DAYS', '30')),
  },

  // -------- Authentication Configuration --------
  auth: {
    jwtSecret: getOptionalEnvVar('JWT_SECRET'),
    nextAuthSecret: getOptionalEnvVar('NEXTAUTH_SECRET'),
    nextAuthUrl: getOptionalEnvVar('NEXTAUTH_URL'),
  },

  // -------- CORS Configuration --------
  cors: {
    origin: getOptionalEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
    allowedDomains: (getOptionalEnvVar('ALLOWED_DOMAINS', 'localhost,127.0.0.1') || '').split(',').map(d => d.trim()),
  },

  // -------- Feature Flags --------
  features: {
    virtualCards: process.env.ENABLE_VIRTUAL_CARDS === 'true',
    cryptoWallets: process.env.ENABLE_CRYPTO_WALLETS === 'true',
    crossPlatformTransfers: process.env.ENABLE_CROSS_PLATFORM_TRANSFERS === 'true',
    riskScoring: process.env.ENABLE_RISK_SCORING === 'true',
    pinProtection: process.env.ENABLE_PIN_PROTECTION === 'true',
    auditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
    realBlockchain: process.env.ENABLE_REAL_BLOCKCHAIN === 'true',
    firebaseEmulator: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true',
  },

  // -------- Rate Limiting --------
  rateLimiting: {
    requestsPerMinute: parseInt(getOptionalEnvVar('RATE_LIMIT_REQUESTS_PER_MINUTE', '100')),
    windowMs: parseInt(getOptionalEnvVar('RATE_LIMIT_WINDOW_MS', '60000')),
  },

  // -------- Logging --------
  logging: {
    level: getOptionalEnvVar('LOG_LEVEL', 'info'),
    analyticsEnabled: process.env.ENABLE_ANALYTICS === 'true',
  },

  // -------- Environment --------
  env: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  },
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that all required configuration is present.
 * Call this on app startup.
 */
export function validateConfig(): string[] {
  const errors: string[] = [];

  // Required Firebase config
  if (!appConfig.firebase.projectId) errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required');
  if (!appConfig.firebase.apiKey) errors.push('NEXT_PUBLIC_FIREBASE_API_KEY is required');
  if (!appConfig.firebase.authDomain) errors.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required');
  if (!appConfig.firebase.appId) errors.push('NEXT_PUBLIC_FIREBASE_APP_ID is required');

  // Required reCAPTCHA config
  if (!appConfig.recaptcha.v3.siteKey) errors.push('NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY is required');

  // Required database
  if (!appConfig.database.url) errors.push('DATABASE_URL is required');

  // Warn about missing optional but important configs
  if (!appConfig.blockchain.helius.mainnetRpc && appConfig.env.isProduction) {
    errors.push('⚠️  NEXT_PUBLIC_HELIUS_RPC_URL recommended for production');
  }

  return errors;
}

/**
 * Type-safe config access with autocomplete
 */
export type AppConfig = typeof appConfig;
