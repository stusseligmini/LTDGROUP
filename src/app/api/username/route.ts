import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { checkIdempotency, storeIdempotency } from '@/lib/validation/idempotency';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { applyRateLimitWithMessage } from '@/lib/api/rateLimitHelper';

const prisma = new PrismaClient();

const UsernameSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-z0-9._]+$/, 'Username can only contain lowercase letters, numbers, dots, and underscores'),
});

/**
 * POST /api/username - Register username (@username.sol)
 * 
 * NON-CUSTODIAL: Maps username to Solana address for easy transfers
 * Creates the "feels custodial but isn't" magic
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/username', method: 'POST'});
  const {requestId} = log;
  
  // Rate limiting: 30 username registrations per minute per user/IP
  const rateLimitError = await applyRateLimitWithMessage(
    request,
    { limit: 30, windowMs: 60 * 1000, endpoint: 'username-register' },
    requestId,
    'Too many username registration attempts. Please wait before trying again.'
  );
  if (rateLimitError) return rateLimitError;
  
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

    // Check idempotency
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey) {
      const idempotencyCheck = await checkIdempotency(idempotencyKey, userId);
      if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
        return NextResponse.json(idempotencyCheck.previousResponse);
      }
    }

    const body = await request.json();
    const { username, solanaAddress } = body;

    // Validate username format
    const usernameValidation = UsernameSchema.safeParse({ username });
    if (!usernameValidation.success) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid username format',
          requestId,
          { fields: usernameValidation.error.flatten() }
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const validatedUsername = usernameValidation.data.username.toLowerCase();

    // Validate Solana address
    if (!solanaAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solanaAddress)) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid Solana address',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check if username is already taken
    const existing = await prisma.user.findFirst({
      where: {
        username: validatedUsername,
      },
    });

    if (existing && existing.id !== userId) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.CONFLICT,
          'Username already taken',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.CONFLICT) }
      );
    }

    // Get user's Solana wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        blockchain: 'solana',
        address: solanaAddress,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.NOT_FOUND,
          'Solana wallet not found',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Update user with username
    const _updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username: validatedUsername },
    });

    // Store username mapping for easy lookup (cache in separate table if needed)
    // For now, username is in User table

    const response = NextResponse.json(
      createSuccessEnvelope({
        username: validatedUsername,
        address: solanaAddress,
        displayName: `@${validatedUsername}.sol`,
      }, requestId),
      { status: 200 }
    );

    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, userId, response);
    }

    logger.info('Username registered', {
      userId,
      username: validatedUsername,
      address: solanaAddress,
      requestId,
    });

    return response;
  } catch (error) {
    logger.error('Error registering username', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to register username',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET /api/username?username=dexter - Lookup username
 * 
 * Resolves @username.sol to Solana address
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/username', method: 'GET'});
  const {requestId} = log;
  
  // Rate limiting: 30 username lookups per minute per user/IP to prevent enumeration
  const rateLimitError = await applyRateLimitWithMessage(
    request,
    { limit: 30, windowMs: 60 * 1000, endpoint: 'username-lookup' },
    requestId,
    'Too many username lookup attempts. Please wait before trying again.'
  );
  if (rateLimitError) return rateLimitError;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    let username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Username is required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Remove @ and .sol suffix if present
    username = username.replace(/^@/, '').replace(/\.sol$/, '').toLowerCase();

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        wallets: {
          where: { blockchain: 'solana' },
          take: 1,
        },
      },
    });

    if (!user || !user.wallets || user.wallets.length === 0) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.NOT_FOUND,
          'Username not found',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const wallet = user.wallets[0];

    return NextResponse.json(
      createSuccessEnvelope({
        username: user.username!,
        displayName: `@${user.username}.sol`,
        address: wallet.address,
        publicKey: wallet.publicKey,
      }, requestId),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error looking up username', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to lookup username',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}


