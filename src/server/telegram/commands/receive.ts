/**
 * /receive command - Generate receive QR code
 */

import type { TelegramMessage, BotSession } from '../types';
import type { TelegramBotClient } from '../client';
import { keyboards } from '../utils/keyboard';
import { bold, code, formatAddress } from '../utils/formatter';
import { prisma } from '@/server/db/client';
import QRCode from 'qrcode';
import { logger } from '@/lib/logger';

export async function handleReceive(
  message: TelegramMessage,
  client: TelegramBotClient,
  userId: string,
  session?: BotSession
): Promise<void> {
  const chatId = message.chat.id;
  
  // Step 1: Ask user to select chain
  if (!session || !session.data?.chain) {
    await client.sendMessage({
      chat_id: chatId,
      text: `${bold('Receive Crypto')}\n\nSelect the blockchain:`,
      parse_mode: 'Markdown',
      reply_markup: keyboards.chainSelector(),
    });
    return;
  }
  
  // Step 2: Show wallet address and QR code
  try {
    const chain = session.data.chain as string;
    
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        blockchain: chain.toLowerCase(),
        isHidden: false,
      },
      select: {
        address: true,
        blockchain: true,
        label: true,
      },
    });
    
    if (!wallet) {
      await client.sendMessage({
        chat_id: chatId,
        text: `❌ No ${chain} wallet found. Create one in the Celora app first.`,
        parse_mode: 'Markdown',
      });
      return;
    }
    
    // Generate QR code
    const qrCodeBuffer = await QRCode.toBuffer(wallet.address, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    const caption = `${bold(`Receive ${chain.toUpperCase()}`)}\n\n` +
      `${wallet.label || 'Wallet'}\n\n` +
      `${code(wallet.address)}\n\n` +
      `Scan QR code or copy address above to receive payments.`;
    
    await client.sendPhoto(chatId, qrCodeBuffer, caption);
    
  } catch (error) {
    logger.error('Error generating receive QR', error, { userId, chain: session?.data?.chain });
    await client.sendMessage({
      chat_id: chatId,
      text: '❌ Failed to generate QR code. Please try again.',
      parse_mode: 'Markdown',
    });
  }
}



