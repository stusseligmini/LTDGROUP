/**
 * Idempotency checking for API requests
 * Prevents duplicate requests using idempotency keys
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface IdempotencyResult {
  isDuplicate: boolean;
  previousResponse?: any;
}

/**
 * Check if a request with this idempotency key was already processed
 */
export async function checkIdempotency(
  idempotencyKey: string,
  userId: string
): Promise<IdempotencyResult> {
  const existing = await prisma.idempotencyKey.findFirst({
    where: {
      key: idempotencyKey,
      userId,
    },
  });

  if (existing) {
    return {
      isDuplicate: true,
      previousResponse: existing.responseBody as any,
    };
  }

  return { isDuplicate: false };
}

/**
 * Store idempotency key and response for future duplicate detection
 */
export async function storeIdempotency(
  idempotencyKey: string,
  userId: string,
  response: any,
  expiresInHours: number = 24
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  await prisma.idempotencyKey.upsert({
    where: {
      key: idempotencyKey,
    },
    create: {
      key: idempotencyKey,
      userId,
      endpoint: 'unknown',
      method: 'POST',
      statusCode: 200,
      responseBody: JSON.parse(JSON.stringify(response)),
      expiresAt,
    },
    update: {
      responseBody: JSON.parse(JSON.stringify(response)),
      expiresAt,
    },
  });
}
