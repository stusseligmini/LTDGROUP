/**
 * Firebase Client
 * Initializes Firebase app for extension and web
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInAnonymously, signInWithCustomToken, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseConfig } from '@/config/firebase';
import { recaptchaConfig } from '@/config/recaptcha';

let appInternal: FirebaseApp | null = null;
let authInternal: Auth | null = null;
let dbInternal: Firestore | null = null;
let firebaseInitialized = false;

export const isFirebaseClientConfigured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.length > 0);

/**
 * Lazy initialization of Firebase app
 * Only initializes when explicitly called (client-side only)
 */
function initializeFirebaseClient(): void {
  if (firebaseInitialized || typeof window === 'undefined') {
    return;
  }

  console.log('🔥 [Firebase Client] Initializing... isConfigured:', isFirebaseClientConfigured);
  console.log('🔥 [Firebase Client] Config values:', firebaseConfig);
  
  try {
    if (!isFirebaseClientConfigured) {
      console.warn('[Firebase] ❌ Client config missing; skipping Firebase init in development.');
      console.log('[Firebase] Config check:', firebaseConfig);
      firebaseInitialized = true;
      return;
    }

    console.log('[Firebase] ✅ Config valid, initializing Firebase app...');
    if (getApps().length === 0) {
      appInternal = initializeApp(firebaseConfig);
      console.log('[Firebase] ✅ App initialized');
    } else {
      appInternal = getApps()[0];
      console.log('[Firebase] ✅ Using existing app');
    }

    authInternal = getAuth(appInternal);
    dbInternal = getFirestore(appInternal);
    console.log('[Firebase] ✅ Auth and Firestore initialized');

    // Initialize App Check with debug token in development, reCAPTCHA in production
    try {
      if (process.env.NODE_ENV === 'development') {
        // Use debug token provider for local development
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        console.log('🔧 App Check: Using debug mode for development');
      }
      
      const siteKey = recaptchaConfig.v3.siteKey;
      if (siteKey || process.env.NODE_ENV === 'development') {
        initializeAppCheck(appInternal, {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        console.log('✅ Firebase App Check initialized with reCAPTCHA Enterprise');
      }
    } catch (error) {
      console.warn('⚠️ App Check initialization failed:', error);
      // Non-blocking - auth will still work
    }

    // Use emulator in development if available
    if (process.env.NODE_ENV === 'development' && isFirebaseClientConfigured && authInternal && dbInternal) {
      const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
      if (useEmulator) {
        try {
          connectAuthEmulator(authInternal, 'http://localhost:9099', { disableWarnings: true });
          connectFirestoreEmulator(dbInternal, 'localhost', 8080);
        } catch (err) {
          // Emulator already connected or not available
          console.log('[Firebase] Emulator connection skipped');
        }
      }
    }
    
    firebaseInitialized = true;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    // Do not rethrow in development; allow app to render a friendly banner
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
    firebaseInitialized = true;
  }
}

// Getter functions for lazy initialization
export function getFirebaseAuth(): Auth | null {
  if (typeof window !== 'undefined' && !firebaseInitialized) {
    initializeFirebaseClient();
  }
  return authInternal;
}

export function getFirebaseDb(): Firestore | null {
  if (typeof window !== 'undefined' && !firebaseInitialized) {
    initializeFirebaseClient();
  }
  return dbInternal;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window !== 'undefined' && !firebaseInitialized) {
    initializeFirebaseClient();
  }
  return appInternal;
}

/**
 * Sign in anonymously (for Telegram users without account)
 */
export async function signInAnonymous() {
  try {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('FIREBASE_CLIENT_NOT_CONFIGURED');
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    throw error;
  }
}

/**
 * Sign in with custom token (for Telegram ID → Firebase mapping)
 */
export async function signInWithTelegramToken(customToken: string) {
  try {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('FIREBASE_CLIENT_NOT_CONFIGURED');
    const userCredential = await signInWithCustomToken(auth, customToken);
    return userCredential.user;
  } catch (error) {
    console.error('Custom token sign-in failed:', error);
    throw error;
  }
}

// Legacy exports for backward compatibility - use getter functions instead
export const app = appInternal as unknown as FirebaseApp;
export const auth = getFirebaseAuth() as unknown as Auth;
export const db = getFirebaseDb() as unknown as Firestore;
