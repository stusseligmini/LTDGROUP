import cron from 'node-cron';
import { prisma } from '@/server/db/client';
// TODO: broadcastTransaction function needs to be implemented in transactionService
// import { broadcastTransaction } from '../services/transactionService';
import { logger } from '@/lib/logger';

/**
 * Process scheduled payments
 */
async function processScheduledPayments() {
  try {
    logger.info('Processing scheduled payments...');

    // Get payments that are due
    const duePayments = await prisma.scheduledPayment.findMany({
      where: {
        isActive: true,
        isPaused: false,
        nextRunAt: {
          lte: new Date(),
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
    });

    logger.info(`Found ${duePayments.length} due payments`);

    for (const payment of duePayments) {
      try {
        // Check if max executions reached
        if (payment.maxExecutions && payment.executionCount >= payment.maxExecutions) {
          await prisma.scheduledPayment.update({
            where: { id: payment.id },
            data: { isActive: false },
          });
          continue;
        }

        // Check if total amount limit reached
        if (payment.totalAmountLimit) {
          const executions = await prisma.scheduledPaymentExecution.findMany({
            where: { paymentId: payment.id, status: 'success' },
            select: { amount: true },
          });

          const totalSpent = executions.reduce((sum, exec) => sum + parseFloat(exec.amount), 0);
          
          if (totalSpent >= parseFloat(payment.totalAmountLimit)) {
            await prisma.scheduledPayment.update({
              where: { id: payment.id },
              data: { isActive: false },
            });
            continue;
          }
        }

        // Execute the payment using real transaction service
        let txHash: string | undefined;
        try {
          if (!payment.wallet) {
            throw new Error('Wallet not found for scheduled payment');
          }

          // IMPORTANT: Scheduled payments cannot be executed server-side in a non-custodial wallet
          // This would require storing private keys on the server, which violates security principles
          // Instead, scheduled payments should be handled via:
          // 1. Client-side scheduling (extension/app triggers when running)
          // 2. Smart contract automation (on-chain scheduling)
          // 3. Custodial sub-wallet with limited funds specifically for scheduled payments
          
          logger.warn(`[CRON] Scheduled payment ${payment.id} requires client-side execution (non-custodial wallet)`);
          logger.info(`  From: ${payment.wallet.address} (${payment.wallet.blockchain})`);
          logger.info(`  To: ${payment.toAddress}`);
          logger.info(`  Amount: ${payment.amount}`);

          // Mark as pending and notify user to execute manually
          await prisma.scheduledPaymentExecution.create({
            data: {
              paymentId: payment.id,
              status: 'pending',
              amount: payment.amount,
              errorMessage: 'Awaiting client-side execution',
            },
          });

          continue;
          
          // Unreachable code below (will be enabled when broadcastTransaction is implemented)
          /* 
          const result = await broadcastTransaction({
            userId: payment.wallet.userId,
            walletId: payment.walletId,
            blockchain: payment.wallet.blockchain,
            fromAddress: payment.wallet.address,
            toAddress: payment.toAddress,
            amount: payment.amount,
            memo: payment.memo || undefined,
          });

          if (!result.success || !result.txHash) {
            throw new Error(result.error || 'Transaction failed');
          }

          txHash = result.txHash;
          */

          // Log execution
          await prisma.scheduledPaymentExecution.create({
            data: {
              paymentId: payment.id,
              amount: payment.amount,
              txHash,
              status: 'success',
            },
          });

          // Update payment
          await prisma.scheduledPayment.update({
            where: { id: payment.id },
            data: {
              executionCount: { increment: 1 },
              lastRunAt: new Date(),
              nextRunAt: calculateNextRunTime(payment),
            },
          });

          logger.info('Successfully executed scheduled payment', {
            paymentId: payment.id,
            txHash,
            amount: payment.amount,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Log failed execution
          await prisma.scheduledPaymentExecution.create({
            data: {
              paymentId: payment.id,
              amount: payment.amount,
              txHash: txHash || null,
              status: 'failed',
              errorMessage,
            },
          });

          logger.error('Failed to execute scheduled payment', error, {
            paymentId: payment.id,
            amount: payment.amount,
            toAddress: payment.toAddress,
          });
        }
      } catch (error) {
        logger.error('Error processing scheduled payment', error, {
          paymentId: payment.id,
        });
      }
    }

    logger.info('Finished processing scheduled payments');
  } catch (error) {
    logger.error('Error in processScheduledPayments', error);
  }
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRunTime(payment: any): Date {
  const now = new Date();

  switch (payment.frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly': {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    }
    case 'custom':
      // Custom cron expression - calculate next run
      // This is a simplification
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Start the cron job
 */
export function startScheduledPaymentsCron() {
  // Run every minute
  cron.schedule('* * * * *', processScheduledPayments);
  logger.info('Scheduled payments cron job started');
}

/**
 * Stop all cron jobs
 */
export function stopAllCrons() {
  cron.getTasks().forEach((task: any) => task.stop());
  logger.info('All cron jobs stopped');
}

