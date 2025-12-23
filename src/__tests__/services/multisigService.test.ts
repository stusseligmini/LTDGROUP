import multisigService from '@/server/services/multisigService';

// Use shared Prisma mock
jest.mock('@prisma/client');
jest.mock('@/server/db/client', () => {
  const prisma = require('../lib/prisma.mock').prisma;
  return { prisma };
});

// Consolidate to server prisma client mock
// Keep @prisma/client mocked

describe('MultiSigService', () => {
  describe('createMultiSigWallet', () => {
    it('should create multi-sig wallet with signers', async () => {
      const signers = [
        { address: '0x1111111111111111111111111111111111111111', name: 'Alice' },
        { address: '0x2222222222222222222222222222222222222222', name: 'Bob' },
        { address: '0x3333333333333333333333333333333333333333', name: 'Carol' },
      ];

      const wallet = await multisigService.createMultiSigWallet(
        'user123',
        'ethereum',
        2, // 2 of 3
        signers
      );

      expect(wallet).toBeDefined();
    });
  });

  describe('proposeTransaction', () => {
    it('should create pending transaction', async () => {
      // This would need proper mocking
      // const tx = await multisigService.proposeTransaction(...);
      // expect(tx.status).toBe('pending');
      // expect(tx.currentSigs).toBe(1); // Proposer auto-signs
    });
  });

  describe('signTransaction', () => {
    it('should add signature to pending transaction', async () => {
      // const result = await multisigService.signTransaction('tx123', '0xSigner2');
      // expect(result.currentSigs).toBeGreaterThan(1);
    });

    it('should execute transaction when threshold met', async () => {
      // Test that transaction executes when enough signatures collected
    });
  });
});

