import { jest } from '@jest/globals';

const resolved = <T>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value);

// Jest automatic mock for '@/server/db/client'
export const prisma = {
  wallet: {
    findUnique: resolved({ id: 'wallet1', address: '0x1111111111111111111111111111111111111111', blockchain: 'ethereum' }),
    create: resolved({ id: 'wallet1' }),
    update: resolved({ id: 'wallet1' }),
  },
  stakingPosition: {
    create: resolved({ id: 'stake1' }),
    findMany: resolved([]),
    findUnique: resolved({ id: 'stake1' }),
    update: resolved({ id: 'stake1' }),
  },
  multiSigSigner: {
    create: resolved({ id: 'signer1' }),
    findMany: resolved([]),
  },
  pendingTransaction: {
    create: resolved({ id: 'ptx1' }),
    findUnique: resolved({ id: 'ptx1' }),
    findMany: resolved([]),
    update: resolved({ id: 'ptx1' }),
  },
  transaction: {
    create: resolved({ id: 'tx1' }),
  },
  auditLog: {
    create: resolved({ id: 'log1' }),
  },
};
export default { prisma };
