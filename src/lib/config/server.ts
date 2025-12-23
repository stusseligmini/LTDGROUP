/**
 * Server-Only Configuration
 * 
 * Access full environment variables (including secrets)
 * NEVER import this in client-side code
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

// Server-only configuration with all secrets
export const serverConfig = {
  // -------- Database --------
  database: {
    url: getEnvVar('DATABASE_URL'),
    directUrl: getOptionalEnvVar('DIRECT_URL'),
  },

  // -------- Firebase Admin SDK --------
  firebaseAdmin: {
    projectId: getEnvVar('FIREBASE_PROJECT_ID'),
    privateKey: getOptionalEnvVar('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
    clientEmail: getOptionalEnvVar('FIREBASE_CLIENT_EMAIL'),
  },

  // -------- Blockchain RPCs (Server-side) --------
  blockchain: {
    solana: {
      rpcUrl: getOptionalEnvVar('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
      wssUrl: getOptionalEnvVar('SOLANA_WSS_URL', 'wss://api.mainnet-beta.solana.com'),
    },
    helius: {
      apiKey: getOptionalEnvVar('HELIUS_API_KEY'),
    },
  },

  // -------- API Keys & Secrets --------
  apiKeys: {
    telegram: {
      botToken: getOptionalEnvVar('TELEGRAM_BOT_TOKEN'),
    },
    stripe: {
      secretKey: getOptionalEnvVar('STRIPE_SECRET_KEY'),
      webhookSecret: getOptionalEnvVar('STRIPE_WEBHOOK_SECRET'),
    },
  },

  // -------- Encryption --------
  encryption: {
    key: getOptionalEnvVar('ENCRYPTION_KEY'),
    jwtSecret: getOptionalEnvVar('JWT_SECRET'),
  },

  // -------- External Services --------
  services: {
    resend: {
      apiKey: getOptionalEnvVar('RESEND_API_KEY'),
    },
  },
};

// Type export for usage
export type ServerConfig = typeof serverConfig;
