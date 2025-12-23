import { PrismaClient } from '@prisma/client';

// Set current user id in Postgres session for RLS policies
export async function setRlsUser(prisma: PrismaClient, userId: string) {
  // Use current_setting('app.current_user_id', true) in policies
  // Persist for the connection lifetime; Prisma may pool connections
  if (typeof (prisma as any).$executeRawUnsafe !== 'function') {
    return; // In tests we may mock prisma without this helper
  }

  await prisma.$executeRawUnsafe(
    "SELECT set_config('app.current_user_id', $1, true)",
    userId
  );
}

// Helper to wrap a function with RLS context
export async function withRls<T>(prisma: PrismaClient, userId: string, fn: () => Promise<T>): Promise<T> {
  await setRlsUser(prisma, userId);
  return fn();
}
