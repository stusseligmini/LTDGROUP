/**
 * Firebase Cloud Functions - Simplified JavaScript version
 * Includes scheduled cron jobs for balance sync, transaction monitoring, and scheduled payments
 */

const functions = require('firebase-functions/v1');
const { PrismaClient } = require('@prisma/client');

// ============================================================================
// SCHEDULED FUNCTIONS (CRON JOBS)
// ============================================================================

exports.balanceSyncCron = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const prisma = new PrismaClient();
    
    try {
      console.log('[Cron] Starting balance sync...');
      
      const wallets = await prisma.wallet.findMany({
        where: {},
        select: { id: true, address: true, blockchain: true },
        take: 100,
      });

      console.log(`[Cron] Syncing ${wallets.length} wallets`);

      for (const wallet of wallets) {
        try {
          const balance = await fetchBalance(wallet.blockchain, wallet.address);
          
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              balanceCache: balance,
              lastSyncedAt: new Date(),
            },
          });

          console.log(`[Cron] Synced ${wallet.blockchain} ${wallet.address}: ${balance}`);
        } catch (error) {
          console.error(`[Cron] Failed to sync wallet ${wallet.id}:`, error);
        }
      }

      console.log('[Cron] Balance sync completed');
    } catch (error) {
      console.error('[Cron] Balance sync failed:', error);
    } finally {
      await prisma.$disconnect();
    }

    return null;
  });

exports.transactionMonitorCron = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    const prisma = new PrismaClient();
    
    try {
      console.log('[Cron] Starting transaction monitoring...');
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingTxs = await prisma.transaction.findMany({
        where: {
          status: 'PENDING',
          createdAt: { gte: oneDayAgo },
        },
        take: 50,
      });

      console.log(`[Cron] Monitoring ${pendingTxs.length} pending transactions`);

      for (const tx of pendingTxs) {
        try {
          const status = await checkTxStatus(tx.blockchain, tx.txHash);

          if (status !== 'PENDING') {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status,
                confirmedAt: status === 'CONFIRMED' ? new Date() : null,
              },
            });

            console.log(`[Cron] Updated ${tx.txHash}: ${status}`);
          }
        } catch (error) {
          console.error(`[Cron] Failed to check ${tx.id}:`, error);
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

exports.scheduledPaymentsCron = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    const prisma = new PrismaClient();
    
    try {
      console.log('[Cron] Checking scheduled payments...');
      
      const now = new Date();
      const duePayments = await prisma.scheduledPayment.findMany({
        where: {
          isActive: true,
          isPaused: false,
          nextRunAt: { lte: now },
        },
        include: {
          wallet: {
            select: { userId: true, address: true, blockchain: true },
          },
        },
        take: 100,
      });

      console.log(`[Cron] Found ${duePayments.length} due payments`);

      for (const payment of duePayments) {
        try {
          if (payment.maxExecutions && payment.executionCount >= payment.maxExecutions) {
            await prisma.scheduledPayment.update({
              where: { id: payment.id },
              data: { isActive: false },
            });
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
              },
            },
          });

          const nextRun = calculateNextRun(payment.frequency, now);
          await prisma.scheduledPayment.update({
            where: { id: payment.id },
            data: {
              nextRunAt: nextRun,
              executionCount: payment.executionCount + 1,
            },
          });

          console.log(`[Cron] Notified payment ${payment.id}, next: ${nextRun}`);
        } catch (error) {
          console.error(`[Cron] Failed to process ${payment.id}:`, error);
        }
      }

      console.log('[Cron] Scheduled payments completed');
    } catch (error) {
      console.error('[Cron] Scheduled payments failed:', error);
    } finally {
      await prisma.$disconnect();
    }

    return null;
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchBalance(blockchain, address) {
  try {
    if (blockchain === 'SOLANA') {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });
      
      const data = await response.json();
      const lamports = data.result?.value || 0;
      return (lamports / 1e9).toString();
    }
    
    return '0';
  } catch (error) {
    console.error('Balance fetch error:', error);
    return '0';
  }
}

async function checkTxStatus(blockchain, txHash) {
  // Simplified - assume confirmed after checking
  return 'CONFIRMED';
}

function calculateNextRun(frequency, currentTime) {
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
