import { NextRequest, NextResponse } from 'next/server';
import stakingService from '@/server/services/stakingService';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { StakingPositionsResponseSchema, StakeRequestSchema, StakeResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/staking', method: 'GET' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const positions = await stakingService.getStakingPositions(userId);
    
    // Validate response
    const validatedResponse = StakingPositionsResponseSchema.parse({ positions });

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
    
    logger.error('Error fetching staking positions', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch staking positions', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/staking', method: 'POST' });
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
    const body = await validateBody(request, StakeRequestSchema);

    let txHash: string;

    switch (body.blockchain) {
      case 'solana': {
        // Convert hex private key to Uint8Array
        const solanaKey = new Uint8Array(Buffer.from(body.privateKey.replace('0x', ''), 'hex'));
        txHash = await stakingService.stakeSolana(userId, body.walletId, body.amount, body.validatorAddress || '', solanaKey);
        break;
      }
      case 'ethereum':
        txHash = await stakingService.stakeEthereum(userId, body.walletId, body.amount, body.privateKey);
        break;
      case 'celo':
        txHash = await stakingService.stakeCelo(userId, body.walletId, body.amount, body.privateKey);
        break;
      default:
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Unsupported blockchain', requestId),
          { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
        );
    }

    // Validate response
    const validatedResponse = StakeResponseSchema.parse({ success: true, txHash });

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
    
    logger.error('Error staking', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to stake', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}


