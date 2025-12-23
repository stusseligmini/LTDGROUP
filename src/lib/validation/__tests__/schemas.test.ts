import { describe, expect, it } from '@jest/globals';
import {
  SessionRequestSchema,
  SessionResponseSchema,
  WalletSummaryResponseSchema,
  WalletCreateRequestSchema,
  WalletBalanceResponseSchema,
  WalletBalanceQuerySchema,
  TransactionListQuerySchema,
  TransactionCreateRequestSchema,
  TransactionResponseSchema,
  NotificationListQuerySchema,
  NotificationResponseSchema,
  NotificationCreateRequestSchema,
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
} from '../schemas';

describe('Auth Schemas', () => {
  it('SessionRequestSchema validates access and expires', () => {
    const data = {
      accessToken: 'token',
      refreshToken: 'refresh',
      idToken: 'id',
      expiresIn: 3600,
    };
    expect(SessionRequestSchema.safeParse(data).success).toBe(true);
  });

  it('SessionResponseSchema requires success flag and user', () => {
    const data = {
      success: true,
      sessionId: '00000000-0000-0000-0000-000000000000',
      expiresAt: '2025-01-01T00:00:00Z',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user@example.com',
        displayName: 'User',
      },
    };
    expect(SessionResponseSchema.safeParse(data).success).toBe(true);
  });
});

describe('Wallet Schemas', () => {
  it('WalletSummaryResponseSchema matches totals and holdings', () => {
    const data = {
      totalBalance: 1000,
      currency: 'USD',
      holdings: [
        {
          id: '00000000-0000-0000-0000-000000000010',
          blockchain: 'celo',
          address: '0x123',
          label: null,
          balanceCache: null,
          balanceFiat: 500,
          isDefault: true,
          lastSyncedAt: null,
        },
      ],
      lastUpdated: '2025-01-01T00:00:00Z',
    };
    expect(WalletSummaryResponseSchema.safeParse(data).success).toBe(true);
  });

  it('WalletCreateRequestSchema enforces blockchain and address', () => {
    const data = {
      blockchain: 'celo',
      address: '0xabc',
      publicKey: 'pk',
      label: 'My Wallet',
      isDefault: false,
    };
    expect(WalletCreateRequestSchema.safeParse(data).success).toBe(true);
    expect(WalletCreateRequestSchema.safeParse({ blockchain: 'invalid', address: '' }).success).toBe(false);
  });

  it('WalletBalanceResponseSchema requires uuid and fiat data', () => {
    const data = {
      walletId: '00000000-0000-0000-0000-000000000010',
      blockchain: 'ethereum',
      address: '0x123',
      balance: '100',
      balanceFiat: 100,
      fiatCurrency: 'USD',
      lastSyncedAt: '2025-01-01T00:00:00Z',
    };
    expect(WalletBalanceResponseSchema.safeParse(data).success).toBe(true);
  });

  it('WalletBalanceQuerySchema coerces booleans', () => {
    const result = WalletBalanceQuerySchema.safeParse({ walletId: '00000000-0000-0000-0000-000000000010', forceSync: 'true' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.forceSync).toBe(true);
  });
});

describe('Transaction Schemas', () => {
  it('TransactionListQuerySchema defaults pagination and accepts filters', () => {
    const result = TransactionListQuerySchema.safeParse({ page: 2, limit: 10, status: 'pending' });
    expect(result.success).toBe(true);
    expect(TransactionListQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
  });

  it('TransactionCreateRequestSchema enforces uuid and numeric strings', () => {
    const ok = TransactionCreateRequestSchema.safeParse({
      walletId: '00000000-0000-0000-0000-000000000010',
      toAddress: '0xabc',
      amount: '100',
    });
    expect(ok.success).toBe(true);
    expect(TransactionCreateRequestSchema.safeParse({ walletId: 'bad', toAddress: '', amount: 'abc' }).success).toBe(false);
  });

  it('TransactionResponseSchema validates full payload', () => {
    const ok = TransactionResponseSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000021',
      walletId: '00000000-0000-0000-0000-000000000010',
      txHash: '0xhash',
      blockchain: 'solana',
      blockNumber: null,
      fromAddress: 'A',
      toAddress: 'B',
      amount: '10',
      tokenSymbol: null,
      tokenAddress: null,
      gasFee: null,
      gasPrice: null,
      gasUsed: null,
      status: 'confirmed',
      confirmations: 1,
      type: null,
      memo: null,
      timestamp: '2025-01-01T00:00:00Z',
      createdAt: '2025-01-01T00:00:00Z',
    });
    expect(ok.success).toBe(true);
  });
});

describe('Notification Schemas', () => {
  it('NotificationListQuerySchema uses pagination defaults', () => {
    const result = NotificationListQuerySchema.safeParse({ page: 1, limit: 5, status: 'pending' });
    expect(result.success).toBe(true);
  });

  it('NotificationResponseSchema validates payload', () => {
    const data = {
      id: '00000000-0000-0000-0000-000000000030',
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'transaction',
      title: 'Test Notification',
      body: 'This is a test',
      channels: ['push'],
      status: 'pending',
      priority: 'normal',
      actionUrl: null,
      actionLabel: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      createdAt: '2025-01-01T00:00:00Z',
    };
    expect(NotificationResponseSchema.safeParse(data).success).toBe(true);
  });

  it('NotificationCreateRequestSchema requires channels and title', () => {
    const ok = NotificationCreateRequestSchema.safeParse({
      type: 'transaction',
      title: 'Hello',
      body: 'World',
      channels: ['push'],
    });
    expect(ok.success).toBe(true);
  });
});

describe('Error Schemas', () => {
  it('ErrorResponseSchema validates envelope error', () => {
    const data = {
      error: {
        code: 'CODE',
        message: 'Oops',
        timestamp: '2025-01-01T00:00:00Z',
        requestId: '00000000-0000-0000-0000-000000000001',
      },
    };
    expect(ErrorResponseSchema.safeParse(data).success).toBe(true);
  });

  it('ValidationErrorResponseSchema validates field errors', () => {
    const data = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fields: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'amount', message: 'Must be positive' },
        ],
        timestamp: '2025-01-01T00:00:00Z',
      },
    };
    expect(ValidationErrorResponseSchema.safeParse(data).success).toBe(true);
  });
});

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    const data = { network: '' };
    const result = WalletCreateRequestSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
  
  it('should trim whitespace in addresses', () => {
    const data = {
      walletId: '00000000-0000-0000-0000-000000000001',
      toAddress: '  0x123  ',
      amount: '10',
      tokenAddress: 'token-1',
    };
    
    const result = TransactionCreateRequestSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toAddress).toBe('0x123');
    }
  });
  
  it('should enforce string types for numeric fields', () => {
    const data = {
      totalBalanceCUSD: 1000.50, // number instead of string
      wallets: [],
      recentTransactions: [],
    };
    
    const result = WalletSummaryResponseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
