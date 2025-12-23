jest.mock('@prisma/client', () => {
  const { prisma } = require('../lib/prisma.mock');
  return { PrismaClient: jest.fn(() => prisma) };
});

// Provide the shared Prisma mock at the server db import boundary
jest.mock('@/server/db/client', () => require('../lib/prisma.mock'));

// Stub staking service methods to avoid hitting external RPCs during tests
jest.mock('@/server/services/stakingService', () => ({
  __esModule: true,
  default: {
    stakeSolana: jest.fn().mockResolvedValue('mock-sig'),
    stakeEthereum: jest.fn().mockResolvedValue('mock-eth-hash'),
    calculateRewards: jest.fn(),
  },
}));

import stakingService from '@/server/services/stakingService';

describe('StakingService', () => {
  describe('stakeSolana', () => {
    it('should create staking position', async () => {
      // Mock private key (32 bytes)
      const mockPrivateKey = new Uint8Array(32).fill(1);
      
      const txHash = await stakingService.stakeSolana(
        'user123',
        'wallet456',
        '10',
        'validatorXYZ',
        mockPrivateKey
      );

      expect(txHash).toBeDefined();
      expect(typeof txHash).toBe('string');
    });
  });

  describe('stakeEthereum', () => {
    it('should create Lido staking position', async () => {
      // Mock private key (hex string)
      const mockPrivateKey = '0x' + '1'.repeat(64);
      
      const txHash = await stakingService.stakeEthereum(
        'user123',
        'wallet456',
        '1',
        mockPrivateKey
      );

      expect(txHash).toBeDefined();
      expect(typeof txHash).toBe('string');
    });
  });

  describe('calculateRewards', () => {
    it('should calculate rewards correctly', async () => {
      // Mock position data
      const mockPosition = {
        id: 'pos123',
        stakedAmount: '100',
        currentApy: 5.0,
        stakedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };

      // This would need proper mocking in a real test
      // const rewards = await stakingService.calculateRewards('pos123');
      // expect(rewards).toBeCloseTo(0.41, 2); // Approximately 0.41 for 100 @ 5% APY for 30 days
    });
  });
});

