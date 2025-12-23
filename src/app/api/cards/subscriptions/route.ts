/**
 * Subscription Management API
 * Auto-detect subscriptions, track renewal dates, quick cancellation
 * BETTER than Revolut!
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logError } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * GET /api/cards/subscriptions - List all detected subscriptions
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards/subscriptions', method: 'GET' });
  const { requestId } = log;
  
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');
    const status = searchParams.get('status'); // 'active', 'cancelled'

    // Find cards with subscriptions
    const where: any = { userId, isSubscription: true };
    if (cardId) where.id = cardId;
    if (status) where.status = status;

    const subscriptionCards = await prisma.card.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        subscriptionName: true,
        subscriptionCycle: true,
        nextBillingDate: true,
        monthlySpent: true,
        monthlyLimit: true,
        lastUsedAt: true,
        status: true,
        createdAt: true,
      },
      orderBy: { nextBillingDate: 'asc' },
    });

    // Get transaction history for each subscription
    const subscriptionsWithHistory = await Promise.all(
      subscriptionCards.map(async (card) => {
        const recentCharges = await prisma.cardTransaction.findMany({
          where: {
            cardId: card.id,
            status: 'approved',
          },
          orderBy: { transactionDate: 'desc' },
          take: 12, // Last 12 charges
          select: {
            amount: true,
            transactionDate: true,
            merchantName: true,
          },
        });

        // Calculate average monthly cost
        const avgCost = recentCharges.length > 0
          ? recentCharges.reduce((sum, t) => sum + Number(t.amount), 0) / recentCharges.length
          : 0;

        return {
          ...card,
          averageCost: avgCost,
          totalSpent: recentCharges.reduce((sum, t) => sum + Number(t.amount), 0),
          chargeHistory: recentCharges.map(c => ({
            amount: Number(c.amount),
            date: c.transactionDate.toISOString(),
            merchant: c.merchantName,
          })),
        };
      })
    );

    return NextResponse.json(
      createSuccessEnvelope({
        subscriptions: subscriptionsWithHistory,
        summary: {
          total: subscriptionsWithHistory.length,
          active: subscriptionsWithHistory.filter(s => s.status === 'active').length,
          monthlyTotal: subscriptionsWithHistory
            .filter(s => s.status === 'active')
            .reduce((sum, s) => sum + s.averageCost, 0),
        },
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to fetch subscriptions', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscriptions', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * POST /api/cards/subscriptions/detect - Manually trigger subscription detection
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards/subscriptions', method: 'POST' });
  const { requestId } = log;
  
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Get all user's card transactions
    const transactions = await prisma.cardTransaction.findMany({
      where: {
        userId,
        isRecurring: true,
        status: 'approved',
      },
      orderBy: { transactionDate: 'desc' },
    });

    // Group by recurring group
    const recurringGroups = new Map<string, any[]>();
    
    transactions.forEach(tx => {
      if (tx.recurringGroup) {
        if (!recurringGroups.has(tx.recurringGroup)) {
          recurringGroups.set(tx.recurringGroup, []);
        }
        recurringGroups.get(tx.recurringGroup)!.push(tx);
      }
    });

    const detectedSubscriptions: any[] = [];

    // Analyze each recurring group
    for (const [_groupId, txs] of recurringGroups.entries()) {
      if (txs.length >= 2) {
        const sortedTxs = txs.sort((a, b) => 
          new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
        );

        const firstTx = sortedTxs[0];
        const lastTx = sortedTxs[sortedTxs.length - 1];

        // Detect cycle (monthly, yearly)
        const daysDiff = Math.round(
          (new Date(lastTx.transactionDate).getTime() - new Date(firstTx.transactionDate).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        
        let cycle = 'monthly';
        if (daysDiff > 300) cycle = 'yearly';

        detectedSubscriptions.push({
          cardId: firstTx.cardId,
          merchantName: firstTx.merchantName,
          amount: Number(firstTx.amount),
          cycle,
          chargeCount: txs.length,
          firstCharge: firstTx.transactionDate,
          lastCharge: lastTx.transactionDate,
        });
      }
    }

    return NextResponse.json(
      createSuccessEnvelope({
        detected: detectedSubscriptions,
        count: detectedSubscriptions.length,
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to detect subscriptions', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to detect subscriptions', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

