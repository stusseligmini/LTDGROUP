/**
 * Unified Transaction Service
 * Multi-chain transaction broadcasting and monitoring
 */

import { prisma } from '@/server/db/client';
import { blockchainService, Blockchain } from '../../lib/blockchain';
import { decrypt } from '../../lib/security/encryption';
import { logger } from '../../lib/logger';

export interface TransactionRequest {
  userId: string;
  walletId: string;
  blockchain: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  memo?: string;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export { checkDailyLimit } from './dailyLimit';

/**
 * Validate transaction request
 */
export function validateTransaction(request: TransactionRequest): { valid: boolean; error?: string } {
  // Validate addresses based on blockchain
  switch (request.blockchain.toLowerCase()) {
    case 'ethereum':
    case 'celo':
      if (!/^0x[a-fA-F0-9]{40}$/.test(request.toAddress)) {
        return { valid: false, error: 'Invalid Ethereum address' };
      }
      break;
    case 'bitcoin':
      if (!/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(request.toAddress) &&
          !/^bc1[a-z0-9]{39,87}$/.test(request.toAddress)) {
        return { valid: false, error: 'Invalid Bitcoin address' };
      }
      break;
    case 'solana':
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(request.toAddress)) {
        return { valid: false, error: 'Invalid Solana address' };
      }
      break;
  }
  
  // Validate amount
  const numAmount = parseFloat(request.amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }
  
  return { valid: true };
}

/**
 * Broadcast signed transaction (Non-Custodial)
 * Transaction must be signed client-side before calling this method
 */
export async function broadcastSignedTransaction(
  request: TransactionRequest & { signedTransaction: string }
): Promise<TransactionResult> {
  try {
    // Validate transaction
    const validation = validateTransaction(request);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }
    
    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: request.walletId,
        userId: request.userId,
        blockchain: request.blockchain.toLowerCase(),
      },
    });
    
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found or unauthorized',
      };
    }
    
    // Verify address matches wallet
    if (wallet.address.toLowerCase() !== request.fromAddress.toLowerCase()) {
      return {
        success: false,
        error: 'From address does not match wallet address',
      };
    }
    
    const blockchain = request.blockchain.toLowerCase() as Blockchain;
    
    logger.info('Broadcasting signed transaction', {
      blockchain,
      from: request.fromAddress,
      to: request.toAddress,
      amount: request.amount,
      walletId: request.walletId,
    });
    
    // Broadcast signed transaction directly to blockchain
    let txHash: string;
    let status: 'pending' | 'confirmed' | 'failed' = 'pending';
    let blockNumber: number | undefined;
    
    if (blockchain === 'solana') {
      // Solana: Broadcast base64 signed transaction
      const { Connection, VersionedTransaction } = await import('@solana/web3.js');
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );
      
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(request.signedTransaction, 'base64')
      );
      
      txHash = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      const confirmation = await connection.confirmTransaction(txHash, 'confirmed');
      status = confirmation.value.err ? 'failed' : 'confirmed';
    } else {
      // EVM chains: Broadcast hex signed transaction
      const { ethers } = await import('ethers');
      const { ethereumClient } = await import('@/lib/blockchain/ethereum');
      const provider = await ethereumClient['getHealthyProvider']();
      
      const txResponse = await provider.broadcastTransaction(request.signedTransaction);
      txHash = txResponse.hash;
      
      const receipt = await txResponse.wait(1);
      if (receipt) {
        status = receipt.status === 1 ? 'confirmed' : 'failed';
        blockNumber = receipt.blockNumber;
      }
    }
    
    const result = {
      txHash,
      status,
      blockNumber,
    };
    
    // Store transaction in database
    await prisma.transaction.create({
      data: {
        walletId: request.walletId,
        txHash: result.txHash,
        blockchain: request.blockchain.toLowerCase(),
        blockNumber: result.blockNumber ? BigInt(result.blockNumber) : null,
        fromAddress: request.fromAddress,
        toAddress: request.toAddress,
        amount: request.amount,
        tokenSymbol: request.tokenSymbol,
        tokenAddress: request.tokenAddress,
        status: result.status,
        confirmations: result.status === 'confirmed' ? 1 : 0,
        type: 'send',
        memo: request.memo,
        timestamp: new Date(),
      },
    });
    
    // Log transaction
    await prisma.auditLog.create({
      data: {
        userId: request.userId,
        action: 'transaction_sent',
        resource: 'transaction',
        resourceId: result.txHash,
        platform: 'api',
        status: 'success',
        metadata: {
          blockchain: request.blockchain,
          amount: request.amount,
          to: request.toAddress,
          txHash: result.txHash,
          blockNumber: result.blockNumber,
        },
      },
    });
    
    logger.info('Transaction broadcast successfully', {
      txHash: result.txHash,
      blockchain,
      status: result.status,
    });
    
    return {
      success: true,
      txHash: result.txHash,
    };
    
  } catch (error) {
    logger.error('Error broadcasting transaction', error, {
      blockchain: request.blockchain,
      from: request.fromAddress,
      to: request.toAddress,
      amount: request.amount,
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get transaction status from blockchain
 */
export async function getTransactionStatus(txHash: string): Promise<{
  status: string;
  confirmations: number;
  blockNumber?: bigint;
} | null> {
  // First check database
  const transaction = await prisma.transaction.findUnique({
    where: { txHash },
    select: {
      status: true,
      confirmations: true,
      blockNumber: true,
      blockchain: true,
    },
  });
  
  if (!transaction) return null;
  
  // Query blockchain for latest status
  try {
    const blockchain = transaction.blockchain as Blockchain;
    const blockchainStatus = await blockchainService.getTransactionStatus(blockchain, txHash);
    
    if (blockchainStatus) {
      // Update database if status changed
      if (blockchainStatus.status !== transaction.status || 
          blockchainStatus.confirmations !== transaction.confirmations) {
        await prisma.transaction.update({
          where: { txHash },
          data: {
            status: blockchainStatus.status === 'success' ? 'confirmed' : 
                   blockchainStatus.status === 'failed' ? 'failed' : 'pending',
            confirmations: blockchainStatus.confirmations,
            blockNumber: blockchainStatus.blockNumber ? BigInt(blockchainStatus.blockNumber) : transaction.blockNumber,
            updatedAt: new Date(),
          },
        });
      }
      
      return {
        status: blockchainStatus.status === 'success' ? 'confirmed' : 
               blockchainStatus.status === 'failed' ? 'failed' : 'pending',
        confirmations: blockchainStatus.confirmations,
        blockNumber: blockchainStatus.blockNumber ? BigInt(blockchainStatus.blockNumber) : (transaction.blockNumber ?? undefined),
      };
    }
  } catch (error) {
    logger.warn('Failed to get transaction status from blockchain', error as any);
    // Return database status as fallback
  }
  
  return {
    status: transaction.status,
    confirmations: transaction.confirmations,
    blockNumber: transaction.blockNumber || undefined,
  };
}

/**
 * Update transaction status (called by monitoring service)
 */
export async function updateTransactionStatus(
  txHash: string,
  status: string,
  confirmations: number,
  blockNumber?: bigint
): Promise<void> {
  await prisma.transaction.update({
    where: { txHash },
    data: {
      status,
      confirmations,
      blockNumber,
      updatedAt: new Date(),
    },
  });
}

