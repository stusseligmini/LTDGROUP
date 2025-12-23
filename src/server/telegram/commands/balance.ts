/**
 * /balance command - Show wallet balances
 */

import type { TelegramMessage } from '../types';
import type { TelegramBotClient } from '../client';
import { keyboards } from '../utils/keyboard';
import { formatBalanceMessage, formatError } from '../utils/formatter';
import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

export async function handleBalance(
  message: TelegramMessage,
  client: TelegramBotClient,
  userId: string
): Promise<void> {
  const chatId = message.chat.id;
  
  try {
    // Fetch user's wallets
    const wallets = await prisma.wallet.findMany({
      where: {
        userId,
        isHidden: false, // Don't show hidden wallets via Telegram
      },
      select: {
        id: true,
        blockchain: true,
        address: true,
        balanceCache: true,
        balanceFiat: true,
        label: true,
      },
    });
    
    if (wallets.length === 0) {
      await client.sendMessage({
        chat_id: chatId,
        text: formatError('No wallets found. Create a wallet in the Celora app first.'),
        parse_mode: 'Markdown',
      });
      return;
    }
    
    // Format balances
    const balances = wallets.map(wallet => ({
      symbol: wallet.blockchain.toUpperCase(),
      amount: wallet.balanceCache || '0',
      fiatValue: wallet.balanceFiat ? parseFloat(wallet.balanceFiat.toString()) : 0,
    }));
    
    const text = formatBalanceMessage(balances);
    
    await client.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: keyboards.balanceActions(),
    });
  } catch (error) {
    logger.error('Error fetching balances', error, { userId, chatId });
    await client.sendMessage({
      chat_id: chatId,
      text: formatError('Failed to fetch balances. Please try again.'),
      parse_mode: 'Markdown',
    });
  }
}



