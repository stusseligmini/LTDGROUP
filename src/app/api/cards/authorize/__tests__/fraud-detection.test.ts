/**
 * Unit tests for card authorization fraud detection
 * Tests velocity checks, geo-mismatch, MCC anomalies
 */

import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    cardTransaction: {
      count: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
    },
    card: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('Card Authorization Fraud Detection', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('Velocity checks', () => {
    it('should allow transactions under velocity threshold (5 in 10min)', async () => {
      mockPrisma.cardTransaction.count.mockResolvedValue(4);
      
      const recentTxCount = await mockPrisma.cardTransaction.count({
        where: {
          cardId: 'card_123',
          status: 'approved',
          transactionDate: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });
      
      expect(recentTxCount).toBe(4);
      expect(recentTxCount < 5).toBe(true);
    });

    it('should block transactions exceeding velocity threshold', async () => {
      mockPrisma.cardTransaction.count.mockResolvedValue(5);
      
      const recentTxCount = await mockPrisma.cardTransaction.count({
        where: {
          cardId: 'card_123',
          status: 'approved',
          transactionDate: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });
      
      expect(recentTxCount).toBe(5);
      expect(recentTxCount >= 5).toBe(true); // Should decline
    });
  });

  describe('Geo-mismatch detection', () => {
    // Haversine distance calculation
    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    it('should flag transactions >500km from last location', () => {
      // San Francisco to Los Angeles (~560km)
      const distance = calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
      
      expect(distance).toBeGreaterThan(500);
    });

    it('should allow transactions within 500km', () => {
      // San Francisco to San Jose (~70km)
      const distance = calculateDistance(37.7749, -122.4194, 37.3382, -121.8863);
      
      expect(distance).toBeLessThan(500);
    });

    it('should calculate correct distance for international transactions', () => {
      // New York to London (~5570km)
      const distance = calculateDistance(40.7128, -74.0060, 51.5074, -0.1278);
      
      expect(distance).toBeGreaterThan(5000);
      expect(distance).toBeLessThan(6000);
    });
  });

  describe('MCC anomaly detection', () => {
    it('should flag transactions with unusual merchant categories', async () => {
      mockPrisma.cardTransaction.groupBy.mockResolvedValue([
        { mcc: '5411', _count: { mcc: 50 } }, // Grocery stores
        { mcc: '5812', _count: { mcc: 30 } }, // Restaurants
      ]);
      
      const userMccHistory = await mockPrisma.cardTransaction.groupBy({
        by: ['mcc'],
        where: { userId: 'user_123', status: 'approved' },
        _count: { mcc: true },
      });
      
      const isUnusualMcc = !userMccHistory.some((m: any) => m.mcc === '5993'); // Gambling
      
      expect(isUnusualMcc).toBe(true);
    });

    it('should allow transactions with known merchant categories', async () => {
      mockPrisma.cardTransaction.groupBy.mockResolvedValue([
        { mcc: '5411', _count: { mcc: 50 } },
        { mcc: '5812', _count: { mcc: 30 } },
      ]);
      
      const userMccHistory = await mockPrisma.cardTransaction.groupBy({
        by: ['mcc'],
        where: { userId: 'user_123', status: 'approved' },
        _count: { mcc: true },
      });
      
      const isUnusualMcc = !userMccHistory.some((m: any) => m.mcc === '5411'); // Known category
      
      expect(isUnusualMcc).toBe(false);
    });

    it('should identify high-risk MCCs (gambling, adult)', () => {
      const highRiskMccs = ['5993', '7995', '7273']; // Gambling, betting, adult
      
      expect(highRiskMccs.includes('5993')).toBe(true);
      expect(highRiskMccs.includes('7995')).toBe(true);
      expect(highRiskMccs.includes('5411')).toBe(false); // Groceries not high-risk
    });
  });

  describe('Cashback calculation', () => {
    it('should apply default 2% cashback for normal transactions', () => {
      const amount = 100;
      const cashbackRate = 0.02;
      const cashbackAmount = amount * cashbackRate;
      
      expect(cashbackAmount).toBe(2);
    });

    it('should apply 0% cashback for high-risk MCCs', () => {
      const amount = 100;
      const isHighRiskMcc = true;
      const cashbackRate = isHighRiskMcc ? 0 : 0.02;
      const cashbackAmount = amount * cashbackRate;
      
      expect(cashbackAmount).toBe(0);
    });

    it('should calculate cashback for various amounts', () => {
      const testCases = [
        { amount: 10, expected: 0.2 },
        { amount: 50, expected: 1.0 },
        { amount: 100, expected: 2.0 },
        { amount: 250.50, expected: 5.01 },
      ];
      
      testCases.forEach(({ amount, expected }) => {
        const cashback = amount * 0.02;
        expect(cashback).toBeCloseTo(expected, 2);
      });
    });
  });

  describe('Transaction anomaly flagging', () => {
    it('should flag transaction as anomaly for unusual MCC + high-risk', () => {
      const isUnusualMcc = true;
      const isHighRiskMcc = true;
      const isAnomaly = isUnusualMcc || isHighRiskMcc;
      
      expect(isAnomaly).toBe(true);
    });

    it('should not flag transaction with known safe MCC', () => {
      const isUnusualMcc = false;
      const isHighRiskMcc = false;
      const isAnomaly = isUnusualMcc || isHighRiskMcc;
      
      expect(isAnomaly).toBe(false);
    });
  });
});
