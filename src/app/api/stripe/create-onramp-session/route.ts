/**
 * API Route: Create Stripe Crypto On-Ramp Session
 * Server-side only - protects secret key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createStripeOnRampSession } from '@/lib/fiat/stripe';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function POST(req: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/stripe/create-onramp-session', method: 'POST'});
  const {requestId} = log;
  
  try {
    const body = await req.json();
    const { walletAddress, destinationNetwork, destinationCurrency, sourceAmount, sourceCurrency } = body;

    if (!walletAddress || !destinationNetwork || !destinationCurrency) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Missing required fields: walletAddress, destinationNetwork, destinationCurrency',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Stripe not configured',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
      );
    }

    const session = await createStripeOnRampSession(
      {
        walletAddress,
        destinationNetwork,
        destinationCurrency,
        sourceAmount,
        sourceCurrency: sourceCurrency || 'usd',
      },
      secretKey
    );

    return NextResponse.json(
      createSuccessEnvelope(session, requestId),
      { status: 201 }
    );
  } catch (error) {
    logger.error('[Stripe On-Ramp] Session creation failed', { error, requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create session',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

