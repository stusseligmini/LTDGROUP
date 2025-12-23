import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { WalletCreateRequestSchema, WalletCreateResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { checkIdempotency, storeIdempotency } from '@/lib/validation/idempotency';
import { withRecaptcha } from '@/middleware/recaptcha';
import { withRateLimit, RateLimitPresets } from '@/middleware/rateLimit';

const prisma = new PrismaClient();

/**
 * POST /api/wallet/create - Create a new non-custodial wallet
 * 
 * NON-CUSTODIAL: This endpoint only stores public keys and addresses.
 * Private keys are NEVER sent to the server - they're encrypted client-side.
 * Only the mnemonic hash is stored for recovery verification.
 * 
 * ✅ PROTECTED: reCAPTCHA (score 0.7) + Rate Limiting (10 req/min)
 */
async function handleWalletCreate(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/create', method: 'POST' });
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
    const body = await validateBody(request, WalletCreateRequestSchema);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'User not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if wallet with same address and blockchain already exists
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId,
        blockchain: body.blockchain,
        address: body.address,
      },
    });

    if (existingWallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.CONFLICT, 'Wallet with this address already exists', requestId),
        { status: getStatusForErrorCode(ErrorCodes.CONFLICT) }
      );
    }

    // If this is set as default, unset other default wallets for this user
    if (body.isDefault) {
      await prisma.wallet.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create wallet - ONLY store public information
    // Private keys and any mnemonic-related data are NEVER stored on the server
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        blockchain: body.blockchain,
        address: body.address,
        publicKey: body.publicKey || null,
        label: body.label || null,
        isDefault: body.isDefault || false,
        derivationPath: body.derivationPath || null,
        balanceCache: '0',
        balanceFiat: 0,
        fiatCurrency: 'USD',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'wallet_created',
        resource: 'wallet',
        resourceId: wallet.id,
        platform: 'web',
        severity: 'info',
        metadata: {
          blockchain: body.blockchain,
          address: body.address,
          isDefault: body.isDefault,
        },
      },
    }).catch(err => {
      logger.warn('Failed to create audit log', err);
      // Don't fail the request if audit log fails
    });

    // Validate response
    const validatedResponse = WalletCreateResponseSchema.parse({
      id: wallet.id,
      blockchain: wallet.blockchain,
      address: wallet.address,
      publicKey: wallet.publicKey,
      label: wallet.label,
      isDefault: wallet.isDefault,
      balanceCache: wallet.balanceCache,
      balanceFiat: wallet.balanceFiat?.toNumber() || null,
      fiatCurrency: wallet.fiatCurrency,
      createdAt: wallet.createdAt.toISOString(),
    });

    const response = NextResponse.json(
      createSuccessEnvelope(validatedResponse, requestId),
      { status: 201 }
    );
    
    // Store idempotency key
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, userId, response);
    }

    log.logSuccess({
      userId,
      walletId: wallet.id,
      blockchain: wallet.blockchain,
      address: wallet.address,
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
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create wallet', requestId),
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Export with middleware protection
export const POST = withRateLimit(
  withRecaptcha(
    handleWalletCreate,
    { action: 'wallet_create', minScore: 0.7, required: true }
  ),
  RateLimitPresets.SENSITIVE
);

