/**
 * Firebase App Check Configuration
 * 
 * App Check protects your Firebase backend resources (Firestore, Functions, Storage)
 * from abuse by ensuring requests come from your authentic app.
 * 
 * Uses reCAPTCHA Enterprise as the attestation provider.
 */

import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeAppCheck, 
  ReCaptchaEnterpriseProvider,
  getToken,
  AppCheck 
} from 'firebase/app-check';
import { recaptchaConfig } from '@/config/recaptcha';

// Firebase config (already exists in your app)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let appCheckInstance: AppCheck | null = null;

/**
 * Initialize Firebase App Check with reCAPTCHA Enterprise
 * 
 * WARNING: This function is DEPRECATED and should not be called directly.
 * Firebase App Check is automatically initialized in src/lib/firebase/client.ts
 * 
 * This function is kept for backwards compatibility only.
 */
export function initializeFirebaseAppCheck() {
  // Only initialize in browser
  if (typeof window === 'undefined') {
    console.log('[AppCheck] Skipping - not in browser');
    return null;
  }

  // Return existing instance if already initialized
  if (appCheckInstance) {
    console.log('[AppCheck] Already initialized, returning existing instance');
    return appCheckInstance;
  }

  console.warn('[AppCheck] ⚠️ This function is deprecated. AppCheck should be initialized in client.ts');

  try {
    // Get or initialize Firebase app
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    console.log('[AppCheck] Using Firebase app:', !!app);

    // Get reCAPTCHA Enterprise site key
    const siteKey = recaptchaConfig.v3.siteKey;
    
    if (!siteKey) {
      console.warn('App Check: reCAPTCHA site key not configured');
      return null;
    }

    // Initialize App Check with reCAPTCHA Enterprise provider
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true, // Auto-refresh tokens before expiry
    });

    console.log('✅ Firebase App Check initialized with reCAPTCHA Enterprise');
    return appCheckInstance;
  } catch (error) {
    console.error('Failed to initialize App Check:', error);
    return null;
  }
}

/**
 * Get an App Check token manually (for custom use cases)
 * Normally tokens are attached automatically to Firebase SDK calls
 */
export async function getAppCheckToken(forceRefresh = false): Promise<string | null> {
  if (!appCheckInstance) {
    console.warn('App Check not initialized');
    return null;
  }

  try {
    const tokenResult = await getToken(appCheckInstance, forceRefresh);
    return tokenResult.token;
  } catch (error) {
    console.error('Failed to get App Check token:', error);
    return null;
  }
}

/**
 * Verify App Check is working
 * Returns true if token can be obtained
 */
export async function verifyAppCheck(): Promise<boolean> {
  const token = await getAppCheckToken();
  return token !== null;
}
