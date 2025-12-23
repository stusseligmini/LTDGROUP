/**
 * Telegram Bot Commands Tests
 */

// @ts-nocheck - Jest types configured in jest.setup.ts
import { handleStart } from '../commands/start';
import { handleBalance } from '../commands/balance';
import { handleHelp } from '../commands/help';
import { TelegramBotClient } from '../client';

// Mock Prisma
jest.mock('@prisma/client');

// Mock bot client
const mockClient = {
  sendMessage: jest.fn(),
  answerCallbackQuery: jest.fn(),
} as unknown as TelegramBotClient;

describe('Telegram Bot Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('handleStart', () => {
    it('should send welcome message to unlinked user', async () => {
      const message = {
        message_id: 1,
        chat: { id: 123456, type: 'private' as const },
        from: { id: 123456, first_name: 'Test', is_bot: false },
        date: Date.now(),
        text: '/start',
      };
      
      await handleStart(message, mockClient, false);
      
      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 123456,
          parse_mode: 'Markdown',
        })
      );
      
      const callText = (mockClient.sendMessage as jest.Mock).mock.calls[0][0].text;
      expect(callText).toContain('Welcome to Celora');
      expect(callText).toContain('link your Telegram account');
    });
    
    it('should send main menu to linked user', async () => {
      const message = {
        message_id: 1,
        chat: { id: 123456, type: 'private' as const },
        from: { id: 123456, first_name: 'Test', is_bot: false },
        date: Date.now(),
        text: '/start',
      };
      
      await handleStart(message, mockClient, true);
      
      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 123456,
          parse_mode: 'Markdown',
          reply_markup: expect.any(Object),
        })
      );
    });
  });
  
  describe('handleHelp', () => {
    it('should send help message with all commands', async () => {
      const message = {
        message_id: 1,
        chat: { id: 123456, type: 'private' as const },
        from: { id: 123456, first_name: 'Test', is_bot: false },
        date: Date.now(),
        text: '/help',
      };
      
      await handleHelp(message, mockClient);
      
      expect(mockClient.sendMessage).toHaveBeenCalled();
      const callText = (mockClient.sendMessage as jest.Mock).mock.calls[0][0].text;
      expect(callText).toContain('Celora Bot Commands');
      expect(callText).toContain('/balance');
      expect(callText).toContain('/send');
      expect(callText).toContain('/cards');
    });
  });
});

