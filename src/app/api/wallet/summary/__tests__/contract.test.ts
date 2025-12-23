import { NextRequest } from 'next/server';
import { GET } from '../route';
import { WalletSummaryResponseSchema } from '@/lib/validation/schemas';

jest.mock('@/server/services/walletService', () => ({
  getWalletSummary: jest.fn(async () => ({
    totalBalance: 123.45,
    currency: 'USD',
    holdings: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        blockchain: 'solana',
        address: 'SOL123',
        label: 'Primary',
        balanceCache: '2.5',
        balanceFiat: 250,
        isDefault: true,
        lastSyncedAt: new Date().toISOString(),
      },
    ],
    lastUpdated: new Date().toISOString(),
  })),
}));

function makeRequest(headers: Record<string, string>) {
  const url = 'https://example.com/api/wallet/summary';
  return new NextRequest(url, { headers });
}

describe('Wallet Summary Contract', () => {
  it('returns payload matching WalletSummaryResponseSchema', async () => {
    const req = makeRequest({
      authorization: 'Bearer mocktoken',
      'x-user-id': 'user_123',
    });

    const res = await GET(req);
    const json = await res.json();

    // Envelope wraps data under `data`
    const parsed = WalletSummaryResponseSchema.safeParse(json.data);
    expect(parsed.success).toBe(true);
  });
});
