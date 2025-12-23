/**
 * /cards command - List and manage virtual cards
 */

import type { TelegramMessage } from '../types';
import type { TelegramBotClient } from '../client';
import { keyboards } from '../utils/keyboard';
import { formatCard, formatError, bold } from '../utils/formatter';
import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

export async function handleCards(
  message: TelegramMessage,
  client: TelegramBotClient,
  userId: string
): Promise<void> {
  const chatId = message.chat.id;
  
  try {
    const cards = await prisma.card.findMany({
      where: {
        userId,
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        nickname: true,
        brand: true,
        status: true,
        expiryMonth: true,
        expiryYear: true,
        monthlySpent: true,
        monthlyLimit: true,
        encryptedNumber: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    if (cards.length === 0) {
      await client.sendMessage({
        chat_id: chatId,
        text: formatError('No cards found. Create a card in the Celora app first.'),
        parse_mode: 'Markdown',
      });
      return;
    }
    
    // Send each card as a separate message with action buttons
    for (const card of cards) {
      const lastFour = card.encryptedNumber.slice(-4);
      const text = formatCard({
        nickname: card.nickname || undefined,
        lastFour,
        brand: card.brand,
        status: card.status,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        monthlySpent: parseFloat(card.monthlySpent.toString()),
        monthlyLimit: card.monthlyLimit ? parseFloat(card.monthlyLimit.toString()) : undefined,
      });
      
      const keyboard = card.status === 'frozen' 
        ? keyboards.cardFrozenActions(card.id)
        : keyboards.cardActions(card.id);
      
      await client.sendMessage({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    logger.error('Error fetching cards', error, { userId, chatId });
    await client.sendMessage({
      chat_id: chatId,
      text: formatError('Failed to fetch cards. Please try again.'),
      parse_mode: 'Markdown',
    });
  }
}



