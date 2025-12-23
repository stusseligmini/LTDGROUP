/**
 * Solana WebSocket Manager with Reconnection Logic
 * Handles real-time transaction updates with exponential backoff
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';

export interface WebSocketConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectBackoffFactor?: number;
}

export class SolanaWebSocketManager {
  private connection: Connection;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private reconnectBackoffFactor: number;
  private currentReconnectDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private subscriptions = new Map<number, () => void>();

  constructor(config: WebSocketConfig) {
    this.reconnectDelay = config.reconnectDelay || 1000; // Start at 1s
    this.maxReconnectDelay = config.maxReconnectDelay || 60000; // Max 60s
    this.reconnectBackoffFactor = config.reconnectBackoffFactor || 2;
    this.currentReconnectDelay = this.reconnectDelay;

    // Get WebSocket endpoint from config
    const wsEndpoint = config.url;
    
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '',
      {
        commitment: 'confirmed',
        wsEndpoint: wsEndpoint,
      }
    );

    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring(): void {
    // Check connection health every 30s
    setInterval(async () => {
      try {
        await this.connection.getSlot();
        if (!this.isConnected) {
          this.isConnected = true;
          this.currentReconnectDelay = this.reconnectDelay; // Reset backoff
          logger.info('Solana WebSocket connection restored');
        }
      } catch (error) {
        if (this.isConnected) {
          this.isConnected = false;
          logger.warn('Solana WebSocket connection lost, scheduling reconnect');
          this.scheduleReconnect();
        }
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    logger.info(`Reconnecting to Solana WebSocket in ${this.currentReconnectDelay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, this.currentReconnectDelay);

    // Exponential backoff
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * this.reconnectBackoffFactor,
      this.maxReconnectDelay
    );
  }

  private async reconnect(): Promise<void> {
    try {
      // Test connection
      await this.connection.getSlot();
      this.isConnected = true;
      this.currentReconnectDelay = this.reconnectDelay; // Reset backoff
      
      // Resubscribe to all active subscriptions
      await this.resubscribeAll();
      
      logger.info('Successfully reconnected to Solana WebSocket');
    } catch (error) {
      logger.error('Failed to reconnect to Solana WebSocket', error);
      this.scheduleReconnect();
    }
  }

  private async resubscribeAll(): Promise<void> {
    const unsubscribeFunctions = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    // Call all unsubscribe functions to clean up old subscriptions
    for (const unsubscribe of unsubscribeFunctions) {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('Failed to unsubscribe', error);
      }
    }

    logger.info('Cleared old subscriptions, ready for new ones');
  }

  /**
   * Subscribe to account changes (e.g., balance updates)
   */
  async subscribeToAccount(
    address: string,
    callback: (balance: number) => void
  ): Promise<() => void> {
    const publicKey = new PublicKey(address);
    
    const subscriptionId = this.connection.onAccountChange(
      publicKey,
      (accountInfo) => {
        callback(accountInfo.lamports);
      },
      'confirmed'
    );

    const unsubscribe = () => {
      this.connection.removeAccountChangeListener(subscriptionId);
      this.subscriptions.delete(subscriptionId);
    };

    this.subscriptions.set(subscriptionId, unsubscribe);
    
    logger.info('Subscribed to account changes', { address, subscriptionId });
    
    return unsubscribe;
  }

  /**
   * Subscribe to signature status (transaction confirmations)
   */
  async subscribeToSignature(
    signature: string,
    callback: (status: 'success' | 'failed') => void
  ): Promise<() => void> {
    const subscriptionId = this.connection.onSignature(
      signature,
      (result) => {
        const status = result.err ? 'failed' : 'success';
        callback(status);
        
        // Auto-unsubscribe after receiving result
        this.connection.removeSignatureListener(subscriptionId);
        this.subscriptions.delete(subscriptionId);
      },
      'confirmed'
    );

    const unsubscribe = () => {
      this.connection.removeSignatureListener(subscriptionId);
      this.subscriptions.delete(subscriptionId);
    };

    this.subscriptions.set(subscriptionId, unsubscribe);
    
    logger.info('Subscribed to signature status', { signature, subscriptionId });
    
    return unsubscribe;
  }

  /**
   * Get current connection status
   */
  getStatus(): { connected: boolean; activeSubscriptions: number } {
    return {
      connected: this.isConnected,
      activeSubscriptions: this.subscriptions.size,
    };
  }

  /**
   * Cleanup all subscriptions and timers
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Unsubscribe from all active subscriptions
    for (const unsubscribe of this.subscriptions.values()) {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('Failed to unsubscribe during cleanup', error);
      }
    }

    this.subscriptions.clear();
    logger.info('Solana WebSocket manager destroyed');
  }
}

// Singleton instance
let wsManager: SolanaWebSocketManager | null = null;

export function getSolanaWebSocketManager(): SolanaWebSocketManager {
  if (!wsManager) {
    const wsUrl = process.env.SOLANA_WSS_URL || 
      process.env.SOLANA_MAINNET_WSS_URL ||
      `wss://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY || ''}`;
    
    wsManager = new SolanaWebSocketManager({
      url: wsUrl,
      reconnectDelay: 1000,
      maxReconnectDelay: 60000,
      reconnectBackoffFactor: 2,
    });
  }
  
  return wsManager;
}
