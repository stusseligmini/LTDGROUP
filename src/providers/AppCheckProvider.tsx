/**
 * Firebase App Check Provider
 * 
 * Initializes App Check with reCAPTCHA Enterprise to protect Firebase resources
 */

'use client';

// Note: Firebase App Check is initialized in src/lib/firebase/client.ts
// This provider is kept for backwards compatibility but does nothing
export function AppCheckProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
