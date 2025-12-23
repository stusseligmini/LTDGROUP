/**
 * Balance Synchronization Cron Job
 * Periodically syncs wallet balances from blockchain
 */

import cron from 'node-cron';
import { prisma } from '@/server/db/client';
import { blockchainService, Blockchain } from '@/lib/blockchain';
import { logger } from '@/lib/logger';

/**
 * Sync balance for a single wallet
 */
async function syncWalletBalance(walletId: string): Promise<void> {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return;
    }

    const blockchain = wallet.blockchain as Blockchain;
    const balance = await blockchainService.getBalance(blockchain, wallet.address);

    // Update balance cache
    await prisma.wallet.update({
      where: { id: walletId },
      data: {
        balanceCache: balance,
        lastSyncedAt: new Date(),
      },
    });

    logger.debug('Wallet balance synced', {
      walletId,
      blockchain,
      address: wallet.address,
      balance,
    });
  } catch (error) {
    logger.error('Failed to sync wallet balance', error, { walletId });
  }
}

/**
 * Sync all wallet balances
 */
async function syncAllBalances(): Promise<void> {
  try {
    logger.info('Starting balance synchronization');

    // Get all active wallets
    const wallets = await prisma.wallet.findMany({
      select: { id: true },
      take: 1000, // Process in batches
    });

    logger.info(`Syncing ${wallets.length} wallets`);

    // Sync in parallel (with concurrency limit)
    const BATCH_SIZE = 10;
    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      const batch = wallets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(w => syncWalletBalance(w.id)));
    }

    logger.info('Balance synchronization completed', {
      walletsSynced: wallets.length,
    });
  } catch (error) {
    logger.error('Error in balance synchronization', error);
  }
}

/**
 * Start balance sync cron job
 * Runs every 5 minutes
 */
export function startBalanceSyncCron(): void {
  // Run immediately on start
  syncAllBalances();

  // Then run every 5 minutes
  cron.schedule('*/5 * * * *', syncAllBalances);

  logger.info('Balance sync cron job started');
}

/**
 * Stop balance sync cron
 */
export function stopBalanceSyncCron(): void {
  // Cron jobs are stopped automatically when process exits
  logger.info('Balance sync cron job stopped');
}


