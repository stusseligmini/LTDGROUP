/**
 * Minimal auth helper to extract Firebase ID token from headers/cookies and verify.
 */
import { NextRequest } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';

const ID_TOKEN_COOKIE_NAMES = [
  'firebase-id-token',
  'firebase-auth-token',
  'authToken',
];

export async function getAuthToken(req: NextRequest): Promise<string | null> {
  // Authorization header
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring('Bearer '.length).trim();
  }

  // Cookies
  for (const name of ID_TOKEN_COOKIE_NAMES) {
    const v = req.cookies.get(name)?.value;
    if (v) return v;
  }
  return null;
}

export async function requireAuth(req: NextRequest) {
  const token = await getAuthToken(req);
  if (!token) {
    return { user: null, error: 'missing_token' as const };
  }
  try {
    const decoded = await verifyIdToken(token);
    return { user: decoded, error: null };
  } catch (e: any) {
    const code = (e && (e.code || e.message)) as string | undefined;
    if (process.env.NODE_ENV === 'development' && code === 'FIREBASE_ADMIN_NOT_CONFIGURED_DEV') {
      return { user: null, error: 'unauthorized_dev' as const };
    }
    return { user: null, error: 'invalid_token' as const };
  }
}
