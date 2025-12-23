import { NextRequest, NextResponse } from 'next/server';
import swapService from '@/server/services/swapService';
import { logger } from '@/lib/logger';
import { SwapQuoteRequestSchema, SwapQuoteResponseSchema } from '@/lib/validation/schemas';
import { validateBody, ValidationError } from '@/lib/validation/validate';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/swap/quote', method: 'POST'});
  const {requestId} = log;
  
  try {
    // Validate request body
    const body = await validateBody(request, SwapQuoteRequestSchema);

    let quote;

    if (body.blockchain === 'solana') {
      quote = await swapService.getJupiterQuote(body.fromToken, body.toToken, body.amount);
    } else {
      // EVM chains - use 1inch
      const chainIdMap: Record<string, number> = {
        ethereum: 1,
        polygon: 137,
        arbitrum: 42161,
        optimism: 10,
        celo: 42220,
      };

      const chainId = chainIdMap[body.blockchain];
      if (!chainId) {
        return NextResponse.json(
          createErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            'Unsupported blockchain',
            requestId
          ),
          { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }

      quote = await swapService.get1InchQuote(chainId, body.fromToken, body.toToken, body.amount);
    }

    // Validate response
    const validatedQuote = SwapQuoteResponseSchema.parse(quote);

    return NextResponse.json(
      createSuccessEnvelope({ quote: validatedQuote }, requestId),
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
    
    logger.error('Error getting swap quote', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to get quote',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}



