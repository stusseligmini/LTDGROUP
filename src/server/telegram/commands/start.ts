/**
 * /start command - Welcome and account linking
 */

import type { TelegramMessage } from '../types';
import type { TelegramBotClient } from '../client';
import { keyboards } from '../utils/keyboard';
import { bold, escapeMarkdown } from '../utils/formatter';

export async function handleStart(
  message: TelegramMessage,
  client: TelegramBotClient,
  isLinked: boolean
): Promise<void> {
  const chatId = message.chat.id;
  const firstName = message.from?.first_name || 'there';
  
  if (!isLinked) {
    // User not linked - show linking instructions
    const text = `👋 ${bold(`Welcome to Celora, ${firstName}!`)}\n\n` +
      `Celora is your all-in-one crypto wallet with virtual cards, multi-chain support, and advanced security.\n\n` +
      `To get started, you need to link your Telegram account with your Celora account:\n\n` +
      `1️⃣ Open the Celora app (web or extension)\n` +
      `2️⃣ Go to Settings → Telegram\n` +
      `3️⃣ Click "Link Telegram Account"\n` +
      `4️⃣ Enter the verification code shown\n\n` +
      `Once linked, you can:\n` +
      `💰 Check your balances\n` +
      `💳 Manage virtual cards\n` +
      `📤 Send crypto\n` +
      `📥 Receive payments\n` +
      `📊 View transaction history\n\n` +
      `Type /help to see all available commands.`;
    
    await client.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  } else {
    // User already linked - show main menu
    const text = `👋 ${bold(`Welcome back, ${firstName}!`)}\n\n` +
      `Choose an option below or type /help for all commands:`;
    
    await client.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: keyboards.mainMenu(),
    });
  }
}

















