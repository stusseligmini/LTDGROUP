/**
 * Card Transaction Authorization Webhook
 * Real-time transaction authorization - validates against controls
 * This is called by the payment processor before approving transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ensureProvidersInitialized, getProvider, isProviderAvailable } from '@/server/services/cardIssuing/factory';
import type { CardProvider } from '@/server/services/cardIssuing/types';
import { trackServerEvent, trackServerException } from '@/lib/telemetry/serverTelemetry';
import { rateLimitMiddleware } from '@/lib/security/rateLimit';
import { CardAuthorizationRequestSchema, CardAuthorizationResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { checkFraud } from '@/server/services/fraudDetectionService';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

// Force Node.js runtime for HMAC verification and crypto operations
export const runtime = 'nodejs';

const prisma = new PrismaClient();

/**
 * POST /api/cards/authorize - Real-time transaction authorization
 * Called by payment processor before approving transactions
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const log = createRequestLogger({ endpoint: '/api/cards/authorize', method: 'POST' });
  const { requestId } = log;
  
  try {
    // Rate limiting for webhook endpoint (prevent abuse)
    const rateLimitResult = await rateLimitMiddleware(request, {
      limit: 100, // 100 requests per minute per IP
      windowMs: 60 * 1000,
    });
    if (rateLimitResult) return rateLimitResult;

    // Verify webhook signature
    const signature = request.headers.get('x-webhook-signature');
    const providerHeader = request.headers.get('x-card-provider') || 'highnote';
    
    if (!signature) {
      trackServerEvent({
        name: 'card.authorization.rejected',
        properties: { reason: 'missing_signature' },
      });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Missing webhook signature', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // IP Allowlist check
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown';
    const allowedIps = process.env.CARD_WEBHOOK_IPS?.split(',') || [];
    
    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      trackServerEvent({
        name: 'card.authorization.rejected',
        properties: { reason: 'ip_not_allowed', clientIp },
      });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.FORBIDDEN, 'IP not allowed', requestId),
        { status: getStatusForErrorCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Verify HMAC signature with provider
    const rawBody = await request.text();
    await ensureProvidersInitialized();
    
    if (isProviderAvailable(providerHeader as CardProvider)) {
      const provider = getProvider(providerHeader as CardProvider);
      if (provider.verifyWebhook && !provider.verifyWebhook(rawBody, signature)) {
        trackServerEvent({
          name: 'card.authorization.rejected',
          properties: { reason: 'invalid_signature', provider: providerHeader },
        });
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Invalid webhook signature', requestId),
          { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
        );
      }
    }
    
    // Validate request body
    const body = await validateBody(
      new NextRequest(request.url, {
        method: 'POST',
        body: rawBody,
        headers: request.headers,
      }),
      CardAuthorizationRequestSchema
    );

    log.logStart({ provider: providerHeader, clientIp, cardId: body.cardId });

    // Get card and validate
    const card = await prisma.card.findUnique({
      where: { id: body.cardId },
      include: {
        wallet: {
          select: {
            balanceCache: true,
            balanceFiat: true,
          },
        },
      },
    });

    if (!card) {
      const _response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'CARD_NOT_FOUND',
        message: 'Card does not exist',
      });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card does not exist', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check card status
    if (card.status !== 'active') {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'CARD_INACTIVE',
        message: `Card is ${card.status}`,
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // Check if disposable card has been used
    if (card.isDisposable && card.lastUsedAt) {
      // Auto-cancel disposable card after first use
      await prisma.card.update({
        where: { id: body.cardId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'DISPOSABLE_CARD_USED',
        message: 'Disposable card already used',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // ✅ FRAUD DETECTION: Check for suspicious card activity
    const fraudCheck = await checkFraud({
      userId: card.userId,
      amount: body.amount,
      amountUsd: (body as any).amountUsd ?? body.amount, // Assume USD if not specified
      type: 'card',
      cardId: body.cardId,
      merchantCountry: body.merchantCountry,
      merchantCategory: body.mcc,
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    if (!fraudCheck.allowed) {
      trackServerEvent({
        name: 'card.authorization.fraud_blocked',
        properties: {
          cardId: body.cardId,
          riskScore: String(fraudCheck.riskScore),
          flags: Array.isArray(fraudCheck.flags) ? fraudCheck.flags.join(',') : String(fraudCheck.flags),
        },
      });

      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'FRAUD_DETECTED',
        message: fraudCheck.reason || 'Transaction flagged as suspicious',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    if (fraudCheck.requiresReview) {
      trackServerEvent({
        name: 'card.authorization.requires_review',
        properties: {
          cardId: body.cardId,
          riskScore: String(fraudCheck.riskScore),
          flags: Array.isArray(fraudCheck.flags) ? fraudCheck.flags.join(',') : String(fraudCheck.flags),
        },
      });
    }

    // Check MCC restrictions
    if (card.blockedMCC.includes(body.mcc)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'MERCHANT_CATEGORY_BLOCKED',
        message: `Merchant category ${body.mcc} is blocked`,
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    if (card.allowedMCC.length > 0 && !card.allowedMCC.includes(body.mcc)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'MERCHANT_CATEGORY_NOT_ALLOWED',
        message: `Merchant category ${body.mcc} not in whitelist`,
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // Check country restrictions
    if (card.blockedCountries.includes(body.merchantCountry)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'COUNTRY_BLOCKED',
        message: `Transactions from ${body.merchantCountry} are blocked`,
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    if (card.allowedCountries.length > 0 && !card.allowedCountries.includes(body.merchantCountry)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'COUNTRY_NOT_ALLOWED',
        message: `Transactions from ${body.merchantCountry} not allowed`,
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // Check spending limits
    if (card.spendingLimit && Number(card.totalSpent) + body.amount > Number(card.spendingLimit)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'SPENDING_LIMIT_EXCEEDED',
        message: 'Total spending limit exceeded',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    if (card.monthlyLimit && Number(card.monthlySpent) + body.amount > Number(card.monthlyLimit)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'MONTHLY_LIMIT_EXCEEDED',
        message: 'Monthly spending limit exceeded',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySpending = await prisma.cardTransaction.aggregate({
      where: {
        cardId: body.cardId,
        status: 'approved',
        transactionDate: {
          gte: today,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const todayTotal = Number(todaySpending._sum.amount || 0);
    if (card.dailyLimit && todayTotal + body.amount > Number(card.dailyLimit)) {
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'DAILY_LIMIT_EXCEEDED',
        message: 'Daily spending limit exceeded',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // Check wallet balance (if linked to crypto wallet)
    if (card.wallet.balanceFiat && Number(card.wallet.balanceFiat) < body.amount) {
      trackServerEvent({
        name: 'card.authorization.declined',
        properties: { cardId: body.cardId, reason: 'insufficient_funds', amount: String(body.amount), currency: body.currency },
      });
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient wallet balance',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // FRAUD DETECTION HEURISTICS
    
    // 1. Velocity check: max 5 transactions in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentTxCount = await prisma.cardTransaction.count({
      where: {
        cardId: body.cardId,
        status: 'approved',
        transactionDate: { gte: tenMinutesAgo },
      },
    });
    
    if (recentTxCount >= 5) {
      trackServerEvent({
        name: 'card.authorization.declined',
        properties: { cardId: body.cardId, reason: 'velocity_exceeded', txCount: String(recentTxCount) },
      });
      const response = CardAuthorizationResponseSchema.parse({
        approved: false,
        declineReason: 'VELOCITY_EXCEEDED',
        message: 'Too many transactions in short time',
      });
      return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
    }

    // 2. Geo-mismatch detection: check if location differs >500km from last transaction
    if (body.latitude && body.longitude) {
      const lastTx = await prisma.cardTransaction.findFirst({
        where: {
          cardId: body.cardId,
          status: 'approved',
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { transactionDate: 'desc' },
      });

      if (lastTx?.latitude && lastTx?.longitude) {
        const distance = calculateDistance(
          Number(lastTx.latitude),
          Number(lastTx.longitude),
          body.latitude,
          body.longitude
        );
        
        // Flag as anomaly if >500km from last transaction within 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (distance > 500 && lastTx.transactionDate > oneHourAgo) {
          trackServerEvent({
            name: 'card.authorization.anomaly',
            properties: { cardId: body.cardId, reason: 'geo_mismatch', distance: String(Math.round(distance)) },
          });
          // Don't decline automatically, just flag for review
        }
      }
    }

    // 3. MCC anomaly detection: unusual merchant category
    const userMccHistory = await prisma.cardTransaction.groupBy({
      by: ['mcc'],
      where: {
        userId: card.userId,
        status: 'approved',
      },
      _count: { mcc: true },
    });

    const isUnusualMcc = !userMccHistory.some((m) => m.mcc === body.mcc);
    const highRiskMccs = ['5993', '7995', '7273']; // Gambling, betting, etc.
    const isHighRiskMcc = highRiskMccs.includes(body.mcc);

    // Calculate cashback
    const cashbackRate = isHighRiskMcc ? 0 : Number(card.cashbackRate || 0.02);
    const cashbackAmount = body.amount * cashbackRate;

    // Create transaction record
    const isAnomaly = isUnusualMcc || isHighRiskMcc;
    const transaction = await prisma.cardTransaction.create({
      data: {
        cardId: body.cardId,
        userId: card.userId,
        amount: body.amount,
        currency: body.currency,
        merchantName: body.merchantName,
        merchantCity: body.merchantCity,
        merchantCountry: body.merchantCountry,
        mcc: body.mcc,
        latitude: body.latitude,
        longitude: body.longitude,
        status: 'approved',
        cashbackAmount,
        cashbackToken: process.env.CASHBACK_TOKEN || 'CELO',
        isAnomaly,
        transactionDate: new Date(),
      },
    });

    // Update card spending
    await prisma.card.update({
      where: { id: body.cardId },
      data: {
        totalSpent: {
          increment: body.amount,
        },
        monthlySpent: {
          increment: body.amount,
        },
        lastUsedAt: new Date(),
      },
    });

    // Send real-time notification
    await prisma.notification.create({
      data: {
        userId: card.userId,
        type: 'transaction',
        title: '💳 Card Transaction',
        body: `${body.merchantName}: ${body.currency} ${body.amount.toFixed(2)}`,
        channels: ['push', 'in-app'],
        priority: 'high',
        status: 'pending',
        metadata: {
          cardId: body.cardId,
          transactionId: transaction.id,
          merchantName: body.merchantName,
          amount: body.amount,
          cashback: cashbackAmount,
        },
      },
    });

    // APPROVED!
    const duration = Date.now() - startTime;
    trackServerEvent({
      name: 'card.authorization.approved',
      properties: {
        cardId: body.cardId,
        transactionId: transaction.id,
        amount: String(body.amount),
        currency: body.currency,
        merchantName: body.merchantName,
        mcc: body.mcc,
        cashbackAmount: String(cashbackAmount),
        isAnomaly: String(isAnomaly),
        duration: String(duration),
      },
    });

    // Validate response
    const validatedResponse = CardAuthorizationResponseSchema.parse({
      approved: true,
      transactionId: transaction.id,
      cashbackAmount,
      message: 'Transaction approved',
    });

    log.logSuccess({ cardId: body.cardId, transactionId: transaction.id, userId: card.userId, duration: Date.now() - startTime });

    return NextResponse.json(
      createSuccessEnvelope(validatedResponse, requestId),
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, error.message, requestId, { fields: error.fields }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    log.logError(error);
    
    trackServerException({
      exception: error instanceof Error ? error : new Error('Unknown authorization error'),
      severityLevel: 'Error',
      properties: { operation: 'authorizeTransaction' },
    });
    
    // On error, decline for safety
    const _response = CardAuthorizationResponseSchema.parse({
      approved: false,
      declineReason: 'SYSTEM_ERROR',
      message: 'Unable to process authorization',
    });
    
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Unable to process authorization', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

// Haversine formula to calculate distance between two coordinates (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

