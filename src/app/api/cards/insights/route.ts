/**
 * Card Insights & Analytics API
 * AI-powered spending insights - BETTER than Revolut!
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logError } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { CardInsightsQuerySchema, CardInsightsResponseSchema, CreateCardInsightRequestSchema, UpdateCardInsightRequestSchema, IdParamSchema } from '@/lib/validation/schemas';
import { validateQuery, validateBody, validateParams, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * GET /api/cards/insights - Get AI-powered spending insights
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards/insights', method: 'GET' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Validate query parameters
    const query = validateQuery(request, CardInsightsQuerySchema);

    // Build query
    const where: any = { userId, isDismissed: false };
    if (query.cardId) where.cardId = query.cardId;
    if (query.severity) where.severity = query.severity;

    const insights = await prisma.cardInsight.findMany({
      where,
      orderBy: [
        { severity: 'desc' }, // Critical first
        { insightDate: 'desc' },
      ],
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    });

    // Map to response format
    const insightsResponse = insights.map(insight => ({
      ...insight,
      insightDate: insight.insightDate.toISOString(),
      createdAt: insight.createdAt.toISOString(),
    }));

    // Validate response
    const validatedResponse = CardInsightsResponseSchema.parse({ insights: insightsResponse });

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
    
    logError('Failed to fetch card insights', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch card insights', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * POST /api/cards/insights - Create new insight (from AI analysis)
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/cards/insights', method: 'POST' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Validate request body
    const body = await validateBody(request, CreateCardInsightRequestSchema);

    const insight = await prisma.cardInsight.create({
      data: {
        userId,
        cardId: body.cardId || null,
        type: body.type,
        severity: body.severity,
        title: body.title,
        description: body.description,
        recommendation: body.recommendation || null,
        amount: body.amount || null,
        category: body.category || null,
        metadata: body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : undefined,
        insightDate: new Date(),
      },
    });

    return NextResponse.json(
      createSuccessEnvelope({ 
        insight: {
          ...insight,
          insightDate: insight.insightDate.toISOString(),
          createdAt: insight.createdAt.toISOString(),
        }
      }, requestId),
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, error.message, requestId, { fields: error.fields }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    logError('Failed to create insight', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create insight', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * PATCH /api/cards/insights/[id] - Mark insight as read or dismissed
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const log = createRequestLogger({ endpoint: '/api/cards/insights/[id]', method: 'PATCH' });
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
    const body = await validateBody(request, UpdateCardInsightRequestSchema);

    const insight = await prisma.cardInsight.findFirst({
      where: { id, userId },
    });

    if (!insight) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Insight not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const updated = await prisma.cardInsight.update({
      where: { id },
      data: {
        isRead: body.isRead ?? insight.isRead,
        isDismissed: body.isDismissed ?? insight.isDismissed,
      },
    });

    return NextResponse.json(
      createSuccessEnvelope({ 
        insight: {
          ...updated,
          insightDate: updated.insightDate.toISOString(),
          createdAt: updated.createdAt.toISOString(),
        }
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
    
    logError('Failed to update insight', error);
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update insight', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

