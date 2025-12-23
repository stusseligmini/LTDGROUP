/**
 * Helius Enhanced API Integration
 * Provides enriched transaction history with labels and metadata
 * Perfect for gambling wallets - shows casino deposits/withdrawals clearly
 */

import axios from 'axios';

// Use devnet for testing
const HELIUS_API_URL = 'https://api-devnet.helius-rpc.com/v0';
// Server-side only: never expose to client
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signatureInfo?: {
    err?: any;
    memo?: string;
    slot?: number;
  };
  nativeTransfers?: Array<{
    amount: number;
    fromUserAccount: string;
    toUserAccount: string;
  }>;
  tokenTransfers?: Array<{
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
    tokenSymbol?: string;
  }>;
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges?: Array<{
      mint: string;
      tokenAmount: number;
      tokenSymbol?: string;
    }>;
  }>;
  events?: {
    nft?: any;
    swap?: any;
    compressed?: any;
    [key: string]: any;
  };
}

export interface HeliusTransactionHistoryParams {
  address: string;
  before?: string; // Signature to fetch transactions before
  until?: string; // Signature to fetch transactions until
  limit?: number; // Number of transactions to fetch (max 1000)
  type?: string; // Filter by type: 'TRANSFER', 'SWAP', 'NFT_SALE', etc.
  commitment?: 'finalized' | 'confirmed' | 'processed';
}

/**
 * Get enriched transaction history from Helius
 * Shows casino deposits/withdrawals with labels
 */
export async function getHeliusTransactionHistory(
  params: HeliusTransactionHistoryParams
): Promise<HeliusTransaction[]> {
  if (!HELIUS_API_KEY) {
    throw new Error('Helius API key not configured. Set HELIUS_API_KEY or NEXT_PUBLIC_HELIUS_API_KEY');
  }

  try {
    // Use GET request with query params for devnet Enhanced API
    const url = `${HELIUS_API_URL}/addresses/${params.address}/transactions?api-key=${HELIUS_API_KEY}`;
    
    const response = await axios.get(url, {
      params: {
        before: params.before,
        until: params.until,
        limit: params.limit || 100,
        type: params.type,
        commitment: params.commitment || 'confirmed',
      }
    });

    return response.data || [];
  } catch (error) {
    console.error('Error fetching Helius transaction history', error);
    throw error;
  }
}

/**
 * Get parsed transaction from Helius
 * Provides enriched metadata and labels
 */
export async function getHeliusTransaction(signature: string): Promise<HeliusTransaction | null> {
  if (!HELIUS_API_KEY) {
    throw new Error('Helius API key not configured');
  }

  try {
    const url = `${HELIUS_API_URL}/transactions?api-key=${HELIUS_API_KEY}`;
    
    const response = await axios.get(url, {
      params: {
        transactions: signature,
      }
    });

    return response.data?.[0] || null;
  } catch (error) {
    console.error('Error fetching Helius transaction', error);
    return null;
  }
}

/**
 * Parse transaction for gambling context
 * Identifies casino deposits, withdrawals, wins, losses
 */
export function parseGamblingTransaction(tx: HeliusTransaction, userAddress: string): {
  type: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'transfer' | 'unknown';
  amount: number;
  counterparty: string | null;
  label: string;
  isCasinoTx: boolean;
} {
  // Known casino addresses (update this list)
  const CASINO_ADDRESSES: string[] = [
    // Add known casino deposit addresses here
    // 'Roobet...',
    // 'Stake...',
    // 'Rollbit...',
  ];

  // Check if transaction is to/from casino
  const nativeTransfers = tx.nativeTransfers || [];
  const isOutgoing = nativeTransfers.some(t => 
    t.fromUserAccount.toLowerCase() === userAddress.toLowerCase()
  );
  const isIncoming = nativeTransfers.some(t => 
    t.toUserAccount.toLowerCase() === userAddress.toLowerCase()
  );

  // Find counterparty
  const counterpartyTransfer = isOutgoing
    ? nativeTransfers.find(t => t.fromUserAccount.toLowerCase() === userAddress.toLowerCase())
    : nativeTransfers.find(t => t.toUserAccount.toLowerCase() === userAddress.toLowerCase());

  const counterparty = counterpartyTransfer
    ? (isOutgoing ? counterpartyTransfer.toUserAccount : counterpartyTransfer.fromUserAccount)
    : null;

  const amount = counterpartyTransfer ? Math.abs(counterpartyTransfer.amount) / 1e9 : 0; // Convert lamports to SOL
  const isCasinoTx = counterparty ? CASINO_ADDRESSES.includes(counterparty) : false;

  // Determine transaction type
  let type: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'transfer' | 'unknown' = 'unknown';
  let label = 'Transfer';

  if (isCasinoTx) {
    if (isOutgoing) {
      type = 'deposit';
      label = `Deposit to ${tx.source || 'Casino'}`;
    } else if (isIncoming) {
      // Incoming from casino = win
      type = 'win';
      label = `Win from ${tx.source || 'Casino'}`;
    }
  } else {
    if (isOutgoing) {
      type = 'withdrawal';
      label = 'Withdrawal';
    } else if (isIncoming) {
      type = 'transfer';
      label = 'Received';
    }
  }

  return {
    type,
    amount,
    counterparty,
    label,
    isCasinoTx,
  };
}

