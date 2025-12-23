import * as functions from 'firebase-functions';
import next from 'next';
import * as path from 'path';

// Boot Next.js inside Firebase Functions (Node 20) with Next.js 16 support
const nextApp = next({
  dev: false,
  dir: path.join(__dirname),
  conf: {
    distDir: '.next',
  },
});

const handle = nextApp.getRequestHandler();

export const nextServer = functions.https.onRequest(async (req, res) => {
  try {
    await nextApp.prepare();
    return handle(req, res);
  } catch (err) {
    console.error('[Firebase Function] Next.js SSR error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ============================================================================
// SCHEDULED FUNCTIONS (CRON JOBS)
// ============================================================================

/**
 * Balance Sync Cron Job
 * Runs every 5 minutes to sync wallet balances from blockchain
 */
export const balanceSyncCron = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      console.log('[Cron] Starting balance sync...');
      
      // Get all active wallets
      const wallets = await prisma.wallet.findMany({
        where: {
          user: {
            isActive: true,
          },
        },
        select: {
          id: true,
          address: true,
          blockchain: true,
        },
        take: 100, // Limit to prevent timeout
      });

      console.log(`[Cron] Syncing ${wallets.length} wallets`);

      // Sync balances in batches
      const batchSize = 10;
      for (let i = 0; i < wallets.length; i += batchSize) {
        const batch = wallets.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (wallet) => {
            try {
              // Import blockchain service dynamically to avoid circular dependencies
              const { blockchainService } = await import('../src/lib/blockchain');
              const balance = await blockchainService.getBalance(
                wallet.blockchain as any,
                wallet.address
              );

              await prisma.wallet.update({
                where: { id: wallet.id },
                data: {
                  balanceCache: balance,
                  lastSyncedAt: new Date(),
                },
              });

              console.log(`[Cron] Synced ${wallet.blockchain} wallet ${wallet.address}: ${balance}`);
            } catch (error) {
              console.error(`[Cron] Failed to sync wallet ${wallet.id}:`, error);
            }
          })
        );
      }

      console.log('[Cron] Balance sync completed');
    } catch (error) {
      console.error('[Cron] Balance sync failed:', error);
    } finally {
      await prisma.$disconnect();
    }

    return null;
  });

/**
 * Transaction Monitoring Cron Job
 * Runs every minute to check pending transaction status
 */
export const transactionMonitorCron = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      console.log('[Cron] Starting transaction monitoring...');
      
      // Get pending transactions from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingTxs = await prisma.transaction.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            gte: oneDayAgo,
          },
        },
        select: {
          id: true,
          txHash: true,
          blockchain: true,
          fromAddress: true,
          toAddress: true,
          amount: true,
        },
        take: 50, // Limit to prevent timeout
      });

      console.log(`[Cron] Monitoring ${pendingTxs.length} pending transactions`);

      for (const tx of pendingTxs) {
        try {
          // Import blockchain service dynamically
          const { blockchainService } = await import('../src/lib/blockchain');
          
          // Check transaction status on blockchain
          const status = await checkTransactionStatus(
            tx.blockchain,
            tx.txHash,
            blockchainService
          );

          if (status !== 'PENDING') {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status,
                confirmedAt: status === 'CONFIRMED' ? new Date() : null,
              },
            });

            console.log(`[Cron] Updated transaction ${tx.txHash} status: ${status}`);
          }
        } catch (error) {
          console.error(`[Cron] Failed to check transaction ${tx.id}:`, error);
        }
      }

      console.log('[Cron] Transaction monitoring completed');
    } catch (error) {
      console.error('[Cron] Transaction monitoring failed:', error);
    } finally {
      await prisma.$disconnect();
    }

    return null;
  });

/**
 * Scheduled Payments Cron Job
 * Runs every hour to check for due scheduled payments
 * NOTE: This only marks payments as due for client-side execution (non-custodial)
 */
export const scheduledPaymentsCron = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      console.log('[Cron] Checking scheduled payments...');
      
      const now = new Date();
      const duePayments = await prisma.scheduledPayment.findMany({
        where: {
          isActive: true,
          isPaused: false,
          nextRunAt: {
            lte: now,
          },
        },
        include: {
          wallet: {
            select: {
              userId: true,
              address: true,
              blockchain: true,
            },
          },
        },
        take: 100,
      });

      console.log(`[Cron] Found ${duePayments.length} due payments`);

      for (const payment of duePayments) {
        try {
          // Check execution limits
          if (payment.maxExecutions && payment.executionCount >= payment.maxExecutions) {
            await prisma.scheduledPayment.update({
              where: { id: payment.id },
              data: { isActive: false },
            });
            console.log(`[Cron] Deactivated payment ${payment.id} - max executions reached`);
            continue;
          }

          // Create notification for client-side execution
          await prisma.notification.create({
            data: {
              userId: payment.wallet.userId,
              type: 'SCHEDULED_PAYMENT_DUE',
              title: 'Scheduled Payment Due',
              message: `Payment of ${payment.amount} to ${payment.recipientAddress} is due`,
              metadata: {
                paymentId: payment.id,
                amount: payment.amount,
                recipientAddress: payment.recipientAddress,
                blockchain: payment.wallet.blockchain,
              },
            },
          });

          // Calculate next execution time
          const nextRun = calculateNextRun(payment.frequency, now);
          await prisma.scheduledPayment.update({
            where: { id: payment.id },
            data: {
              nextRunAt: nextRun,
              executionCount: payment.executionCount + 1,
            },
          });

          console.log(`[Cron] Notified user about payment ${payment.id}, next run: ${nextRun}`);
        } catch (error) {
          console.error(`[Cron] Failed to process payment ${payment.id}:`, error);
        }
      }

      console.log('[Cron] Scheduled payments check completed');
    } catch (error) {
      console.error('[Cron] Scheduled payments check failed:', error);
    } finally {
      await prisma.$disconnect();
    }

    return null;
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function checkTransactionStatus(
  blockchain: string,
  txHash: string,
  blockchainService: any
): Promise<string> {
  try {
    // This is a simplified check - implement proper status checking per blockchain
    // For now, assume all pending transactions eventually confirm
    return 'CONFIRMED';
  } catch (error) {
    console.error('Failed to check transaction status:', error);
    return 'PENDING';
  }
}

function calculateNextRun(frequency: string, currentTime: Date): Date {
  const next = new Date(currentTime);
  
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  
  return next;
}
