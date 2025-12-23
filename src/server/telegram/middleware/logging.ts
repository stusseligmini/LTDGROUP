/**
 * Logging middleware for Telegram bot
 */

import type { TelegramMessage, TelegramCallbackQuery } from '../types';
import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

/**
 * Log message to audit log
 */
export async function logMessage(
  message: TelegramMessage,
  userId?: string,
  action?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: action || 'telegram_message',
        resource: 'telegram',
        resourceId: message.message_id.toString(),
        platform: 'telegram',
        status: 'success',
        metadata: {
          telegramId: message.from?.id,
          chatId: message.chat.id,
          text: message.text,
          username: message.from?.username,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log message', error, { messageId: message.message_id, userId });
  }
}

/**
 * Log callback query
 */
export async function logCallback(
  query: TelegramCallbackQuery,
  userId?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: 'telegram_callback',
        resource: 'telegram',
        resourceId: query.id,
        platform: 'telegram',
        status: 'success',
        metadata: {
          telegramId: query.from.id,
          callbackData: query.data,
          username: query.from.username,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log callback', error, { callbackId: query.id, userId });
  }
}



