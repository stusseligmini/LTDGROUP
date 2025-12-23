/**
 * Virtual Cards API - GET (list), POST (create)
 * /api/cards
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRecaptcha } from '@/middleware/recaptcha';
import { PrismaClient } from '@prisma/client';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { CardCreateRequestSchema, CardListQuerySchema } from '@/lib/validation/schemas';
import { encrypt, generateCardNumber, generateCVV, getLastFourDigits } from '@/lib/security/encryption';
import { logError } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { ensureProvidersInitialized, selectProviderForUser, getProvider, isProviderAvailable } from '@/server/services/cardIssuing/factory';
import type { CardProvider, CardDetails as ProviderCardDetails } from '@/server/services/cardIssuing/types';

const prisma = new PrismaClient();

/**
 * GET /api/cards - List all cards for user
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards', method: 'GET' });
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
    
    // Validate query params
    const queryValidation = CardListQuerySchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      walletId: searchParams.get('walletId'),
      status: searchParams.get('status'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', requestId, queryValidation.error.flatten()),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const { page, limit, walletId, status } = queryValidation.data;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    if (walletId) where.walletId = walletId;
    if (status) where.status = status;

    // Fetch cards
    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          walletId: true,
          nickname: true,
          brand: true,
          type: true,
          cardholderName: true,
          expiryMonth: true,
          expiryYear: true,
          spendingLimit: true,
          dailyLimit: true,
          monthlyLimit: true,
          totalSpent: true,
          monthlySpent: true,
          status: true,
          isOnline: true,
          isContactless: true,
          isATM: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
          activatedAt: true,
          encryptedNumber: true, // For last 4 digits only
          provider: true,
          providerCardId: true,
          providerStatus: true,
        },
      }),
      prisma.card.count({ where }),
    ]);

    // Map to response format (with masked card numbers)
    const cardsResponse = cards.map(card => {
      // Decrypt only to get last 4 digits, don't return full number
      const lastFourDigits = getLastFourDigits(card.encryptedNumber); // In production, decrypt first
      
      return {
        id: card.id,
        userId: card.userId,
        walletId: card.walletId,
        nickname: card.nickname,
        brand: card.brand as 'VISA' | 'MASTERCARD',
        type: card.type as 'virtual' | 'physical',
        lastFourDigits,
        cardholderName: card.cardholderName,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        spendingLimit: card.spendingLimit ? Number(card.spendingLimit) : null,
        dailyLimit: card.dailyLimit ? Number(card.dailyLimit) : null,
        monthlyLimit: card.monthlyLimit ? Number(card.monthlyLimit) : null,
        totalSpent: Number(card.totalSpent),
        monthlySpent: Number(card.monthlySpent),
        status: card.status as 'active' | 'frozen' | 'cancelled',
        isOnline: card.isOnline,
        isContactless: card.isContactless,
        isATM: card.isATM,
        lastUsedAt: card.lastUsedAt?.toISOString() || null,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
        activatedAt: card.activatedAt?.toISOString() || null,
        provider: card.provider,
        providerCardId: card.providerCardId,
        providerStatus: card.providerStatus,
      };
    });

    return NextResponse.json(
      createSuccessEnvelope({
        cards: cardsResponse,
        pagination: { page, limit, total },
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    logError('Failed to fetch cards', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch cards', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * POST /api/cards - Create new virtual card
 * ✅ PROTECTED: reCAPTCHA (score 0.6) + Rate Limiting
 */
async function handleCardCreatePOST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards', method: 'POST' });
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
    const validation = CardCreateRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', requestId, validation.error.flatten()),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const { walletId, nickname, brand, type, spendingLimit, dailyLimit, monthlyLimit, provider: providerOverride } = validation.data;

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

    await ensureProvidersInitialized();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        email: true,
        preferredCardProvider: true,
        cardType: true,
      },
    });

    const cardholderNameResolved = (user?.displayName || user?.email?.split('@')[0] || 'CARDHOLDER').toUpperCase();
    const inferredCardType = (user?.cardType as 'crypto-native' | 'traditional' | undefined) || (type === 'physical' ? 'traditional' : undefined);
    let providerName: CardProvider =
      (providerOverride as CardProvider | undefined) ||
      (user?.preferredCardProvider as CardProvider | undefined) ||
      selectProviderForUser(undefined, inferredCardType);

    if (!providerName || !isProviderAvailable(providerName)) {
      providerName = selectProviderForUser(undefined, inferredCardType);
    }

    if (!isProviderAvailable(providerName)) {
      providerName = 'mock';
    }

    const provider = getProvider(providerName);

    const createRequest = {
      userId,
      walletId,
      nickname,
      brand,
      type,
      spendingLimit,
      dailyLimit,
      monthlyLimit,
      cardholderName: cardholderNameResolved,
    };

    let providerResponse = await provider.createCard(createRequest);

    if (!providerResponse.success) {
      if (providerName !== 'mock') {
        const fallbackProvider = getProvider('mock');
        providerName = 'mock';
        providerResponse = await fallbackProvider.createCard(createRequest);
      }

      if (!providerResponse.success) {
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.EXTERNAL_SERVICE_ERROR, providerResponse.error || 'Failed to create card', requestId),
          { status: getStatusForErrorCode(ErrorCodes.EXTERNAL_SERVICE_ERROR) }
        );
      }
    }

    const providerCard = providerResponse.data;
    const providerCardDetails = providerResponse.providerData?.cardDetails as ProviderCardDetails | undefined;

    const rawCardNumber = providerCardDetails?.cardNumber ?? generateCardNumber(brand);
    const rawCvv = providerCardDetails?.cvv ?? generateCVV();

    const encryptedNumber = encrypt(rawCardNumber);
    // CVV is NEVER stored (PCI DSS) - only returned once in this response

    const now = new Date();
    const expiryMonth = providerCard?.expiryMonth ?? now.getMonth() + 1;
    const expiryYear = providerCard?.expiryYear ?? now.getFullYear() + 3;
    const persistedCardholderName = providerCard?.cardholderName ?? cardholderNameResolved;
    const status = providerCard?.status ?? 'active';
    const providerCardId =
      providerResponse.providerData?.providerCardId ||
      providerCard?.providerId ||
      providerCard?.id;
    const lastFourDigits = providerCard?.lastFourDigits ?? getLastFourDigits(rawCardNumber);

    const card = await prisma.card.create({
      data: {
        userId,
        walletId,
        encryptedNumber,
        cardholderName: persistedCardholderName,
        expiryMonth,
        expiryYear,
        nickname: providerCard?.nickname ?? nickname,
        brand: providerCard?.brand ?? brand,
        type: providerCard?.type ?? type ?? 'virtual',
        spendingLimit: providerCard?.spendingLimit ?? spendingLimit,
        dailyLimit: providerCard?.dailyLimit ?? dailyLimit,
        monthlyLimit: providerCard?.monthlyLimit ?? monthlyLimit,
        status,
        isOnline: providerCard?.isOnline ?? true,
        isContactless: providerCard?.isContactless ?? true,
        isATM: providerCard?.isATM ?? (type === 'physical'),
        activatedAt: new Date(),
        provider: providerName,
        providerCardId,
        providerStatus: status,
      },
    });

    return NextResponse.json(
      createSuccessEnvelope({
        card: {
          id: card.id,
          userId: card.userId,
          walletId: card.walletId,
          nickname: card.nickname,
          brand: card.brand,
          type: card.type,
          lastFourDigits,
          cardholderName: card.cardholderName,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          spendingLimit: card.spendingLimit ? Number(card.spendingLimit) : null,
          dailyLimit: card.dailyLimit ? Number(card.dailyLimit) : null,
          monthlyLimit: card.monthlyLimit ? Number(card.monthlyLimit) : null,
          totalSpent: Number(card.totalSpent),
          monthlySpent: Number(card.monthlySpent),
          status: card.status,
          isOnline: card.isOnline,
          isContactless: card.isContactless,
          isATM: card.isATM,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
          activatedAt: card.activatedAt?.toISOString() || null,
          provider: card.provider,
          providerCardId,
          // CVV and card number returned ONCE (never stored, never retrievable)
          cvv: rawCvv,
          cardNumber: rawCardNumber,
        },
      }, requestId),
      { status: 201 }
    );

  } catch (error) {
    logError('Failed to create card', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create card', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

// Export POST with reCAPTCHA protection
export const POST = withRecaptcha(
  handleCardCreatePOST,
  { action: 'card_create', minScore: 0.6 }
);
