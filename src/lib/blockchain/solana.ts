/**
 * Solana Blockchain Client
 * Uses @solana/web3.js for transaction building and signing
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { logger } from '../logger';

export interface SolanaRPCConfig {
  primary: string;
  fallbacks: string[];
}

export class SolanaClient {
  private connection: Connection | null = null;
  private fallbackConnections: Connection[] = [];
  private currentConnectionIndex = 0;
  private config: SolanaRPCConfig;
  private isHealthy = true;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: SolanaRPCConfig) {
    this.config = config;
    this.initializeConnections();
    this.startHealthCheck();
  }

  private initializeConnections(): void {
    try {
      // ✅ FIXED: Use mainnet WebSocket from env, fallback to mainnet (not devnet!)
      const wsEndpoint = process.env.SOLANA_WSS_URL || 
        process.env.SOLANA_MAINNET_WSS_URL ||
        `wss://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY || ''}`;
      
      this.connection = new Connection(this.config.primary, {
        commitment: 'confirmed',
        wsEndpoint: wsEndpoint,
        confirmTransactionInitialTimeout: 60000, // 60s timeout
      });
      
      this.fallbackConnections = this.config.fallbacks.map(
        url => new Connection(url, {
          commitment: 'confirmed',
          wsEndpoint: wsEndpoint,
          confirmTransactionInitialTimeout: 60000,
        })
      );
      
      logger.info('Solana RPC connections initialized with WebSocket', {
        primary: this.config.primary,
        wsEndpoint: wsEndpoint,
        fallbacks: this.config.fallbacks.length,
      });
    } catch (error) {
      logger.error('Failed to initialize Solana connections', error);
      throw error;
    }
  }

  private async checkConnectionHealth(connection: Connection): Promise<boolean> {
    try {
      const slot = await connection.getSlot();
      return slot > 0;
    } catch {
      return false;
    }
  }

  private async getHealthyConnection(): Promise<Connection> {
    // Check primary first
    if (this.connection && await this.checkConnectionHealth(this.connection)) {
      return this.connection;
    }

    // Try fallbacks
    for (let i = 0; i < this.fallbackConnections.length; i++) {
      const index = (this.currentConnectionIndex + i) % this.fallbackConnections.length;
      const connection = this.fallbackConnections[index];
      
      if (await this.checkConnectionHealth(connection)) {
        this.currentConnectionIndex = index;
        this.isHealthy = true;
        return connection;
      }
    }

    throw new Error('All Solana RPC connections are unhealthy');
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const connection = await this.getHealthyConnection();
        this.isHealthy = true;
      } catch {
        this.isHealthy = false;
        logger.warn('Solana RPC health check failed');
      }
    }, 30000);
  }

  async getBalance(address: string): Promise<string> {
    const connection = await this.getHealthyConnection();
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return (balance / LAMPORTS_PER_SOL).toString();
  }

  async sendTransaction(
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKey: Uint8Array
  ): Promise<{ txHash: string; slot?: number }> {
    try {
      const connection = await this.getHealthyConnection();
      const fromPubkey = new PublicKey(fromAddress);
      const toPubkey = new PublicKey(toAddress);

      // Create keypair from private key
      const keypair = Keypair.fromSecretKey(privateKey);

      // Build transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign transaction
      transaction.sign(keypair);

      // Send and confirm
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        {
          commitment: 'confirmed',
          maxRetries: 3,
        }
      );

      // Get transaction details
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
      });

      logger.info('Solana transaction sent', {
        txHash: signature,
        from: fromAddress,
        to: toAddress,
        amount,
        slot: tx?.slot,
      });

      return {
        txHash: signature,
        slot: tx?.slot,
      };
    } catch (error) {
      logger.error('Failed to send Solana transaction', error);
      throw error;
    }
  }

  async getTransaction(signature: string): Promise<{
    status: 'success' | 'failed' | 'pending';
    slot?: number;
    confirmations?: number;
  } | null> {
    try {
      const connection = await this.getHealthyConnection();
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
      });

      if (!tx) return null;

      return {
        status: tx.meta?.err ? 'failed' : 'success',
        slot: tx.slot,
        confirmations: tx.slot ? await this.getConfirmations(tx.slot) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get Solana transaction', error);
      return null;
    }
  }

  async getConfirmations(slot: number): Promise<number> {
    try {
      const connection = await this.getHealthyConnection();
      const currentSlot = await connection.getSlot();
      return Math.max(0, currentSlot - slot);
    } catch {
      return 0;
    }
  }

  async getLatestBlockhash(): Promise<string> {
    const connection = await this.getHealthyConnection();
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    return blockhash;
  }

  getHealthStatus(): { healthy: boolean; currentProvider: string; currentConnection: string } {
    const connection = this.currentConnectionIndex === 0
      ? this.config.primary
      : this.config.fallbacks[this.currentConnectionIndex - 1];
    return {
      healthy: this.isHealthy,
      currentProvider: connection,
      currentConnection: connection,
    };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Mainnet/Devnet configuration based on environment
const SOLANA_CONFIG: SolanaRPCConfig = {
  primary: process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
    (process.env.NODE_ENV === 'production'
      ? 'https://mainnet.helius-rpc.com/?api-key=' + (process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY || '')
      : 'https://devnet.helius-rpc.com/?api-key=' + (process.env.NEXT_PUBLIC_HELIUS_API_KEY || '')
    ),
  fallbacks: process.env.NODE_ENV === 'production'
    ? [
        'https://api.mainnet-beta.solana.com',
        'https://solana-mainnet.g.alchemy.com/v2/demo', // Replace with real Alchemy key in production
      ]
    : [
        'https://api.devnet.solana.com',
      ],
};

export const solanaClient = new SolanaClient(SOLANA_CONFIG);


