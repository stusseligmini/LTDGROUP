export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { broadcastSignedTransaction, getSolanaConnection } from '@/lib/solana/solanaWallet';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import { checkIdempotency, storeIdempotency } from '@/lib/validation/idempotency';
import { verifySignedTransaction } from '@/lib/solana/transactionVerification';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/security/rateLimit';
import { csrfMiddleware } from '@/lib/security/csrfProtection';
import { checkDailyLimit } from '@/server/services/transactionService';

const prisma = new PrismaClient();

const SolanaSendRequestSchema = z.object({
  walletId: z.string().uuid().optional(),
  toAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address'),
  amount: z.number().positive(),
  signedTransaction: z.string().min(1), // Base64 encoded signed transaction
  priorityLevel: z.enum(['low', 'normal', 'high', 'instant']).optional().default('instant'),
  memo: z.string()
    .max(280, 'Memo too long')
    .trim()
    .transform(str => str.replace(/<[^>]*>/g, '')) // Strip HTML tags
    .optional(),
  casinoId: z.string().optional(), // Optional: casino preset ID
});

/**
 * POST /api/solana/send - Send SOL transaction
 * 
 * NON-CUSTODIAL: Accepts signed transactions from client
 * Optimized for gambling with instant confirmation
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/solana/send', method: 'POST' });
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

    // SECURITY: Rate limiting (per-user key)
    const rateLimitResult = await rateLimitMiddleware(request, {
      ...(RateLimitPresets.transaction ?? RateLimitPresets.write),
      keyGenerator: () => userId!,
    });
    if (rateLimitResult) return rateLimitResult;

    // SECURITY: CSRF protection
    const csrfResult = csrfMiddleware(request);
    if (csrfResult) return csrfResult;

    // Check idempotency key
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey) {
      const idempotencyCheck = await checkIdempotency(idempotencyKey, userId);
      if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
        return NextResponse.json(idempotencyCheck.previousResponse);
      }
    }

    // Validate request body
    const body = await request.json();
    const validation = SolanaSendRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', requestId, validation.error.flatten()),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const { walletId, toAddress, amount, signedTransaction, priorityLevel, memo, casinoId } = validation.data;

    // SECURITY: Rate limiting - check transaction count in last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentTxCount = await prisma.transaction.count({
      where: {
        wallet: { userId },
        blockchain: 'solana',
        timestamp: { gte: oneMinuteAgo },
      },
    });

    if (recentTxCount >= 10) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.RATE_LIMITED, 'Too many transactions. Please wait a moment before sending again.', requestId, { limit: 10, window: '60s', count: recentTxCount }),
        { status: getStatusForErrorCode(ErrorCodes.RATE_LIMITED) }
      );
    }

    // If walletId provided, verify ownership
    let fromAddress = '';
    if (walletId) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId, blockchain: 'solana' },
      });

      if (!wallet) {
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Wallet not found', requestId),
          { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
        );
      }
      
      fromAddress = wallet.address;
    }

    // SECURITY: Verify transaction signature and amount
    const verification = verifySignedTransaction(signedTransaction);
    
    if (!verification.valid) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, verification.error || 'Transaction verification failed', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    // Verify amount matches
    if (verification.amount && Math.abs(verification.amount - amount) > 0.000001) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Transaction amount does not match claimed amount', requestId, { claimed: amount, actual: verification.amount }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify fromAddress if provided
    // Capture signer for downstream validations (daily limit enforcement)
    if (verification.from) {
      fromAddress = verification.from;
    }

    logger.info('Transaction validated successfully', {
      amount: verification.amount,
      from: verification.from,
      to: verification.to,
      requestId,
    });

    // Enforce daily transaction limit ($10,000)
    const { allowed, remaining } = await checkDailyLimit({
      userId,
      amountUsd: amount,
    });
    if (!allowed) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.DAILY_LIMIT_EXCEEDED, 'Daily transaction limit of $10,000 reached', requestId, { remaining }),
        { status: getStatusForErrorCode(ErrorCodes.DAILY_LIMIT_EXCEEDED) }
      );
    }

    // Broadcast signed transaction
    const connection = getSolanaConnection();
    const result = await broadcastSignedTransaction(signedTransaction, connection);

    // Record transaction in database (if walletId provided)
    if (walletId) {
      try {
        await prisma.transaction.create({
          data: {
            walletId,
            txHash: result.signature,
            blockchain: 'solana',
            fromAddress: fromAddress,
            toAddress,
            amount: amount.toString(),
            status: 'pending',
            type: casinoId ? 'casino_deposit' : 'send',
            memo: memo || (casinoId ? `Casino deposit: ${casinoId}` : null),
            timestamp: new Date(),
          },
        });
      } catch (dbError) {
        logger.error('Failed to record transaction', dbError, { walletId, txHash: result.signature, requestId });
        // Don't fail the request if DB write fails
      }
    }

    const responseData = {
      signature: result.signature,
      slot: result.slot,
      amount: amount.toString(),
      toAddress,
      priorityLevel,
      casinoId: casinoId || null,
    };
    
    const response = NextResponse.json(
      createSuccessEnvelope(responseData, requestId),
      { status: 200 }
    );

    // Store idempotency key
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, userId, responseData);
    }

    logger.info('Solana transaction sent', {
      userId,
      txHash: result.signature,
      amount,
      toAddress,
      casinoId,
      requestId,
    });

    log.logSuccess({
      userId,
      txHash: result.signature,
      amount,
      toAddress,
      casinoId,
    });

    return response;
  } catch (error) {
    log.logError(error, { userId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to send transaction', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}


