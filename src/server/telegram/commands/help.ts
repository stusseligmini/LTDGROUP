/**
 * /help command - Show available commands
 */

import type { TelegramMessage } from '../types';
import type { TelegramBotClient } from '../client';
import { bold, code } from '../utils/formatter';

export async function handleHelp(
  message: TelegramMessage,
  client: TelegramBotClient
): Promise<void> {
  const chatId = message.chat.id;
  
  const text = `${bold('Celora Bot Commands')}\n\n` +
    `${bold('Wallet & Balance')}\n` +
    `${code('/balance')} - View all wallet balances\n` +
    `${code('/wallets')} - List all your wallets\n\n` +
    `${bold('Transactions')}\n` +
    `${code('/send')} - Send cryptocurrency\n` +
    `${code('/receive')} - Generate receive QR code\n` +
    `${code('/history')} - View transaction history\n\n` +
    `${bold('Virtual Cards')}\n` +
    `${code('/cards')} - Manage virtual cards\n` +
    `${code('/card <id>')} - View specific card\n\n` +
    `${bold('Settings')}\n` +
    `${code('/settings')} - Bot preferences\n` +
    `${code('/link')} - Link Telegram account\n` +
    `${code('/unlink')} - Unlink account\n\n` +
    `${bold('Other')}\n` +
    `${code('/start')} - Show welcome message\n` +
    `${code('/help')} - Show this help message\n\n` +
    `You can also use the menu buttons below messages for quick access to common actions.`;
  
  await client.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

















