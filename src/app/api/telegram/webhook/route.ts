/**
 * Telegram Bot Webhook Endpoint
 * Handles incoming messages and commands from Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { appConfig } from '@/lib/config/app';
import { logger } from '@/lib/logger';
import {
  sendTelegramMessage,
  sendTelegramKeyboard,
  parseTelegramCommand,
  type TelegramMessage,
} from '@/lib/telegram/bot';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

// Check if Telegram bot is enabled
const isTelegramBotEnabled = () => {
  return process.env.TELEGRAM_BOT_ENABLED === 'true' && !!process.env.TELEGRAM_BOT_TOKEN;
};

/**
 * Handle /send command: Send SOL to username or address
 * Usage: /send @username 0.5 SOL or /send <address> 0.5
 */
async function handleSendCommand(
  message: TelegramMessage,
  args: string[]
): Promise<void> {
  if (args.length < 2) {
    await sendTelegramMessage(
      message.chatId,
      '❌ Usage: /send @username 0.5 SOL\nOr: /send <address> 0.5 SOL',
      { replyToMessageId: message.messageId }
    );
    return;
  }

  const recipient = args[0];
  const amountStr = args[1];
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    await sendTelegramMessage(
      message.chatId,
      '❌ Invalid amount. Please provide a valid SOL amount.',
      { replyToMessageId: message.messageId }
    );
    return;
  }

  // Find user by Telegram ID
  const user = await prisma.user.findUnique({
    where: { telegramId: String(message.from.id) },
    include: {
      wallets: {
        where: { blockchain: 'solana', isDefault: true },
        take: 1,
      },
    },
  });

  if (!user || user.wallets.length === 0) {
    await sendTelegramMessage(
      message.chatId,
      '❌ No Solana wallet found. Please create a wallet first via the app.',
      { replyToMessageId: message.messageId }
    );
    return;
  }

  const wallet = user.wallets[0];

  // Resolve username if needed
  let recipientAddress = recipient;
  if (recipient.startsWith('@')) {
    const username = recipient.substring(1).replace('.sol', '');
    const recipientUser = await prisma.user.findUnique({
      where: { username },
      include: {
        wallets: {
          where: { blockchain: 'solana' },
          take: 1,
        },
      },
    });

    if (!recipientUser || recipientUser.wallets.length === 0) {
      await sendTelegramMessage(
        message.chatId,
        `❌ Username ${recipient} not found.`,
        { replyToMessageId: message.messageId }
      );
      return;
    }

    recipientAddress = recipientUser.wallets[0].address;
  }

  // Send confirmation with mini app button
  await sendTelegramKeyboard(
    message.chatId,
    `📤 Send ${amount} SOL to ${recipient.startsWith('@') ? recipient : `${recipient.slice(0, 8)}...`}?\n\nTap the button below to confirm in the app.`,
    [
      [
        {
          text: '✨ Open Wallet to Confirm',
          callbackData: `send_confirm:${recipientAddress}:${amount}`,
        },
      ],
    ]
  );
}

/**
 * Handle /balance command: Show wallet balance
 */
async function handleBalanceCommand(
  message: TelegramMessage
): Promise<void> {
  // Find user by Telegram ID
  const user = await prisma.user.findUnique({
    where: { telegramId: String(message.from.id) },
    include: {
      wallets: {
        where: { blockchain: 'solana', isDefault: true },
        take: 1,
      },
    },
  });

  if (!user || user.wallets.length === 0) {
    await sendTelegramMessage(
      message.chatId,
      '❌ No Solana wallet found. Please create a wallet first.',
      { replyToMessageId: message.messageId }
    );
    return;
  }

  const wallet = user.wallets[0];

  // Fetch balance from API
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/solana/balance?address=${wallet.address}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }

    const data = await response.json();
    const balance = parseFloat(data.data.balanceSOL || 0);
    const usdBalance = balance * 150; // Approximate, should fetch real price

    await sendTelegramMessage(
      message.chatId,
      `💰 <b>Your Balance</b>\n\n` +
        `SOL: <code>${balance.toFixed(4)}</code>\n` +
        `USD: ~$${usdBalance.toFixed(2)}\n\n` +
        `Address: <code>${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}</code>`,
      {
        parseMode: 'HTML',
        replyToMessageId: message.messageId,
      }
    );
  } catch (error) {
    logger.error('Error fetching balance for Telegram command', error);
    await sendTelegramMessage(
      message.chatId,
      '❌ Failed to fetch balance. Please try again later.',
      { replyToMessageId: message.messageId }
    );
  }
}

/**
 * Handle /receive command: Show receive address with QR code
 */
async function handleReceiveCommand(
  message: TelegramMessage
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(message.from.id) },
    include: {
      wallets: {
        where: { blockchain: 'solana', isDefault: true },
        take: 1,
      },
    },
  });

  if (!user || user.wallets.length === 0) {
    await sendTelegramMessage(
      message.chatId,
      '❌ No Solana wallet found. Please create a wallet first.',
      { replyToMessageId: message.messageId }
    );
    return;
  }

  const wallet = user.wallets[0];
  const miniAppUrl = appConfig.telegram.miniAppUrl;

  await sendTelegramMessage(
    message.chatId,
    `📥 <b>Receive SOL</b>\n\n` +
      `<b>Your Address:</b>\n<code>${wallet.address}</code>\n\n` +
      (user.username ? `<b>Username:</b> @${user.username}.sol\n\n` : '') +
      `Tap the button below to view your QR code.`,
    {
      parseMode: 'HTML',
      replyToMessageId: message.messageId,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '📲 Show QR Code',
              url: `${miniAppUrl}/wallet/receive?telegram_id=${message.from.id}`,
            },
          ],
        ],
      },
    }
  );
}

/**
 * Handle /wallet command: Show wallet info and open mini app
 */
async function handleWalletCommand(
  message: TelegramMessage
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(message.from.id) },
    include: {
      wallets: {
        where: { blockchain: 'solana' },
        take: 1,
      },
    },
  });

  const miniAppUrl = appConfig.telegram.miniAppUrl;

  if (!user || user.wallets.length === 0) {
  await sendTelegramMessage(
    message.chatId,
    '👛 <b>Celora Wallet</b>\n\nYou don\'t have a wallet yet. Create one now!',
    {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '✨ Create Wallet',
              url: `${miniAppUrl}/wallet/create-solana?telegram_id=${message.from.id}`,
            },
          ],
        ],
      },
    }
  );
    return;
  }

  await sendTelegramMessage(
    message.chatId,
    '👛 <b>Celora Wallet</b>\n\nOpen your wallet to manage your funds.',
    {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '✨ Open Wallet',
              url: `${miniAppUrl}/wallet?telegram_id=${message.from.id}`,
            },
          ],
          [
            {
              text: '📤 Send',
              url: `${miniAppUrl}/wallet/send-solana?telegram_id=${message.from.id}`,
            },
            {
              text: '📥 Receive',
              url: `${miniAppUrl}/wallet/receive?telegram_id=${message.from.id}`,
            },
          ],
        ],
      },
    }
  );
}

/**
 * Handle /start command
 */
async function handleStartCommand(
  message: TelegramMessage
): Promise<void> {
  await sendTelegramMessage(
    message.chatId,
    '👋 <b>Welcome to Celora Wallet!</b>\n\n' +
      'Your non-custodial Solana wallet for gambling.\n\n' +
      '<b>Available commands:</b>\n' +
      '/wallet - Open your wallet\n' +
      '/balance - Check your balance\n' +
      '/send - Send SOL to username or address\n' +
      '/receive - Show your receive address\n' +
      '/help - Show this help message',
    {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '✨ Open Wallet',
              url: `${appConfig.telegram.miniAppUrl}/wallet?telegram_id=${message.from.id}`,
            },
          ],
        ],
      },
    }
  );
}

/**
 * Handle /help command
 */
async function handleHelpCommand(
  message: TelegramMessage
): Promise<void> {
  await sendTelegramMessage(
    message.chatId,
    '📖 <b>Celora Wallet Commands</b>\n\n' +
      '/start - Start using Celora\n' +
      '/wallet - Open your wallet\n' +
      '/balance - Check your SOL balance\n' +
      '/send @username 0.5 SOL - Send SOL to username\n' +
      '/send <address> 0.5 SOL - Send SOL to address\n' +
      '/receive - Show your receive address & QR code\n' +
      '/help - Show this help\n\n' +
      '💡 <i>Tip: You can also use the wallet directly via the mini app button!</i>',
    {
      parseMode: 'HTML',
      replyToMessageId: message.messageId,
    }
  );
}

/**
 * POST /api/telegram/webhook - Handle Telegram webhook
 */
export async function POST(request: NextRequest) {
  if (!isTelegramBotEnabled()) {
    return NextResponse.json({ ok: false, error: 'Telegram bot disabled' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Handle callback queries (button clicks)
    if (body.callback_query) {
      const callback = body.callback_query;
      const callbackData = callback.data;

      // Handle send confirmation
      if (callbackData?.startsWith('send_confirm:')) {
        const [, address, amount] = callbackData.split(':');
        const miniAppUrl = appConfig.telegram.miniAppUrl;
        
        await sendTelegramMessage(
          callback.message.chat.id,
          `📤 Opening send interface...\n\nTap the button below to complete the transaction.`,
          {
            replyMarkup: {
              inline_keyboard: [
                [
                  {
                    text: '✨ Confirm Send',
                    url: `${miniAppUrl}/wallet/send-solana?to=${address}&amount=${amount}&telegram_id=${callback.from.id}`,
                  },
                ],
              ],
            },
          }
        );
      }

      // Answer callback query
      return NextResponse.json({ ok: true });
    }

    // Handle messages
    if (body.message) {
      const message: TelegramMessage = {
        messageId: body.message.message_id,
        from: body.message.from,
        chatId: body.message.chat.id,
        text: body.message.text,
        date: body.message.date,
      };

      // Link Telegram user to account if needed
      const existingUser = await prisma.user.findUnique({
        where: { telegramId: String(message.from.id) },
      });

      if (!existingUser) {
        // Create or update user with Telegram ID
        // You might want to ask user to link their account first
        await sendTelegramMessage(
          message.chatId,
          '🔗 Please link your Telegram account to your Celora wallet first.\n\nVisit the app to complete the linking process.',
          {
            replyMarkup: {
              inline_keyboard: [
                [
                  {
                    text: '✨ Link Account',
                    url: `${appConfig.telegram.miniAppUrl}/link-telegram?telegram_id=${message.from.id}`,
                  },
                ],
              ],
            },
          }
        );
        return NextResponse.json({ ok: true });
      }

      // Parse and handle commands
      if (message.text) {
        const command = parseTelegramCommand(message.text);

        if (command) {
          switch (command.command) {
            case 'start':
              await handleStartCommand(message);
              break;
            case 'help':
              await handleHelpCommand(message);
              break;
            case 'wallet':
              await handleWalletCommand(message);
              break;
            case 'balance':
              await handleBalanceCommand(message);
              break;
            case 'send':
              await handleSendCommand(message, command.args);
              break;
            case 'receive':
              await handleReceiveCommand(message);
              break;
            default:
              await sendTelegramMessage(
                message.chatId,
                '❓ Unknown command. Use /help to see available commands.',
                { replyToMessageId: message.messageId }
              );
          }
        } else {
          // Not a command, show help
          await sendTelegramMessage(
            message.chatId,
            '👋 Hi! Use /help to see available commands or /wallet to open your wallet.',
          );
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Error handling Telegram webhook', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

