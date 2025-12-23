/**
 * Card Wallet Provisioning API
 * POST /api/cards/[id]/provision
 *
 * Provisions a card token for Apple Pay / Google Pay via the configured provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { ensureProvidersInitialized, getProvider, isProviderAvailable } from '@/server/services/cardIssuing/factory';
import { logError } from '@/lib/logger';
import type { CardProvider } from '@/server/services/cardIssuing/types';

const prisma = new PrismaClient();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const log = createRequestLogger({ endpoint: `/api/cards/${id}/provision`, method: 'POST' });
  const { requestId } = log;

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const walletType = body.walletType as 'apple' | 'google';
    const payload = (body.payload ?? {}) as Record<string, any>;

    if (!walletType || (walletType !== 'apple' && walletType !== 'google')) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'walletType must be "apple" or "google"', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const card = await prisma.card.findFirst({ where: { id, userId } });
    if (!card) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    await ensureProvidersInitialized();

    if (!card.provider || !isProviderAvailable(card.provider as CardProvider)) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.INVALID_REQUEST, 'Card provider not available', requestId),
        { status: getStatusForErrorCode(ErrorCodes.INVALID_REQUEST) }
      );
    }

    const provider = getProvider(card.provider as CardProvider);
    if (typeof provider.provisionWalletToken !== 'function') {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.FORBIDDEN, 'Provider does not support wallet provisioning', requestId),
        { status: getStatusForErrorCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const providerCardId = (card as any).providerCardId || (card as any).providerId || card.id;

    const result = await provider.provisionWalletToken(providerCardId, userId, walletType, payload);

    return NextResponse.json(createSuccessEnvelope(result, requestId));
  } catch (error) {
    logError('Failed to provision wallet token', error, { route: '/api/cards/[id]/provision' });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to provision wallet token', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}
