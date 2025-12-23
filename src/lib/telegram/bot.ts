/**
 * Telegram Bot Integration for Celora Wallet
 * Allows users to interact with their wallet via Telegram
 */

import { logger } from '@/lib/logger';

export interface TelegramUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

export interface TelegramMessage {
  messageId: number;
  from: TelegramUser;
  chatId: number;
  text?: string;
  date: number;
}

export interface TelegramBotConfig {
  token: string;
  webhookUrl?: string;
  enabled: boolean;
}

/**
 * Send message to Telegram user
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyToMessageId?: number;
    replyMarkup?: any;
  }
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn('Telegram bot token not configured');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode,
        reply_to_message_id: options?.replyToMessageId,
        reply_markup: options?.replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('Failed to send Telegram message', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error sending Telegram message', error);
    return false;
  }
}

/**
 * Send inline keyboard to Telegram user
 */
export async function sendTelegramKeyboard(
  chatId: number,
  text: string,
  keyboard: Array<Array<{ text: string; callbackData: string }>>
): Promise<boolean> {
  return sendTelegramMessage(chatId, text, {
    replyMarkup: {
      inline_keyboard: keyboard,
    },
  });
}

/**
 * Set webhook URL for Telegram bot
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn('Telegram bot token not configured');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/setWebhook`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('Failed to set Telegram webhook', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error setting Telegram webhook', error);
    return false;
  }
}

/**
 * Verify Telegram webhook secret
 */
export function verifyTelegramWebhook(secret: string, data: string, hash: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const secretKey = crypto.createHmac('sha256', botToken).update(secret).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  return calculatedHash === hash;
}

/**
 * Parse Telegram command from message text
 */
export function parseTelegramCommand(text: string): { command: string; args: string[] } | null {
  if (!text || !text.startsWith('/')) {
    return null;
  }

  const parts = text.split(' ').filter(p => p.length > 0);
  const command = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

