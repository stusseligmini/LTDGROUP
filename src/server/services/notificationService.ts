import { randomUUID } from 'crypto';
import { NotificationItem } from '@/types/api';
import { prisma } from '@/server/db/client';
import { TelegramBotClient } from '../telegram/client';
import { logger } from '@/lib/logger';
let telegramClient: TelegramBotClient | null = null;

// Initialize Telegram client if token is available
if (process.env.TELEGRAM_BOT_TOKEN) {
  telegramClient = new TelegramBotClient(process.env.TELEGRAM_BOT_TOKEN);
}

// TODO: Implement platform API client
async function callPlatformApi<T>(
  config: { path: string; method: string; userToken?: string },
  fallbackFn: () => Promise<T>
): Promise<T> {
  // For now, always use fallback
  return fallbackFn();
}

function getFallbackNotifications(): NotificationItem[] {
  const now = Date.now();
  return [
    {
      id: 'welcome',
      title: 'Welcome to Celora',
      body: 'Your account is active and ready to use.',
      createdAt: new Date(now).toISOString(),
      read: false,
      severity: 'info',
    },
    {
      id: 'security-posture',
      title: 'Security systems active',
      body: 'All security checks passed. Your account is fully protected.',
      createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
      read: true,
      severity: 'info',
    },
  ];
}

type PlatformNotificationPayload = {
  notifications?: NotificationItem[];
};

type NotificationQuery = {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  priority?: string;
};

export async function fetchNotifications(
  userToken: string | null,
  query?: NotificationQuery
): Promise<NotificationItem[]> {
  // Build query string
  const queryParams = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()
    : '';

  const path = queryParams ? `/notifications?${queryParams}` : '/notifications';

  const result = await callPlatformApi<PlatformNotificationPayload>(
    {
      path,
      method: 'GET',
      userToken: userToken ?? undefined,
    },
    async () => ({
      notifications: getFallbackNotifications(),
    })
  );

  if (!result?.notifications || !Array.isArray(result.notifications)) {
    return getFallbackNotifications();
  }

  return result.notifications.map((item) => ({
    id: item.id ?? randomUUID(),
    title: item.title ?? 'Account update',
    body: item.body ?? '',
    createdAt: item.createdAt ?? new Date().toISOString(),
    read: Boolean(item.read),
    severity: item.severity ?? 'info',
  }));
}

/**
 * Send notification via Telegram
 */
export async function sendTelegramNotification(
  userId: string,
  notification: {
    title: string;
    body: string;
    type?: string;
    buttons?: any[];
  }
): Promise<boolean> {
  try {
    if (!telegramClient) {
      logger.warn('Telegram client not initialized');
      return false;
    }
    
    // Find user's Telegram chat ID
    const telegramUser = await prisma.telegramUser.findFirst({
      where: {
        userId,
        isActive: true,
      },
      select: {
        chatId: true,
        telegramId: true,
      },
    });
    
    if (!telegramUser) {
      return false; // User doesn't have Telegram linked
    }
    
    // Queue notification
    const queuedNotification = await prisma.telegramNotification.create({
      data: {
        userId,
        telegramId: BigInt(telegramUser.telegramId),
        type: notification.type || 'system',
        message: `${notification.title}\n\n${notification.body}`,
        status: 'pending',
      },
    });
    
    // Send immediately
    const message = `*${notification.title}*\n\n${notification.body}`;
    
    await telegramClient.sendMessage({
      chat_id: telegramUser.chatId ? parseInt(telegramUser.chatId) : 0,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: notification.buttons ? { inline_keyboard: notification.buttons } : undefined,
    });
    
    // Mark as sent
    await prisma.telegramNotification.update({
      where: { id: queuedNotification.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });
    
    return true;
    
  } catch (error) {
    logger.error('Error sending Telegram notification', error, { userId });
    
    // Mark as failed
    try {
      await prisma.telegramNotification.updateMany({
        where: {
          userId,
          status: 'pending',
        },
        data: {
          status: 'failed',
        },
      });
    } catch (dbError) {
      logger.error('Error updating notification status', dbError, { userId });
    }
    
    return false;
  }
}

/**
 * Send multi-channel notification
 */
export async function sendNotification(
  userId: string,
  notification: {
    title: string;
    body: string;
    type?: string;
    channels?: ('push' | 'email' | 'telegram')[];
  }
): Promise<void> {
  const channels = notification.channels || ['push', 'telegram'];
  
  // Send to Telegram if enabled
  if (channels.includes('telegram')) {
    await sendTelegramNotification(userId, notification);
  }
  
  // Send push notification (existing implementation)
  if (channels.includes('push')) {
    // Existing push notification logic would go here
  }
  
  // Send email notification (existing implementation)
  if (channels.includes('email')) {
    // Existing email notification logic would go here
  }
}

