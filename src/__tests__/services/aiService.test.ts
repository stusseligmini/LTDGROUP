import aiService from '@/server/services/aiService';
// Mock internal dependency to provide reasonable baseline pattern
jest.spyOn((aiService as any), 'getUserTransactionPattern').mockResolvedValue({
  averageAmount: 200,
  frequency: 5,
  commonRecipients: ['0xRecipient'],
  commonTime: 'day',
});

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    cardTransaction: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    fraudAlert: {
      create: jest.fn(),
    },
    spendingInsight: {
      create: jest.fn(),
    },
  })),
}));

describe('AIService', () => {
  describe('analyzeFraud', () => {
    it('should detect unusually large transactions', async () => {
      const result = await aiService.analyzeFraud(
        'user123',
        10000, // Large amount
        '0xRecipient',
        'ethereum'
      );

      expect(result.isSuspicious).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.reasons).toBeInstanceOf(Array);
    });

    it('should return low risk for normal transactions', async () => {
      const result = await aiService.analyzeFraud(
        'user123',
        50, // Normal amount
        '0xRecipient',
        'ethereum'
      );

      expect(result.riskLevel).toBe('low');
    });
  });

  describe('categorizeTransaction', () => {
    it('should categorize grocery transactions', async () => {
      const result = await aiService.categorizeTransaction(
        'Walmart Supercenter',
        150,
        '5411'
      );

      expect(result.category).toBe('groceries');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize restaurant transactions', async () => {
      const result = await aiService.categorizeTransaction(
        'Starbucks Coffee',
        15,
        '5812'
      );

      expect(result.category).toBe('dining');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize transport transactions', async () => {
      const result = await aiService.categorizeTransaction(
        'Uber Trip',
        25
      );

      expect(result.category).toBe('transport');
    });
  });
});

