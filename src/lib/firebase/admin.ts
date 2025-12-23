/**
 * Firebase Admin SDK
 * 
 * Server-side Firebase Admin for token verification
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

/**
 * Get or initialize Firebase Admin app
 */
export function getFirebaseAdmin(): { app: App; auth: Auth } {
  if (adminApp && adminAuth) {
    return { app: adminApp, auth: adminAuth };
  }

  // Check if already initialized
  const existingApp = getApps()[0];
  if (existingApp) {
    adminApp = existingApp;
    adminAuth = getAuth(adminApp);
    return { app: adminApp, auth: adminAuth };
  }

  // Initialize with service account or use default credentials
  // Prefer explicit service account object or decomposed env vars
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON string if provided
  const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  
  const adminConfig: any = {
    projectId,
  };

  // First priority: decomposed env vars (works in all environments)
  if (clientEmail && privateKeyRaw && projectId) {
    // Normalize escaped newlines
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    try {
      adminConfig.credential = cert({
        projectId,
        clientEmail,
        privateKey,
      });
      console.log('[Firebase Admin] ✅ Initialized with decomposed env vars');
    } catch (e) {
      console.error('[Firebase Admin] Failed to build credential from env vars:', e);
    }
  } else if (serviceAccount) {
    // Second priority: try JSON string
    try {
      const serviceAccountJson = JSON.parse(serviceAccount);
      adminConfig.credential = cert(serviceAccountJson);
      console.log('[Firebase Admin] ✅ Initialized with JSON service account');
    } catch (error) {
      console.warn('[Firebase Admin] Failed to parse service account JSON:', error);
    }
  } else {
    console.warn('[Firebase Admin] No service account credentials found; using default credentials (application default credentials or emulator)');
  }

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is required for Firebase Admin initialization');
  }

  adminApp = initializeApp(adminConfig);
  adminAuth = getAuth(adminApp);

  console.info('[Firebase Admin] Initialized', {
    projectId,
    credentialType: adminConfig.credential ? 'service-account' : 'default',
  });

  return { app: adminApp, auth: adminAuth };
}

/**
 * Verify Firebase ID token
 */
export async function verifyIdToken(idToken: string) {
  try {
    const { auth } = getFirebaseAdmin();
    return await auth.verifyIdToken(idToken);
  } catch (error) {
    // Log error but don't expose details in production
    console.error('[Firebase Admin] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    // In development, surface a stable error to allow friendly 401 handling
    if (process.env.NODE_ENV === 'development') {
      const devErr = new Error('FIREBASE_ADMIN_NOT_CONFIGURED_DEV');
      // Attach a recognizable code
      // @ts-expect-error augment
      devErr.code = 'FIREBASE_ADMIN_NOT_CONFIGURED_DEV';
      throw devErr;
    }
    throw error;
  }
}

