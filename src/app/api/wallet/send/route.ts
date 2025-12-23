import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { broadcastSignedTransaction } from '@/server/services/transactionService';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { checkIdempotency, storeIdempotency } from '@/lib/validation/idempotency';
import { withRecaptcha } from '@/middleware/recaptcha';
import { withRateLimit, RateLimitPresets } from '@/middleware/rateLimit';
import { checkFraud } from '@/server/services/fraudDetectionService';
import { getPrice } from '@/server/services/priceService';
import { z } from 'zod';

const prisma = new PrismaClient();

const SendTransactionRequestSchema = z.object({
  walletId: z.string().uuid(),
  blockchain: z.enum(['ethereum', 'celo', 'polygon', 'arbitrum', 'optimism', 'bitcoin', 'solana']),
  toAddress: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  signedTransaction: z.string().min(1), // Signed transaction (hex for EVM, base64 for Solana)
  tokenSymbol: z.string().optional(),
  tokenAddress: z.string().optional(),
  memo: z.string().optional(),
  amountUsd: z.number().optional(), // USD equivalent (calculated client-side)
});

// Helper: Get native token symbol for blockchain
function getNativeSymbol(blockchain: string): string {
  const symbols: Record<string, string> = {
    ethereum: 'ETH',
    celo: 'CELO',
    polygon: 'MATIC',
    arbitrum: 'ETH',
    optimism: 'ETH',
    bitcoin: 'BTC',
    solana: 'SOL',
  };
  return symbols[blockchain] || 'ETH';
}

/**
 * POST /api/wallet/send - Send a transaction
 * 
 * NON-CUSTODIAL: This endpoint accepts signed transactions from the client.
 * Transactions must be signed client-side before submission.
 * 
 * ✅ PROTECTED: reCAPTCHA (score 0.8) + Rate Limiting (10 req/min) + Fraud Detection
 */
async function handleWalletSend(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/send', method: 'POST' });
  const { requestId } = log;
  let userId: string | null = null;
  
  try {
    userId = await getUserIdFromRequest(request);
    log.logStart({ userId });
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check idempotency key
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey) {
      const idempotencyCheck = await checkIdempotency(idempotencyKey, userId);
      if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
        return NextResponse.json(idempotencyCheck.previousResponse);
      }
    }

    // Validate request body
    const body = await validateBody(request, SendTransactionRequestSchema);

    // Get wallet and verify ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: body.walletId, userId },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Wallet not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (wallet.blockchain !== body.blockchain) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Wallet blockchain mismatch', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // ✅ FETCH PRICE: Calculate USD amount for fraud detection & daily limits
    let amountUsd = body.amountUsd;
    let exchangeRate: number | undefined;
    
    if (!amountUsd) {
      const tokenSymbol = body.tokenSymbol || getNativeSymbol(body.blockchain);
      const priceData = await getPrice(tokenSymbol.toLowerCase());
      
      if (priceData) {
        exchangeRate = priceData.price;
        amountUsd = parseFloat(body.amount) * exchangeRate;
      } else {
        // Fallback: assume $100 per token for fraud check (conservative)
        amountUsd = parseFloat(body.amount) * 100;
        logger.warn('Could not fetch price, using fallback', { tokenSymbol, blockchain: body.blockchain, requestId });
      }
    }

    // ✅ FRAUD DETECTION: Check for suspicious activity
    const fraudCheck = await checkFraud({
      userId,
      amount: parseFloat(body.amount),
      amountUsd,
      type: 'crypto',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    if (!fraudCheck.allowed) {
      logger.warn('Transaction blocked by fraud detection', {
        userId,
        riskScore: fraudCheck.riskScore,
        flags: fraudCheck.flags,
        requestId,
      });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.FRAUD_DETECTED, fraudCheck.reason || 'Transaction flagged as suspicious', requestId, { flags: fraudCheck.flags }),
        { status: getStatusForErrorCode(ErrorCodes.FRAUD_DETECTED) }
      );
    }

    if (fraudCheck.requiresReview) {
      logger.info('Transaction requires manual review', {
        userId,
        riskScore: fraudCheck.riskScore,
        flags: fraudCheck.flags,
        requestId,
      });
    }

    // Verify from address matches wallet
    if (wallet.address.toLowerCase() !== body.toAddress.toLowerCase() && 
        !body.signedTransaction.includes(wallet.address.toLowerCase().replace('0x', ''))) {
      logger.warn('Address mismatch in signed transaction', { walletAddress: wallet.address, requestId });
    }

    // Broadcast signed transaction
    const result = await broadcastSignedTransaction({
      userId,
      walletId: body.walletId,
      blockchain: body.blockchain,
      fromAddress: wallet.address,
      toAddress: body.toAddress,
      amount: body.amount,
      tokenSymbol: body.tokenSymbol,
      tokenAddress: body.tokenAddress,
      memo: body.memo,
      signedTransaction: body.signedTransaction,
    });

    if (!result.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.TRANSACTION_FAILED, result.error || 'Failed to broadcast transaction', requestId),
        { status: getStatusForErrorCode(ErrorCodes.TRANSACTION_FAILED) }
      );
    }

    // Record transaction in database with USD amount
    try {
      await prisma.transaction.create({
        data: {
          walletId: body.walletId,
          txHash: result.txHash!,
          blockchain: body.blockchain,
          fromAddress: wallet.address,
          toAddress: body.toAddress,
          amount: body.amount,
          amountUsd: amountUsd, // ✅ Store USD amount for daily limits
          exchangeRate: exchangeRate, // ✅ Store exchange rate
          tokenSymbol: body.tokenSymbol,
          tokenAddress: body.tokenAddress,
          status: 'pending',
          type: 'send',
          memo: body.memo,
          timestamp: new Date(),
        },
      });
    } catch (dbError) {
      logger.error('Failed to record transaction', dbError, { walletId: body.walletId, txHash: result.txHash, requestId });
      // Don't fail the request if DB write fails
    }

    // Validate response
    const validatedResponse = {
      txHash: result.txHash!,
      blockchain: body.blockchain,
      status: 'pending',
    };

    const response = NextResponse.json(
      createSuccessEnvelope(validatedResponse, requestId),
      { status: 200 }
    );
    
    // Store idempotency key
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, userId, response);
    }

    log.logSuccess({
      userId,
      walletId: body.walletId,
      txHash: result.txHash,
      blockchain: body.blockchain,
    });

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Validation failed', requestId, { fields: error.fields }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    log.logError(error, { userId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to send transaction', requestId),
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Export with middleware protection
export const POST = withRateLimit(
  withRecaptcha(
    handleWalletSend,
    { action: 'wallet_send', minScore: 0.8, required: true }
  ),
  RateLimitPresets.SENSITIVE
);

