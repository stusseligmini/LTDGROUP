/**
 * Transaction Monitoring Service
 * Monitors pending transactions and updates their status
 */

import { prisma } from '@/server/db/client';
import { blockchainService, Blockchain } from '@/lib/blockchain';
import { updateTransactionStatus } from './transactionService';
import { logger } from '@/lib/logger';

export interface MonitoringConfig {
  checkInterval: number; // milliseconds
  maxConfirmations: number;
  timeoutMinutes: number;
}

const DEFAULT_CONFIG: MonitoringConfig = {
  checkInterval: 30000, // 30 seconds
  maxConfirmations: 12, // For most chains, 12 confirmations is considered final
  timeoutMinutes: 60, // Mark as failed after 60 minutes
};

export class TransactionMonitoringService {
  private config: MonitoringConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: MonitoringConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Start monitoring service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Transaction monitoring service already running');
      return;
    }

    this.isRunning = true;
    this.monitoringInterval = setInterval(
      () => this.checkPendingTransactions(),
      this.config.checkInterval
    );

    logger.info('Transaction monitoring service started', {
      checkInterval: this.config.checkInterval,
    });
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    logger.info('Transaction monitoring service stopped');
  }

  /**
   * Check all pending transactions
   */
  private async checkPendingTransactions(): Promise<void> {
    try {
      // Get all pending transactions
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: 'pending',
        },
        take: 100, // Process in batches
      });

      if (pendingTransactions.length === 0) {
        return;
      }

      logger.debug(`Checking ${pendingTransactions.length} pending transactions`);

      // Check each transaction
      for (const tx of pendingTransactions) {
        await this.checkTransaction(tx);
      }
    } catch (error) {
      logger.error('Error checking pending transactions', error);
    }
  }

  /**
   * Check a single transaction
   */
  private async checkTransaction(tx: any): Promise<void> {
    try {
      const blockchain = tx.blockchain as Blockchain;
      const txHash = tx.txHash;

      // Check for timeout
      const txAge = Date.now() - tx.timestamp.getTime();
      const timeoutMs = this.config.timeoutMinutes * 60 * 1000;

      if (txAge > timeoutMs) {
        logger.warn('Transaction timed out', {
          txHash,
          blockchain,
          ageMinutes: Math.floor(txAge / 60000),
        });

        await prisma.transaction.update({
          where: { txHash },
          data: {
            status: 'failed',
            updatedAt: new Date(),
          },
        });

        // Log timeout event
        await prisma.auditLog.create({
          data: {
            userId: tx.wallet.userId,
            action: 'transaction_timeout',
            resource: 'transaction',
            resourceId: txHash,
            platform: 'monitoring',
            status: 'failed',
            metadata: {
              blockchain,
              txHash,
              ageMinutes: Math.floor(txAge / 60000),
            },
          },
        });

        return;
      }

      // Get status from blockchain
      const status = await blockchainService.getTransactionStatus(blockchain, txHash);

      if (!status) {
        // Transaction not found on blockchain yet
        return;
      }

      // Update if status changed
      if (status.status !== tx.status || status.confirmations !== tx.confirmations) {
        const newStatus = status.status === 'success' ? 'confirmed' :
                         status.status === 'failed' ? 'failed' : 'pending';

        await updateTransactionStatus(
          txHash,
          newStatus,
          status.confirmations,
          status.blockNumber ? BigInt(status.blockNumber) : undefined
        );

        logger.info('Transaction status updated', {
          txHash,
          blockchain,
          oldStatus: tx.status,
          newStatus,
          confirmations: status.confirmations,
        });

        // If confirmed, check if we've reached max confirmations
        if (newStatus === 'confirmed' && status.confirmations >= this.config.maxConfirmations) {
          // Transaction is fully confirmed, no need to monitor further
          logger.debug('Transaction fully confirmed, stopping monitoring', {
            txHash,
            confirmations: status.confirmations,
          });
        }
      }
    } catch (error) {
      logger.error('Error checking transaction', error, {
        txHash: tx.txHash,
        blockchain: tx.blockchain,
      });
    }
  }

  /**
   * Manually check a specific transaction
   */
  async checkTransactionById(txHash: string): Promise<void> {
    const tx = await prisma.transaction.findUnique({
      where: { txHash },
      include: {
        wallet: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    await this.checkTransaction(tx);
  }

  /**
   * Get monitoring statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    confirmed: number;
    failed: number;
    total: number;
  }> {
    const [pending, confirmed, failed, total] = await Promise.all([
      prisma.transaction.count({ where: { status: 'pending' } }),
      prisma.transaction.count({ where: { status: 'confirmed' } }),
      prisma.transaction.count({ where: { status: 'failed' } }),
      prisma.transaction.count(),
    ]);

    return { pending, confirmed, failed, total };
  }
}

// Singleton instance
export const transactionMonitoringService = new TransactionMonitoringService();


