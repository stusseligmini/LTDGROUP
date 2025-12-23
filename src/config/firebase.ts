/**
 * Firebase Configuration
 * 
 * Client-side Firebase config for authentication
 */

import { clientConfig } from '@/lib/config/client';

export const firebaseConfig = {
  apiKey: clientConfig.firebase.apiKey,
  authDomain: clientConfig.firebase.authDomain,
  projectId: clientConfig.firebase.projectId,
  storageBucket: clientConfig.firebase.storageBucket,
  messagingSenderId: clientConfig.firebase.messagingSenderId,
  appId: clientConfig.firebase.appId,
  measurementId: clientConfig.firebase.measurementId || undefined,
};

// Validate required config
if (typeof window !== 'undefined') {
  const required: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key]);

  if (missing.length > 0) {
    console.warn('[Firebase] Missing required client config keys:', missing);
  } else {
    console.info('[Firebase] Client config loaded', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      measurement: firebaseConfig.measurementId ? 'enabled' : 'disabled',
    });
  }
}

