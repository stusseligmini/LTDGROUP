/**
 * Callback query handler - Handle inline button clicks
 */

import type { TelegramCallbackQuery } from '../types';
import type { TelegramBotClient } from '../client';
import { requireAuth } from '../middleware/auth';
import { logCallback } from '../middleware/logging';
import { keyboards } from '../utils/keyboard';
import { formatSuccess, formatError, formatCard } from '../utils/formatter';
import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

/**
 * Handle callback query from inline keyboards
 */
export async function handleCallback(
  query: TelegramCallbackQuery,
  client: TelegramBotClient
): Promise<void> {
  const data = query.data || '';
  const [action, ...params] = data.split(':');
  
  // Answer callback query immediately
  await client.answerCallbackQuery(query.id);
  
  // Check auth
  const auth = await requireAuth({ from: query.from } as any);
  if (!auth) {
    await client.sendMessage({
      chat_id: query.from.id,
      text: formatError('You need to link your account first. Use /start to see instructions.'),
      parse_mode: 'Markdown',
    });
    return;
  }
  
  // Log callback
  await logCallback(query, auth.userId);
  
  // Route to handler
  try {
    switch (action) {
      case 'menu':
        await handleMenuCallback(query, client, params[0]);
        break;
      case 'balance':
        await handleBalanceCallback(query, client, auth.userId, params[0]);
        break;
      case 'card':
        await handleCardCallback(query, client, auth.userId, params[0], params[1]);
        break;
      case 'chain':
        await handleChainCallback(query, client, params[0]);
        break;
      default:
        await client.sendMessage({
          chat_id: query.from.id,
          text: formatError('Unknown action'),
          parse_mode: 'Markdown',
        });
    }
  } catch (error) {
    logger.error('Error handling callback', error, { action, userId: auth.userId, callbackId: query.id });
    await client.sendMessage({
      chat_id: query.from.id,
      text: formatError('An error occurred. Please try again.'),
      parse_mode: 'Markdown',
    });
  }
}

/**
 * Handle menu navigation
 */
async function handleMenuCallback(
  query: TelegramCallbackQuery,
  client: TelegramBotClient,
  menuItem: string
): Promise<void> {
  const chatId = query.from.id;
  
  switch (menuItem) {
    case 'main':
      await client.sendMessage({
        chat_id: chatId,
        text: '🏠 Main Menu\n\nSelect an option:',
        parse_mode: 'Markdown',
        reply_markup: keyboards.mainMenu(),
      });
      break;
    // Add more menu items
  }
}

/**
 * Handle balance actions
 */
async function handleBalanceCallback(
  query: TelegramCallbackQuery,
  client: TelegramBotClient,
  userId: string,
  actionType: string
): Promise<void> {
  const chatId = query.from.id;
  
  if (actionType === 'refresh') {
    // Fetch fresh balances
    const wallets = await prisma.wallet.findMany({
      where: { userId, isHidden: false },
      select: {
        blockchain: true,
        balanceCache: true,
        balanceFiat: true,
      },
    });
    
    // Format and send
    let text = '*Updated Balances*\n\n';
    for (const wallet of wallets) {
      text += `${wallet.blockchain.toUpperCase()}: ${wallet.balanceCache || '0'}\n`;
    }
    
    await client.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: keyboards.balanceActions(),
    });
  }
}

/**
 * Handle card actions
 */
async function handleCardCallback(
  query: TelegramCallbackQuery,
  client: TelegramBotClient,
  userId: string,
  action: string,
  cardId: string
): Promise<void> {
  const chatId = query.from.id;
  
  // Verify card belongs to user
  const card = await prisma.card.findFirst({
    where: { id: cardId, userId },
  });
  
  if (!card) {
    await client.sendMessage({
      chat_id: chatId,
      text: formatError('Card not found'),
      parse_mode: 'Markdown',
    });
    return;
  }
  
  switch (action) {
    case 'freeze':
      await prisma.card.update({
        where: { id: cardId },
        data: { status: 'frozen', updatedAt: new Date() },
      });
      await client.sendMessage({
        chat_id: chatId,
        text: formatSuccess('Card has been frozen'),
        parse_mode: 'Markdown',
      });
      break;
      
    case 'unfreeze':
      await prisma.card.update({
        where: { id: cardId },
        data: { status: 'active', updatedAt: new Date() },
      });
      await client.sendMessage({
        chat_id: chatId,
        text: formatSuccess('Card has been unfrozen'),
        parse_mode: 'Markdown',
      });
      break;
      
    case 'details': {
      const lastFour = card.encryptedNumber.slice(-4);
      await client.sendMessage({
        chat_id: chatId,
        text: formatCard({
          nickname: card.nickname || undefined,
          lastFour,
          brand: card.brand,
          status: card.status,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          monthlySpent: parseFloat(card.monthlySpent.toString()),
          monthlyLimit: card.monthlyLimit ? parseFloat(card.monthlyLimit.toString()) : undefined,
        }),
        parse_mode: 'Markdown',
      });
      break;
    }
  }
}

/**
 * Handle chain selection
 */
async function handleChainCallback(
  query: TelegramCallbackQuery,
  client: TelegramBotClient,
  chain: string
): Promise<void> {
  // Store chain selection in session for multi-step commands
  // This would integrate with a session manager
  await client.sendMessage({
    chat_id: query.from.id,
    text: `Selected ${chain.toUpperCase()}. Continue with your action.`,
    parse_mode: 'Markdown',
  });
}



