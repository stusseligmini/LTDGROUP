/**
 * Card Provider Webhook
 * POST /api/cards/webhook?provider=gnosis|highnote|mock
 *
 * Minimal handler to ingest provider transaction webhooks, verify signature when supported,
 * and fan-out notifications (push/in-app/telegram via notificationService).
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ensureProvidersInitialized, getProvider, isProviderAvailable } from '@/server/services/cardIssuing/factory';
import type { CardProvider } from '@/server/services/cardIssuing/types';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { logError } from '@/lib/logger';
import { sendNotification } from '@/server/services/notificationService';

const prisma = new PrismaClient();
const SIGNATURE_HEADER = 'x-signature';

export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards/webhook', method: 'POST' });
  const { requestId } = log;
  const url = new URL(request.url);
  const providerName = (url.searchParams.get('provider') as CardProvider | null) ?? null;

  try {
    if (!providerName) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Missing provider query param', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    await ensureProvidersInitialized();
    if (!isProviderAvailable(providerName)) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.INVALID_REQUEST, 'Provider not available', requestId),
        { status: getStatusForErrorCode(ErrorCodes.INVALID_REQUEST) }
      );
    }

    const provider = getProvider(providerName);

    // Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get(SIGNATURE_HEADER) || '';

    if (typeof provider.verifyWebhook === 'function') {
      const ok = provider.verifyWebhook(rawBody, signature);
      if (!ok) {
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Invalid webhook signature', requestId),
          { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
        );
      }
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};

    const txCardId = payload.cardId || payload.providerCardId || payload.card_id;
    const txStatus = payload.status || payload.state || 'pending';
    const txAmount = payload.amount || payload.value || 0;
    const txCurrency = payload.currency || payload.currencyCode || 'USD';
    const merchant = payload.merchantName || payload.merchant || 'Merchant';
    const mcc = payload.mcc || '0000';

    if (!txCardId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'cardId missing in webhook payload', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const card = await prisma.card.findFirst({ where: { id: txCardId } });

    if (!card) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card not found for webhook', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Persist minimal notification record
    await prisma.notification.create({
      data: {
        userId: card.userId,
        type: 'system',
        title: 'Card transaction',
        body: `${txStatus.toString().toUpperCase()}: ${merchant} ${txAmount} ${txCurrency} (MCC ${mcc})`,
        channels: ['push', 'in-app', 'telegram'],
      },
    });

    // Send multi-channel notification (push/email/telegram handled in service)
    await sendNotification(card.userId, {
      title: 'Card transaction',
      body: `${merchant}: ${txAmount} ${txCurrency} (${txStatus})`,
      type: 'transaction',
      channels: ['push', 'telegram'],
    });

    return NextResponse.json(createSuccessEnvelope({ received: true }, requestId));
  } catch (error) {
    logError('Card webhook handling failed', error, { provider: providerName });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Webhook processing failed', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}
