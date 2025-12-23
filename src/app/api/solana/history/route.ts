import { NextRequest, NextResponse } from 'next/server';
import { getHeliusTransactionHistory, parseGamblingTransaction } from '@/lib/solana/heliusApi';
import { logger } from '@/lib/logger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const allowedOrigins = new Set(
  [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_EXTENSION_ORIGIN]
    .filter((value): value is string => Boolean(value))
);

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  
  if (origin && allowedOrigins.has(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  } else if (allowedOrigins.size === 0) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Headers', 'authorization, content-type, x-user-id');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

  return response;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, request);
}

/**
 * GET /api/solana/history - Get enriched transaction history from Helius
 * 
 * NON-CUSTODIAL: Only queries public blockchain data via Helius Enhanced API
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '100');
    const before = searchParams.get('before') || undefined;
    const type = searchParams.get('type') || undefined;

    if (!address) {
      const errorResp = NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Address is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
      return withCors(errorResp, request);
    }

    // Validate Solana address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      const errorResp = NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid Solana address', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
      return withCors(errorResp, request);
    }

    // Get transaction history from Helius
    const transactions = await getHeliusTransactionHistory({
      address,
      limit: Math.min(limit, 1000), // Max 1000
      before,
      type,
      commitment: 'confirmed',
    });

    // Parse transactions for gambling context
    const parsedTransactions = transactions.map(tx => {
      const parsed = parseGamblingTransaction(tx, address);
      return {
        signature: tx.signature,
        timestamp: tx.timestamp * 1000, // Convert to milliseconds
        type: parsed.type,
        label: parsed.label,
        amount: parsed.amount,
        counterparty: parsed.counterparty,
        isCasinoTx: parsed.isCasinoTx,
        source: tx.source,
        fee: tx.fee / 1e9, // Convert lamports to SOL
        nativeTransfers: tx.nativeTransfers?.map(t => ({
          from: t.fromUserAccount,
          to: t.toUserAccount,
          amount: t.amount / 1e9,
        })),
        tokenTransfers: tx.tokenTransfers?.map(t => ({
          from: t.fromTokenAccount,
          to: t.toTokenAccount,
          amount: t.tokenAmount,
          mint: t.mint,
          symbol: t.tokenSymbol,
        })),
      };
    });

    const response = NextResponse.json(
      createSuccessEnvelope({
        address,
        transactions: parsedTransactions,
        count: parsedTransactions.length,
      }, requestId),
      { status: 200 }
    );

    return withCors(response, request);
  } catch (error) {
    logger.error('Error fetching Solana transaction history', { error, requestId });
    const errorResp = NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch transaction history', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
    return withCors(errorResp, request);
  }
}


