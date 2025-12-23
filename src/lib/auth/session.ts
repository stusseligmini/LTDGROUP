import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/firebase/admin';

const SESSION_COOKIE = '__session';

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  // NOTE: Must be called in a Server Action (not here directly) using response cookies
  // Placeholder utility for future server actions.
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    },
  };
}
