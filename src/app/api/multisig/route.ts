import { NextRequest, NextResponse } from 'next/server';
import multisigService from '@/server/services/multisigService';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { CreateMultiSigWalletRequestSchema, MultiSigWalletResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/multisig', method: 'POST'});
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
    const body = await validateBody(request, CreateMultiSigWalletRequestSchema);

    const wallet = await multisigService.createMultiSigWallet(
      userId,
      body.blockchain,
      body.requiredSignatures,
      body.signers
    );

    // Validate response
    const validatedResponse = MultiSigWalletResponseSchema.parse(wallet);

    return NextResponse.json(
      createSuccessEnvelope({ wallet: validatedResponse }, requestId),
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
    
    logger.error('Error creating multi-sig wallet', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create multi-sig wallet',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}



