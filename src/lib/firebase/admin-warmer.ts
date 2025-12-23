/**
 * Firebase Admin SDK Warming
 * Pre-initialize Firebase Admin to avoid cold start delays
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

let adminApp: App | null = null;
let isWarmed = false;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebaseAdmin(): App {
  if (adminApp) {
    return adminApp;
  }

  try {
    const apps = getApps();
    
    if (apps.length > 0) {
      adminApp = apps[0];
      return adminApp;
    }

    // Initialize with service account
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (serviceAccountPath) {
      // Option 1: Use service account JSON file
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(serviceAccountPath);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } else if (projectId && clientEmail && privateKey) {
      // Option 2: Use decomposed environment variables
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    } else {
      throw new Error('Firebase Admin credentials not configured');
    }

    logger.info('Firebase Admin SDK initialized', { projectId });
    return adminApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', error);
    throw error;
  }
}

/**
 * Warm Firebase Admin SDK
 * Pre-initializes Auth and Firestore to avoid first-request delays
 */
export async function warmFirebaseAdmin(): Promise<void> {
  if (isWarmed) {
    logger.debug('Firebase Admin already warmed');
    return;
  }

  try {
    logger.info('Warming Firebase Admin SDK...');

    // Initialize app
    const app = initializeFirebaseAdmin();

    // Warm Auth service
    const auth = getAuth(app);
    await auth.getUser('warmup-dummy-user').catch(() => {
      // Expected to fail - just warming the connection
    });

    // Warm Firestore service
    const db = getFirestore(app);
    await db.collection('_warmup').doc('test').get().catch(() => {
      // Expected to fail - just warming the connection
    });

    isWarmed = true;
    logger.info('Firebase Admin SDK warmed successfully');
  } catch (error) {
    logger.error('Failed to warm Firebase Admin SDK', error);
    // Don't throw - warming is non-critical
  }
}

/**
 * Get Firebase Admin app instance
 */
export function getFirebaseAdmin(): App {
  if (!adminApp) {
    return initializeFirebaseAdmin();
  }
  return adminApp;
}

/**
 * Check if Firebase Admin is initialized
 */
export function isFirebaseAdminInitialized(): boolean {
  return adminApp !== null;
}

/**
 * Check if Firebase Admin is warmed
 */
export function isFirebaseAdminWarmed(): boolean {
  return isWarmed;
}

// Auto-warm on server startup (only in Node.js environment)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Warm after a short delay to not block startup
  setTimeout(() => {
    warmFirebaseAdmin().catch((error) => {
      logger.error('Auto-warm failed', error);
    });
  }, 1000);
}
