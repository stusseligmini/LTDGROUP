/**
 * Transaction Monitoring Cron Job
 * Runs periodically to check pending transactions
 */

import cron from 'node-cron';
import { transactionMonitoringService } from '../services/transactionMonitoringService';
import { logger } from '@/lib/logger';

/**
 * Start transaction monitoring cron job
 * Runs every minute to check pending transactions
 */
export function startTransactionMonitoringCron(): void {
  // Start the monitoring service
  transactionMonitoringService.start();

  // Also run a more thorough check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const stats = await transactionMonitoringService.getStatistics();
      logger.info('Transaction monitoring statistics', stats);
    } catch (error) {
      logger.error('Error getting transaction monitoring statistics', error);
    }
  });

  logger.info('Transaction monitoring cron job started');
}

/**
 * Stop all transaction monitoring
 */
export function stopTransactionMonitoringCron(): void {
  transactionMonitoringService.stop();
  logger.info('Transaction monitoring cron job stopped');
}


