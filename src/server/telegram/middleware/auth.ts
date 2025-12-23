/**
 * Authentication middleware for Telegram bot
 */

import type { TelegramMessage } from '../types';
import { prisma } from '@/server/db/client';

/**
 * Check if Telegram user is linked to a Celora account
 */
export async function checkAuth(message: TelegramMessage): Promise<string | null> {
  const telegramId = message.from?.id;
  if (!telegramId) return null;
  
  const telegramUser = await prisma.telegramUser.findUnique({
    where: {
      telegramId: BigInt(telegramId),
      isActive: true,
    },
    select: {
      userId: true,
    },
  });
  
  return telegramUser?.userId || null;
}

/**
 * Require authentication - send error if not authenticated
 */
export async function requireAuth(
  message: TelegramMessage
): Promise<{ userId: string; telegramId: string } | null> {
  const telegramId = message.from?.id.toString();
  if (!telegramId) return null;
  
  const userId = await checkAuth(message);
  if (!userId) return null;
  
  return { userId, telegramId };
}

















