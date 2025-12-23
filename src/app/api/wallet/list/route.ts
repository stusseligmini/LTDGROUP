import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { WalletListQuerySchema, WalletListResponseSchema } from '@/lib/validation/schemas';
import { validateQuery, ValidationError } from '@/lib/validation/validate';
// import { createRequestLogger } from '@/lib/logging/requestLogger'; // Unused
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { getUserWallets } from '@/lib/firebase/firestore';
import { setRlsUser } from '@/server/db/rls';

const prisma = new PrismaClient();

/**
 * GET /api/wallet/list - Get list of wallets for authenticated user
 * 
 * Syncs wallet data between:
 * - PostgreSQL (primary database)
 * - Firestore (real-time sync for extension/telegram)
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      logger.warn('Wallet list: unauthorized', { requestId, duration: Date.now() - startTime });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    logger.info('Wallet list: request started', { userId, requestId });

    // Set RLS context before querying wallets
    await setRlsUser(prisma, userId);

    // Validate query parameters
    const query = validateQuery(request, WalletListQuerySchema);

    const where: any = { userId };
    if (query.blockchain) {
      where.blockchain = query.blockchain;
    }
    if (!query.includeHidden) {
      where.isHidden = false;
    }

    const wallets = await prisma.wallet.findMany({
      where,
      select: {
        id: true,
        blockchain: true,
        address: true,
        label: true,
        isDefault: true,
        isHidden: true,
        balanceCache: true,
        balanceFiat: true,
        fiatCurrency: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const total = await prisma.wallet.count({ where });

    // Sync wallets to Firestore in background (don't block response)
    if (wallets.length > 0) {
      try {
        const firebaseWallets = await getUserWallets(userId);
        logger.info('Wallet sync status', {
          userId,
          postgresCount: wallets.length,
          firestoreCount: firebaseWallets.length,
          requestId,
        });
      } catch (_firestoreError) {
        logger.warn('Could not sync wallets to Firestore', { userId, requestId });
        // Continue - PostgreSQL data is authoritative
      }
    }

    // Validate response
    const responseData = {
      wallets,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
      },
    };

    const validatedResponse = WalletListResponseSchema.parse({ wallets });

    logger.info('Fetched wallets successfully', {
      userId,
      count: wallets.length,
      requestId,
    });

    const duration = Date.now() - startTime;
    logger.info('Wallet list: success', { userId, walletCount: wallets.length, duration, requestId });
    return NextResponse.json(
      createSuccessEnvelope(validatedResponse, requestId),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Validation failed', requestId, { fields: error.fields }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    const duration = Date.now() - startTime;
    logger.error('Error fetching wallets', error instanceof Error ? error : undefined, { requestId, duration });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch wallets', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}


