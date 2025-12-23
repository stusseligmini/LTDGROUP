import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { withRecaptcha } from '@/middleware/recaptcha';
import { deriveMultipleWallets } from '@/lib/wallet/nonCustodialWallet';
import { WalletCreateResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { z } from 'zod';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

const WalletImportRequestSchema = z.object({
  mnemonic: z.string().min(1),
  blockchain: z.enum(['ethereum', 'celo', 'polygon', 'arbitrum', 'optimism', 'bitcoin', 'solana']),
  label: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().default(false),
});

/**
 * POST /api/wallet/import - Import wallet from mnemonic phrase
 * 
 * NON-CUSTODIAL: This endpoint imports a wallet from a mnemonic phrase.
 * Only public keys are stored on the server. No mnemonic or hashes are persisted.
 * ✅ PROTECTED: reCAPTCHA (score 0.7) + Rate Limiting
 */
async function handleWalletImportPOST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/import', method: 'POST' });
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

    // Validate request body
    const body = await validateBody(request, WalletImportRequestSchema);

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

    // Derive wallet from mnemonic (client should do this, but we verify)
    const wallets = await deriveMultipleWallets(body.mnemonic, [body.blockchain]);
    if (wallets.length === 0) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Failed to derive wallet from mnemonic', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const walletData = wallets[0];

    // Do not persist mnemonic or hashes per roadmap policy

    // Check if wallet with same address already exists
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId,
        blockchain: body.blockchain,
        address: walletData.address,
      },
    });

    if (existingWallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.RESOURCE_EXISTS, 'Wallet with this address already exists', requestId),
        { status: getStatusForErrorCode(ErrorCodes.RESOURCE_EXISTS) }
      );
    }

    // If this is set as default, unset other default wallets for this user
    if (body.isDefault) {
      await prisma.wallet.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create wallet - ONLY store public information (no mnemonic or hash)
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        blockchain: body.blockchain,
        address: walletData.address,
        publicKey: walletData.publicKey,
        label: body.label || null,
        isDefault: body.isDefault || false,
        derivationPath: walletData.derivationPath,
        balanceCache: '0',
        balanceFiat: 0,
        fiatCurrency: 'USD',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'wallet_imported',
        resource: 'wallet',
        resourceId: wallet.id,
        platform: 'web',
        severity: 'info',
        metadata: {
          blockchain: body.blockchain,
          address: wallet.address,
          isDefault: body.isDefault,
        },
      },
    }).catch(err => {
      logger.warn('Failed to create audit log', err);
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
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to import wallet', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Export POST with reCAPTCHA protection
export const POST = withRecaptcha(
  handleWalletImportPOST,
  { action: 'wallet_import', minScore: 0.7 }
);

