import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * GET /api/swap/history - Get swap transaction history
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/swap/history', method: 'GET'});
  const {requestId} = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.UNAUTHORIZED,
          'User ID is required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const blockchain = searchParams.get('blockchain');

    if (!walletId) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'walletId is required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.NOT_FOUND,
          'Wallet not found',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Build query
    const where: any = {
      walletId,
      type: 'swap',
    };

    if (blockchain) {
      where.blockchain = blockchain;
    }

    // Get total count for pagination
    const total = await prisma.transaction.count({ where });

    // Get transactions with pagination and sorting
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        txHash: true,
        blockchain: true,
        amount: true,
        amountUsd: true,
        exchangeRate: true,
        tokenSymbol: true,
        gasFee: true,
        status: true,
        fromAddress: true,
        toAddress: true,
        timestamp: true,
        memo: true,
      },
    });

    // Parse Decimal fields to numbers
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      txHash: tx.txHash,
      blockchain: tx.blockchain,
      amount: tx.amount,
      amountUsd: tx.amountUsd ? parseFloat(tx.amountUsd.toString()) : null,
      exchangeRate: tx.exchangeRate ? parseFloat(tx.exchangeRate.toString()) : null,
      tokenSymbol: tx.tokenSymbol,
      gasFee: tx.gasFee,
      status: tx.status,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      timestamp: tx.timestamp,
      memo: tx.memo,
    }));

    const response = {
      transactions: formattedTransactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };

    return NextResponse.json(
      createSuccessEnvelope(response, requestId),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error getting swap history', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to get swap history',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

