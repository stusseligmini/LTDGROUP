/**
 * Main webhook handler - Routes incoming Telegram updates
 */

import type { TelegramUpdate } from '../types';
import { TelegramBotClient } from '../client';
import { requireAuth } from '../middleware/auth';
import { logMessage, logCallback } from '../middleware/logging';
import { handleStart } from '../commands/start';
import { handleBalance } from '../commands/balance';
import { handleHelp } from '../commands/help';
import { handleCards } from '../commands/cards';
import { handleReceive } from '../commands/receive';
import { handleCallback } from './callback';
import { logger } from '@/lib/logger';

let botClient: TelegramBotClient;

/**
 * Initialize bot client
 */
export function initializeBotClient(botToken: string): void {
  botClient = new TelegramBotClient(botToken);
}

/**
 * Get bot client instance
 */
export function getBotClient(): TelegramBotClient {
  if (!botClient) {
    throw new Error('Bot client not initialized');
  }
  return botClient;
}

/**
 * Process incoming webhook update
 */
export async function processWebhookUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query, botClient);
    }
  } catch (error) {
    logger.error('Error processing webhook update', error, { updateId: update.update_id });
  }
}

/**
 * Handle text message
 */
async function handleMessage(message: any): Promise<void> {
  const text = message.text?.trim();
  if (!text) return;
  
  // Extract command
  const command = text.startsWith('/') ? text.split(' ')[0].substring(1).toLowerCase() : null;
  
  // Check authentication for protected commands
  const protectedCommands = ['balance', 'send', 'receive', 'cards', 'history', 'settings'];
  
  if (command && protectedCommands.includes(command)) {
    const auth = await requireAuth(message);
    
    if (!auth) {
      await botClient.sendMessage({
        chat_id: message.chat.id,
        text: '🔒 You need to link your Telegram account first.\n\nUse /start to see linking instructions.',
        parse_mode: 'Markdown',
      });
      return;
    }
    
    // Log authenticated action
    await logMessage(message, auth.userId, `command_${command}`);
    
    // Route to command handler
    switch (command) {
      case 'balance':
        await handleBalance(message, botClient, auth.userId);
        break;
      case 'cards':
        await handleCards(message, botClient, auth.userId);
        break;
      case 'receive':
        await handleReceive(message, botClient, auth.userId);
        break;
      // Add more commands here
      default:
        await botClient.sendMessage({
          chat_id: message.chat.id,
          text: 'Command not implemented yet. Type /help to see available commands.',
        });
    }
  } else {
    // Handle public commands
    switch (command) {
      case 'start': {
        const auth = await requireAuth(message);
        await handleStart(message, botClient, !!auth);
        await logMessage(message, auth?.userId, 'command_start');
        break;
      }
      case 'help':
        await handleHelp(message, botClient);
        await logMessage(message, undefined, 'command_help');
        break;
      default:
        // Unknown command or regular text
        await botClient.sendMessage({
          chat_id: message.chat.id,
          text: 'Unknown command. Type /help to see available commands.',
        });
    }
  }
}



