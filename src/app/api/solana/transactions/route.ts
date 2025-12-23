import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import { addTransaction, getWalletTransactions } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * GET /api/solana/transactions - Get transaction history for a wallet
 * 
 * Syncs transactions to:
 * - Firestore (real-time sync for extension/telegram)
 * - PostgreSQL (persistent storage)
 * 
 * Uses Helius Enhanced Transactions API for blockchain data
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '50');
    const _before = searchParams.get('before'); // Transaction signature for pagination

    if (!address) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Address is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify user owns this wallet
    const wallet = await prisma.wallet.findFirst({
      where: { 
        address, 
        userId, 
        blockchain: 'solana' 
      },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'Wallet not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Fetch from Helius Enhanced API
    const heliusApiKey = process.env.HELIUS_API_KEY;
    const url = `https://api-devnet.helius-rpc.com/v0/addresses/${address}/transactions/?api-key=${heliusApiKey}`;
    
    const heliusResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!heliusResponse.ok) {
      throw new Error(`Helius API error: ${heliusResponse.statusText}`);
    }

    const heliusData = await heliusResponse.json();

    // Transform Helius data to our format
    const transactions = heliusData.map((tx: any) => {
      // Determine transaction type based on native transfers
      const nativeTransfers = tx.nativeTransfers || [];
      const isSent = nativeTransfers.some((t: any) => 
        t.fromUserAccount === address
      );
      const isReceived = nativeTransfers.some((t: any) => 
        t.toUserAccount === address
      );

      // Calculate amount (sum of all transfers involving this address)
      const amount = nativeTransfers
        .filter((t: any) => 
          t.fromUserAccount === address || t.toUserAccount === address
        )
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) / 1e9; // Convert lamports to SOL

      // Get counterparty address
      const counterparty = isSent
        ? nativeTransfers.find((t: any) => t.fromUserAccount === address)?.toUserAccount
        : nativeTransfers.find((t: any) => t.toUserAccount === address)?.fromUserAccount;

      return {
        signature: tx.signature,
        timestamp: tx.timestamp,
        type: isSent ? 'sent' : isReceived ? 'received' : 'unknown',
        amount: amount.toString(),
        amountSOL: amount,
        status: tx.confirmationStatus === 'finalized' ? 'confirmed' : 'pending',
        fee: (tx.fee || 0) / 1e9, // Convert lamports to SOL
        from: isSent ? address : counterparty,
        to: isSent ? counterparty : address,
        slot: tx.slot,
        memo: tx.description || null,
        nativeTransfers: tx.nativeTransfers?.length || 0,
        tokenTransfers: tx.tokenTransfers?.length || 0,
        error: tx.err ? 'Failed' : null,
      };
    }).slice(0, limit);

    // Sync transactions to Firestore and PostgreSQL
    for (const tx of transactions) {
      try {
        // Log to Firestore for real-time sync
        await addTransaction(userId, {
          walletId: wallet.id,
          txHash: tx.signature,
          blockchain: 'solana',
          fromAddress: tx.from,
          toAddress: tx.to,
          amount: tx.amount,
          tokenSymbol: 'SOL',
          status: tx.status as 'pending' | 'confirmed' | 'failed',
          timestamp: Timestamp.fromMillis(tx.timestamp * 1000),
          memo: tx.memo || undefined,
        });

        // Also store in PostgreSQL for persistence
        try {
          await prisma.transaction.upsert({
            where: { txHash: tx.signature },
            update: { status: tx.status as any },
            create: {
              walletId: wallet.id,
              txHash: tx.signature,
              blockchain: 'solana',
              blockNumber: BigInt(tx.slot || 0),
              fromAddress: tx.from,
              toAddress: tx.to,
              amount: tx.amount,
              tokenSymbol: 'SOL',
              gasFee: tx.fee?.toString(),
              status: tx.status as 'pending' | 'confirmed' | 'failed',
              confirmations: tx.status === 'confirmed' ? 1 : 0,
              timestamp: new Date(tx.timestamp * 1000),
              memo: tx.memo,
            },
          });
        } catch (_dbError) {
          logger.warn('Could not store transaction in PostgreSQL', { 
            walletId: wallet.id, 
            txHash: tx.signature,
            requestId,
          });
        }
      } catch (_firestoreError) {
        logger.warn('Could not sync transaction to Firestore', { 
          walletId: wallet.id, 
          txHash: tx.signature,
          requestId,
        });
      }
    }

    logger.info('Fetched transaction history', {
      userId,
      address,
      count: transactions.length,
      requestId,
    });

    return NextResponse.json(
      createSuccessEnvelope({ transactions, address }, requestId),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error fetching transaction history', error instanceof Error ? error : undefined, { requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch transactions', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

