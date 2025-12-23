import { NextRequest, NextResponse } from 'next/server';
import contactService from '@/server/services/contactService';
import { logger } from '@/lib/logger';
import { ResolveContactRequestSchema, ResolvedContactResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/contacts/resolve', method: 'POST'});
  const {requestId} = log;
  
  try {
    // Validate request body
    const body = await validateBody(request, ResolveContactRequestSchema);

    let resolved = null;

    if (body.type === 'username') {
      resolved = await contactService.resolveUsername(body.value);
    } else if (body.type === 'phone') {
      resolved = await contactService.resolvePhone(body.value);
    }

    if (!resolved) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.NOT_FOUND,
          'Contact not found',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Validate response
    const validatedResponse = ResolvedContactResponseSchema.parse(resolved);

    return NextResponse.json(
      createSuccessEnvelope({ resolved: validatedResponse }, requestId),
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
    
    logger.error('Error resolving contact', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to resolve contact',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}



