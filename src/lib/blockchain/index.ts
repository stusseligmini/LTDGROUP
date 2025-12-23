/**
 * Unified Blockchain Client
 * Routes to appropriate blockchain client based on chain
 */

import { ethereumClient } from './ethereum';
import { celoClient } from './celo';
import { polygonClient } from './polygon';
import { arbitrumClient } from './arbitrum';
import { optimismClient } from './optimism';
import { bitcoinClient } from './bitcoin';
import { solanaClient } from './solana';
import { EthereumClient } from './ethereum';
import { BitcoinClient } from './bitcoin';
import { SolanaClient } from './solana';
import { decrypt } from '../security/encryption';
import { logger } from '../logger';

export type Blockchain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'celo' | 'bitcoin' | 'solana';

export interface BlockchainTransactionResult {
  txHash: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export class BlockchainService {
  /**
   * Get blockchain client for a specific chain
   */
  private getClient(blockchain: Blockchain): EthereumClient | BitcoinClient | SolanaClient {
    switch (blockchain.toLowerCase()) {
      case 'ethereum':
        return ethereumClient;
      case 'polygon':
        return polygonClient;
      case 'arbitrum':
        return arbitrumClient;
      case 'optimism':
        return optimismClient;
      case 'celo':
        return celoClient;
      case 'bitcoin':
        return bitcoinClient;
      case 'solana':
        return solanaClient;
      default:
        throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
  }

  /**
   * Get balance for an address
   */
  async getBalance(blockchain: Blockchain, address: string): Promise<string> {
    const client = this.getClient(blockchain);
    
    if (client instanceof EthereumClient || client instanceof SolanaClient) {
      return await client.getBalance(address);
    } else if (client instanceof BitcoinClient) {
      return await client.getBalance(address);
    }
    
    throw new Error(`Balance retrieval not implemented for ${blockchain}`);
  }

  /**
   * Send transaction on blockchain
   */
  async sendTransaction(
    blockchain: Blockchain,
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKeyOrEncrypted: string,
    options?: any
  ): Promise<BlockchainTransactionResult> {
    try {
      // Decrypt private key if it's encrypted (starts with hex:iv:authTag format)
      let privateKey: string;
      if (privateKeyOrEncrypted.includes(':')) {
        // Assume it's encrypted
        privateKey = decrypt(privateKeyOrEncrypted);
      } else {
        // Assume it's already decrypted (for hardware wallets, etc.)
        privateKey = privateKeyOrEncrypted;
      }
      
      const client = this.getClient(blockchain);
      
      if (client instanceof EthereumClient) {
        const result = await client.sendTransaction(
          fromAddress,
          toAddress,
          amount,
          privateKey,
          options
        );
        
        return {
          txHash: result.txHash,
          blockNumber: result.blockNumber,
          status: result.blockNumber ? 'confirmed' : 'pending',
        };
      } else if (client instanceof BitcoinClient) {
        const result = await client.sendTransaction(
          fromAddress,
          toAddress,
          amount,
          privateKey,
          options?.feeRate
        );
        
        return {
          txHash: result.txHash,
          status: 'pending',
        };
      } else if (client instanceof SolanaClient) {
        // Convert hex private key to Uint8Array for Solana
        const privateKeyBytes = new Uint8Array(
          Buffer.from(privateKey.replace('0x', ''), 'hex')
        );
        
        const result = await client.sendTransaction(
          fromAddress,
          toAddress,
          amount,
          privateKeyBytes
        );
        
        return {
          txHash: result.txHash,
          blockNumber: result.slot,
          status: 'pending',
        };
      }
      
      throw new Error(`Transaction sending not implemented for ${blockchain}`);
    } catch (error) {
      logger.error('Failed to send blockchain transaction', error, {
        blockchain,
        fromAddress,
        toAddress,
        amount,
      });
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(
    blockchain: Blockchain,
    txHash: string
  ): Promise<{
    status: 'success' | 'failed' | 'pending';
    confirmations: number;
    blockNumber?: number;
  } | null> {
    const client = this.getClient(blockchain);
    
    if (client instanceof EthereumClient) {
      const receipt = await client.getTransactionReceipt(txHash);
      if (!receipt) return null;
      
      return {
        status: receipt.status,
        confirmations: receipt.confirmations,
        blockNumber: receipt.blockNumber,
      };
    } else if (client instanceof BitcoinClient) {
      const tx = await client.getTransaction(txHash);
      if (!tx) return null;
      
      return {
        status: tx.status === 'confirmed' ? 'success' : 'pending',
        confirmations: tx.confirmations,
        blockNumber: tx.blockNumber,
      };
    } else if (client instanceof SolanaClient) {
      const tx = await client.getTransaction(txHash);
      if (!tx) return null;
      
      return {
        status: tx.status === 'success' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending',
        confirmations: tx.confirmations || 0,
        blockNumber: tx.slot,
      };
    }
    
    return null;
  }

  /**
   * Get health status for all blockchains
   */
  getHealthStatus(): Record<Blockchain, { healthy: boolean; currentProvider: string }> {
    return {
      ethereum: ethereumClient.getHealthStatus(),
      polygon: polygonClient.getHealthStatus(),
      arbitrum: arbitrumClient.getHealthStatus(),
      optimism: optimismClient.getHealthStatus(),
      celo: celoClient.getHealthStatus(),
      bitcoin: bitcoinClient.getHealthStatus(),
      solana: solanaClient.getHealthStatus(),
    };
  }
}

export const blockchainService = new BlockchainService();

