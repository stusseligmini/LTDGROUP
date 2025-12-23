/**
 * reCAPTCHA Enterprise Configuration
 * 
 * Security: Site keys are public, secret keys MUST be server-side only
 */

import { clientConfig } from '@/lib/config/client';

export const recaptchaConfig = {
  // Google Cloud Project ID for reCAPTCHA Enterprise
  projectId: clientConfig.firebase.projectId,
  
  // reCAPTCHA v3 (invisible) - for background scoring
  v3: {
    siteKey: clientConfig.recaptcha.v3.siteKey,
    // Minimum score threshold (0.0 = bot, 1.0 = human)
    scoreThreshold: 0.5,
    // Actions to track
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
  
  // Server-side secret key (NEVER expose to client)
  // Accessed only in API routes/functions
  secretKey: process.env.RECAPTCHA_SECRET_KEY,
  
  // API endpoint
  apiEndpoint: 'https://recaptchaenterprise.googleapis.com/v1',
} as const;

export type RecaptchaAction = typeof recaptchaConfig.v3.actions[keyof typeof recaptchaConfig.v3.actions];
