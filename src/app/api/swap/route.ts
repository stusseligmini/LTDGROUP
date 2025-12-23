import { NextRequest, NextResponse } from 'next/server';
import swapService from '@/server/services/swapService';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { withRecaptcha } from '@/middleware/recaptcha';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import { SwapExecuteRequestSchema, SwapExecuteResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { checkIdempotency, storeIdempotency } from '@/lib/validation/idempotency';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/security/rateLimit';
import { checkDailyLimit } from '@/server/services/transactionService';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * POST /api/swap - Execute a token swap
 * 
 * NON-CUSTODIAL: This endpoint accepts signed transactions from the client.
 * Transactions must be signed client-side before submission.
 * ✅ PROTECTED: reCAPTCHA (score 0.5) + Rate Limiting
 */
async function handleSwapPOST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/swap', method: 'POST' });
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

    // Check if this is a simulation request
    const { searchParams } = new URL(request.url);
    const isSimulation = searchParams.get('simulate') === 'true';

    // SECURITY: Rate limiting (per-user key to avoid shared IP collisions)
    if (!isSimulation) {
      const rateLimitResult = await rateLimitMiddleware(request, {
        ...((RateLimitPresets as any).transaction ?? RateLimitPresets.write),
        keyGenerator: () => userId,
      });
      if (rateLimitResult) return rateLimitResult;
    }

    // Check idempotency key (for POST requests)
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey && !isSimulation) {
      const idempotencyCheck = await checkIdempotency(idempotencyKey, userId);
      if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
        return NextResponse.json(idempotencyCheck.previousResponse);
      }
    }

    // Validate request body
    const body = await validateBody(request, SwapExecuteRequestSchema);

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

    // For simulation, skip signature validation
    if (!isSimulation && !body.signedTransaction) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Signed transaction is required. Transaction must be signed client-side.', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // For simulation, return mock result
    if (isSimulation) {
      const simulationResult = {
        success: true,
        simulation: true,
        estimatedGas: '5000',
        confirmationTime: '25s',
        slippage: '0.5%',
        message: 'Simulation successful - ready to execute',
      };
      return NextResponse.json(
        createSuccessEnvelope(simulationResult, requestId),
        { status: 200 }
      );
    }

    // Enforce daily transaction limit ($10,000) based on requested amount
    const numericAmount = parseFloat(body.amount);
    const amountForLimit = Number.isFinite(numericAmount) ? numericAmount : 0;
    const { allowed, remaining } = await checkDailyLimit({
      userId,
      amountUsd: amountForLimit,
    });
    if (!allowed) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.DAILY_LIMIT_EXCEEDED, 'Daily transaction limit of $10,000 reached', requestId, { remaining }),
        { status: getStatusForErrorCode(ErrorCodes.DAILY_LIMIT_EXCEEDED) }
      );
    }

    let txHash: string;

    if (body.blockchain === 'solana') {
      if (!body.quoteResponse) {
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Quote response required for Solana swaps', requestId),
          { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }

      // Broadcast signed Solana transaction
      txHash = await swapService.broadcastSignedJupiterSwap(
        wallet.address,
        body.quoteResponse,
        body.signedTransaction // Base64 encoded signed transaction
      );
    } else {
      // EVM chains - broadcast signed transaction
      const chainIdMap: Record<string, number> = {
        ethereum: 1,
        polygon: 137,
        arbitrum: 42161,
        optimism: 10,
        celo: 42220,
      };

      const chainId = chainIdMap[body.blockchain];
      if (!chainId) {
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Unsupported blockchain', requestId),
          { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }

      // Broadcast signed EVM transaction
      txHash = await swapService.broadcastSigned1InchSwap(
        chainId,
        body.fromToken,
        body.toToken,
        body.amount,
        wallet.address,
        body.signedTransaction // Hex encoded signed transaction
      );
    }

    // Record transaction in database
    try {
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          txHash,
          blockchain: body.blockchain,
          fromAddress: wallet.address,
          toAddress: wallet.address, // Swap is self-transaction
          amount: '0', // Amount handled by swap service
          status: 'pending',
          type: 'swap',
          timestamp: new Date(),
        },
      });
    } catch (dbError) {
      logger.error('Failed to record swap transaction', dbError, { walletId: body.walletId, txHash, requestId });
      // Don't fail the request if DB write fails
    }

    // Validate response
    const validatedResponse = SwapExecuteResponseSchema.parse({ txHash, blockchain: body.blockchain });

    const response = NextResponse.json(
      createSuccessEnvelope(validatedResponse, requestId),
      { status: 200 }
    );
    
    // Store idempotency key for future requests
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, userId, response);
    }

    log.logSuccess({
      userId,
      walletId: wallet.id,
      txHash,
      blockchain: body.blockchain,
      simulation: isSimulation,
    });

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Validation error',
          requestId,
          { fields: error.fields }
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    log.logError(error, { userId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to execute swap', requestId),
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Export POST with reCAPTCHA protection
export const POST = withRecaptcha(
  handleSwapPOST,
  { action: 'swap', minScore: 0.5 }
);

