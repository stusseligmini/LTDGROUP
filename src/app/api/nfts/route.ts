import { NextRequest, NextResponse } from 'next/server';
import nftService from '@/server/services/nftService';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { NFTListQuerySchema, NFTsResponseSchema, SyncNFTsRequestSchema } from '@/lib/validation/schemas';
import { validateQuery, validateBody, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/nfts', method: 'GET'});
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
    const query = validateQuery(request, NFTListQuerySchema);

    const nfts = await nftService.getNFTsFromDatabase(
      userId,
      query.walletId
    );

    // Validate response
    const validatedResponse = NFTsResponseSchema.parse({ nfts });

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
    
    logger.error('Error fetching NFTs', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to fetch NFTs',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/nfts', method: 'POST'});
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
    const body = await validateBody(request, SyncNFTsRequestSchema);

    await nftService.syncNFTsToDatabase(userId, body.walletId, body.blockchain, body.address);

    return NextResponse.json(
      createSuccessEnvelope({ success: true }, requestId),
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
    
    logger.error('Error syncing NFTs', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to sync NFTs',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}


