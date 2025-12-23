/**
 * Hidden Vault API - Status and Management
 * /api/wallet/vault
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SetVaultPinRequestSchema, UnlockVaultRequestSchema, UpdateVaultSettingsRequestSchema } from '@/lib/validation/schemas';
import { hashPin, verifyPin, isWeakPin, checkPinRateLimit, resetPinAttempts, generateVaultToken, markVaultUnlocked, isVaultUnlocked } from '@/lib/security/pinProtection';
import { logError } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

// Force Node.js runtime for crypto operations
export const runtime = 'nodejs';

const prisma = new PrismaClient();

/**
 * POST /api/wallet/vault/set-pin - Set or change vault PIN
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/vault', method: 'POST' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = SetVaultPinRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', requestId, validation.error.flatten()),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const { walletId, pin } = validation.data;

    // Check for weak PIN
    if (isWeakPin(pin)) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'PIN is too weak. Avoid sequential or repeating digits.', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Wallet not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Hash PIN and update wallet
    const pinHash = hashPin(pin);
    
    await prisma.wallet.update({
      where: { id: walletId },
      data: {
        isHidden: true,
        pinHash,
        vaultLevel: 1, // Set to hidden vault level
      },
    });

    return NextResponse.json(
      createSuccessEnvelope({ success: true }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to set vault PIN', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to set vault PIN', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * POST /api/wallet/vault/unlock - Unlock hidden vault with PIN
 */
export async function PUT(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/vault', method: 'PUT' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = UnlockVaultRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', requestId, validation.error.flatten()),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const { walletId, pin } = validation.data;

    // Check rate limit
    const rateLimit = checkPinRateLimit(userId, walletId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.RATE_LIMITED, 'Too many failed attempts. Please try again later.', requestId),
        { status: getStatusForErrorCode(ErrorCodes.RATE_LIMITED) }
      );
    }

    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId, isHidden: true },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Vault not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (!wallet.pinHash) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Vault PIN not set', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify PIN
    const isValid = verifyPin(pin, wallet.pinHash);
    
    if (!isValid) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, `Incorrect PIN. ${rateLimit.remainingAttempts - 1} attempts remaining.`, requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Reset rate limit on successful unlock
    resetPinAttempts(userId, walletId);

    // Mark vault as unlocked in session
    markVaultUnlocked(userId, walletId, 5 * 60 * 1000); // 5 minutes

    // Generate vault session token
    const token = generateVaultToken(userId, walletId);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    return NextResponse.json(
      createSuccessEnvelope({
        token,
        expiresAt: expiresAt.toISOString(),
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to unlock vault', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to unlock vault', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * GET /api/wallet/vault/status - Get vault status for a wallet
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/vault', method: 'GET' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');

    if (!walletId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'walletId is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
      select: {
        id: true,
        isHidden: true,
        vaultLevel: true,
        pinHash: true,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Wallet not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if vault is unlocked in current session
    const isUnlocked = isVaultUnlocked(userId, walletId);

    return NextResponse.json(
      createSuccessEnvelope({
        isHidden: wallet.isHidden,
        vaultLevel: wallet.vaultLevel,
        hasPinSet: !!wallet.pinHash,
        isUnlocked,
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to get vault status', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get vault status', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * PATCH /api/wallet/vault/settings - Update vault settings
 */
export async function PATCH(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/vault', method: 'PATCH' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    const walletId = body.walletId;

    if (!walletId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'walletId is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Validate request body
    const validation = UpdateVaultSettingsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', requestId, validation.error.flatten()),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Wallet not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Update vault settings
    const updatedWallet = await prisma.wallet.update({
      where: { id: walletId },
      data: {
        isHidden: validation.data.isHidden ?? wallet.isHidden,
        vaultLevel: validation.data.vaultLevel ?? wallet.vaultLevel,
      },
    });

    return NextResponse.json(
      createSuccessEnvelope({
        isHidden: updatedWallet.isHidden,
        vaultLevel: updatedWallet.vaultLevel,
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to update vault settings', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update vault settings', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

