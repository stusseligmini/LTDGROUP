/**
 * Card Transactions API - GET
 * /api/cards/[id]/transactions
 * 
 * Retrieves transaction history for a virtual card from the provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { logError } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { ensureProvidersInitialized, getProvider, isProviderAvailable } from '@/server/services/cardIssuing/factory';
import type { CardProvider, CardTransaction } from '@/server/services/cardIssuing/types';

const prisma = new PrismaClient();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cards/[id]/transactions - Get card transaction history
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const log = createRequestLogger({ endpoint: '/api/cards/[id]/transactions', method: 'GET' });
  const { requestId } = log;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate limit and offset
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Limit must be between 1 and 100',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Offset must be non-negative',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Verify card exists and belongs to user
    const card = await prisma.card.findFirst({
      where: { id, userId },
    });

    if (!card) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    await ensureProvidersInitialized();

    let transactions: CardTransaction[] = [];
    let hasMore = false;

    // Fetch transactions from provider if available
    if (
      card.provider &&
      card.providerCardId &&
      isProviderAvailable(card.provider as CardProvider)
    ) {
      try {
        const provider = getProvider(card.provider as CardProvider);
        const result = await provider.getTransactions(
          card.providerCardId,
          userId,
          limit,
          offset
        );

        if (result.success && result.data) {
          transactions = Array.isArray(result.data) ? result.data : [];
          hasMore = transactions.length >= limit;
          
          // Filter by date range if provided
          if (startDate || endDate) {
            transactions = transactions.filter((tx) => {
              const txDate = new Date(tx.transactionDate);
              if (startDate && txDate < new Date(startDate)) return false;
              if (endDate && txDate > new Date(endDate)) return false;
              return true;
            });
          }
        }
      } catch (error) {
        logError('Failed to fetch transactions from provider', error);
        // Return empty transactions rather than failing completely
      }
    } else {
      // Return mock transactions for cards without provider
      transactions = generateMockTransactions(card.id, limit);
    }

    // Calculate spending by category
    const spendingByCategory = calculateSpendingByCategory(transactions);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          transactions,
          hasMore,
          total: transactions.length,
          spendingByCategory,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error) {
    logError('Error fetching card transactions', error);
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to fetch transactions',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * Generate mock transactions for testing
 */
function generateMockTransactions(cardId: string, limit: number): CardTransaction[] {
  const merchants = [
    { name: 'Amazon', mcc: '5999', city: 'Seattle', country: 'US' },
    { name: 'Uber', mcc: '4121', city: 'San Francisco', country: 'US' },
    { name: 'Starbucks', mcc: '5814', city: 'New York', country: 'US' },
    { name: 'Shell', mcc: '5541', city: 'Los Angeles', country: 'US' },
    { name: 'Netflix', mcc: '7841', city: 'Los Gatos', country: 'US' },
    { name: 'Whole Foods', mcc: '5411', city: 'Austin', country: 'US' },
    { name: 'Apple Store', mcc: '5732', city: 'Cupertino', country: 'US' },
    { name: 'Best Buy', mcc: '5732', city: 'Minneapolis', country: 'US' },
  ];

  const transactions: CardTransaction[] = [];
  const now = Date.now();

  for (let i = 0; i < Math.min(limit, 10); i++) {
    const merchant = merchants[i % merchants.length];
    const amount = Math.random() * 200 + 10;
    const daysAgo = Math.floor(Math.random() * 30);
    const transactionDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const isCompleted = i > 0 && Math.random() > 0.1;

    transactions.push({
      id: `txn_${cardId}_${i}`,
      cardId,
      merchantName: merchant.name,
      merchantCity: merchant.city,
      merchantCountry: merchant.country,
      mcc: merchant.mcc,
      amount,
      currency: 'USD',
      status: i === 0 ? 'pending' : Math.random() > 0.9 ? 'declined' : 'approved',
      transactionDate,
      settledDate: isCompleted ? new Date(transactionDate.getTime() + 24 * 60 * 60 * 1000) : undefined,
      declineReason: Math.random() > 0.95 ? 'Insufficient funds' : undefined,
    });
  }

  return transactions.sort(
    (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime()
  );
}

/**
 * Calculate spending breakdown by category
 */
interface SpendingByCategory {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

// MCC to category mapping
const MCC_CATEGORIES: Record<string, string> = {
  '5999': 'Shopping',
  '4121': 'Transportation',
  '5814': 'Food & Drink',
  '5541': 'Gas',
  '7841': 'Entertainment',
  '5411': 'Groceries',
  '5732': 'Electronics',
  '5812': 'Restaurants',
};

function calculateSpendingByCategory(transactions: CardTransaction[]): SpendingByCategory[] {
  const categoryMap = new Map<string, number>();
  let totalSpending = 0;

  // Only count approved transactions
  const completedTxs = transactions.filter((tx) => tx.status === 'approved');

  completedTxs.forEach((tx) => {
    const category = MCC_CATEGORIES[tx.mcc] || 'Other';
    const current = categoryMap.get(category) || 0;
    categoryMap.set(category, current + tx.amount);
    totalSpending += tx.amount;
  });

  const categories: SpendingByCategory[] = [];
  const colors = [
    '#06b6d4', // cyan
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#10b981', // emerald
    '#ef4444', // red
    '#3b82f6', // blue
    '#ec4899', // pink
    '#84cc16', // lime
  ];

  let colorIndex = 0;
  categoryMap.forEach((amount, category) => {
    categories.push({
      category,
      amount,
      percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
      color: colors[colorIndex % colors.length],
    });
    colorIndex++;
  });

  // Sort by amount descending
  return categories.sort((a, b) => b.amount - a.amount);
}
