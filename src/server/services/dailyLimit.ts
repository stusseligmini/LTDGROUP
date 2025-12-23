/**
 * Daily Spending Limit Service
 * Enforces $10,000 USD daily limit across all transactions
 * ✅ FIXED: Now includes pending, confirmed, and completed transactions
 */

import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

// Daily limit in USD
const DAILY_LIMIT_USD = 10000;

export interface DailyLimitRequest {
  userId: string;
  amountUsd: number;
}

export interface DailyLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  spent: number;
  pending: number;
}

/**
 * Check if transaction is within daily limit
 * ✅ FIXED: Now aggregates pending, confirmed, AND completed transactions
 */
export async function checkDailyLimit(
  request: DailyLimitRequest
): Promise<DailyLimitResult> {
  try {
    const { userId, amountUsd } = request;

    // Get start and end of today (UTC)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ✅ FIXED: Aggregate ALL relevant transaction statuses
    const aggregate = await prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        status: { 
          in: ['pending', 'confirmed', 'completed'] // Include all active statuses
        },
        timestamp: {
          gte: startOfDay,
          lt: endOfDay,
        },
        amountUsd: {
          not: null, // Only include transactions with USD amount
        },
      },
      _sum: {
        amountUsd: true,
      },
    });

    const spentToday = Number(aggregate._sum.amountUsd) || 0;
    const remaining = DAILY_LIMIT_USD - spentToday;
    const allowed = spentToday + amountUsd <= DAILY_LIMIT_USD;

    // Get pending amount separately for detailed breakdown
    const pendingAggregate = await prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        status: 'pending',
        timestamp: {
          gte: startOfDay,
          lt: endOfDay,
        },
        amountUsd: {
          not: null,
        },
      },
      _sum: {
        amountUsd: true,
      },
    });

    const pendingAmount = Number(pendingAggregate._sum.amountUsd) || 0;

    logger.info('Daily limit check', {
      userId,
      requestedAmount: amountUsd,
      spentToday,
      pendingAmount,
      remaining,
      allowed,
    });

    return {
      allowed,
      remaining: Math.max(0, remaining),
      limit: DAILY_LIMIT_USD,
      spent: spentToday,
      pending: pendingAmount,
    };
  } catch (error) {
    logger.error('Failed to check daily limit', error);
    
    // Fail-safe: If limit check fails, deny the transaction for security
    return {
      allowed: false,
      remaining: 0,
      limit: DAILY_LIMIT_USD,
      spent: 0,
      pending: 0,
    };
  }
}

/**
 * Get current daily spending summary for a user
 */
export async function getDailySpendingSummary(userId: string): Promise<{
  spent: number;
  pending: number;
  remaining: number;
  limit: number;
  percentUsed: number;
}> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Get completed transactions
    const completedAggregate = await prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        status: { in: ['confirmed', 'completed'] },
        timestamp: { gte: startOfDay, lt: endOfDay },
        amountUsd: { not: null },
      },
      _sum: { amountUsd: true },
    });

    // Get pending transactions
    const pendingAggregate = await prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        status: 'pending',
        timestamp: { gte: startOfDay, lt: endOfDay },
        amountUsd: { not: null },
      },
      _sum: { amountUsd: true },
    });

    const spent = Number(completedAggregate._sum.amountUsd) || 0;
    const pending = Number(pendingAggregate._sum.amountUsd) || 0;
    const total = spent + pending;
    const remaining = Math.max(0, DAILY_LIMIT_USD - total);
    const percentUsed = (total / DAILY_LIMIT_USD) * 100;

    return {
      spent,
      pending,
      remaining,
      limit: DAILY_LIMIT_USD,
      percentUsed,
    };
  } catch (error) {
    logger.error('Failed to get daily spending summary', error);
    return {
      spent: 0,
      pending: 0,
      remaining: DAILY_LIMIT_USD,
      limit: DAILY_LIMIT_USD,
      percentUsed: 0,
    };
  }
}

/**
 * Reset daily limit (called by cron job at midnight UTC)
 */
export async function resetDailyLimitNotifications(): Promise<void> {
  // This is just for cleanup - limits are automatically "reset" 
  // because we filter by timestamp (start of day)
  logger.info('Daily limit notifications reset (automatic via timestamp filtering)');
}
