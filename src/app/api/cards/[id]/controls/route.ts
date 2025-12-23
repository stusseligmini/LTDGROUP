/**
 * Advanced Card Controls API
 * BETTER than Revolut: MCC filtering, location controls, disposable cards, cashback
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logError } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { CardControlsUpdateSchema, CardControlsMCCActionSchema, CardControlsResponseSchema, IdParamSchema } from '@/lib/validation/schemas';
import { validateBody, validateParams, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/cards/[id]/controls - Update advanced card controls
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const log = createRequestLogger({ endpoint: '/api/cards/[id]/controls', method: 'PATCH' });
  const { requestId } = log;
  
  try {
    const params = await context.params;
    const { id } = validateParams(params, IdParamSchema);
    
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Validate request body
    const body = await validateBody(request, CardControlsUpdateSchema);

    // Verify card ownership
    const card = await prisma.card.findFirst({
      where: { id, userId },
    });

    if (!card) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Update controls
    const updatedCard = await prisma.card.update({
      where: { id },
      data: body,
    });

    // Validate response
    const validatedResponse = CardControlsResponseSchema.parse({
      controls: {
        allowedMCC: updatedCard.allowedMCC,
        blockedMCC: updatedCard.blockedMCC,
        allowedCountries: updatedCard.allowedCountries,
        blockedCountries: updatedCard.blockedCountries,
        cashbackRate: updatedCard.cashbackRate ? Number(updatedCard.cashbackRate) : 0.02,
        isOnline: updatedCard.isOnline,
        isContactless: updatedCard.isContactless,
        isATM: updatedCard.isATM,
      },
    });

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
    
    logError('Failed to update card controls', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update card controls', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * GET /api/cards/[id]/controls - Get current card controls
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const log = createRequestLogger({ endpoint: '/api/cards/[id]/controls', method: 'GET' });
  const { requestId } = log;
  
  try {
    const params = await context.params;
    const { id } = validateParams(params, IdParamSchema);
    
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const card = await prisma.card.findFirst({
      where: { id, userId },
      select: {
        allowedMCC: true,
        blockedMCC: true,
        allowedCountries: true,
        blockedCountries: true,
        cashbackRate: true,
        isOnline: true,
        isContactless: true,
        isATM: true,
        isDisposable: true,
        autoFreezeRules: true,
      },
    });

    if (!card) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Validate response
    const validatedResponse = CardControlsResponseSchema.parse({
      controls: {
        allowedMCC: card.allowedMCC,
        blockedMCC: card.blockedMCC,
        allowedCountries: card.allowedCountries,
        blockedCountries: card.blockedCountries,
        cashbackRate: card.cashbackRate ? Number(card.cashbackRate) : 0.02,
        isOnline: card.isOnline,
        isContactless: card.isContactless,
        isATM: card.isATM,
        isDisposable: card.isDisposable,
        autoFreezeRules: card.autoFreezeRules,
      },
    });

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
    
    logError('Failed to fetch card controls', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch card controls', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * POST /api/cards/[id]/controls/block-mcc - Quick block merchant category
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const log = createRequestLogger({ endpoint: '/api/cards/[id]/controls/block-mcc', method: 'POST' });
  const { requestId } = log;
  
  try {
    const params = await context.params;
    const { id } = validateParams(params, IdParamSchema);
    
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Validate request body
    const body = await validateBody(request, CardControlsMCCActionSchema);

    const card = await prisma.card.findFirst({
      where: { id, userId },
    });

    if (!card) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Card not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Update MCC lists
    const updateData: any = {};
    
    if (body.action === 'block') {
      const newBlockedMCC = [...new Set([...card.blockedMCC, ...body.mccCodes])];
      updateData.blockedMCC = newBlockedMCC;
    } else if (body.action === 'allow') {
      const newAllowedMCC = [...new Set([...card.allowedMCC, ...body.mccCodes])];
      updateData.allowedMCC = newAllowedMCC;
    }

    const updatedCard = await prisma.card.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      createSuccessEnvelope({
        blockedMCC: updatedCard.blockedMCC,
        allowedMCC: updatedCard.allowedMCC,
      }, requestId),
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, error.message, requestId, { fields: error.fields }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    logError('Failed to update MCC controls', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update MCC controls', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}
