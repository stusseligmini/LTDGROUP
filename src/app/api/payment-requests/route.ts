import { NextRequest, NextResponse } from 'next/server';
import paymentRequestService from '@/server/services/paymentRequestService';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PaymentRequestListQuerySchema, PaymentRequestsResponseSchema, CreatePaymentRequestSchema, PaymentRequestResponseSchema } from '@/lib/validation/schemas';
import { validateQuery, validateBody, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/payment-requests', method: 'GET'});
  const {requestId} = log;
  
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

    // Validate query parameters
    const _query = validateQuery(request, PaymentRequestListQuerySchema);

    const requests = await paymentRequestService.getPendingRequests(userId);
    
    // Validate response
    const validatedResponse = PaymentRequestsResponseSchema.parse({ requests });

    return NextResponse.json(
      createSuccessEnvelope(validatedResponse, requestId),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Validation error',
          requestId,
          { fields: error.fields }
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    logger.error('Error fetching payment requests', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to fetch payment requests',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/payment-requests', method: 'POST'});
  const {requestId} = log;
  
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

    // Validate request body
    const body = await validateBody(request, CreatePaymentRequestSchema);

    const paymentRequest = await paymentRequestService.createPaymentRequest(
      userId,
      body.receiverId,
      body.amount,
      body.blockchain,
      body.memo,
      body.tokenSymbol
    );

    // Validate response
    const validatedResponse = PaymentRequestResponseSchema.parse(paymentRequest);

    return NextResponse.json(
      createSuccessEnvelope({ request: validatedResponse }, requestId),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Validation error',
          requestId,
          { fields: error.fields }
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    logger.error('Error creating payment request', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create payment request',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}



