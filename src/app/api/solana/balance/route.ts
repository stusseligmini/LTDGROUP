import { NextRequest, NextResponse } from 'next/server';
import { getSolanaBalance, getSolanaConnection } from '@/lib/solana/solanaWallet';
import { logger } from '@/lib/logger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

/**
 * GET /api/solana/balance - Get Solana balance
 * 
 * NON-CUSTODIAL: Only queries public blockchain data
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Address is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Validate Solana address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid Solana address', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Get balance from blockchain
    const connection = getSolanaConnection();
    const balance = await getSolanaBalance(address, connection);

    return NextResponse.json(
      createSuccessEnvelope({
        address,
        balance: balance.toString(),
        balanceSOL: balance,
        balanceLamports: Math.floor(balance * 1e9),
        currency: 'SOL',
      }, requestId),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error fetching Solana balance', { error, requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch balance', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}


