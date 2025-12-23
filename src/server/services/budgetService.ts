import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

export class BudgetService {
  /**
   * Create spending limit
   */
  async createSpendingLimit(
    userId: string,
    limitType: 'daily' | 'weekly' | 'monthly' | 'per_transaction',
    amount: number,
    walletId?: string,
    cardId?: string,
    category?: string
  ): Promise<any> {
    try {
      const { periodStart, periodEnd } = this.calculatePeriod(limitType);

      const limit = await prisma.spendingLimit.create({
        data: {
          userId,
          walletId,
          cardId,
          limitType,
          amount: amount.toString(),
          isActive: true,
          alertSent: false,
          category,
          periodStart,
          periodEnd,
          resetAt: periodEnd,
          alertAt: '0.8', // Alert at 80%
        },
      });

      return limit;
    } catch (error) {
      logger.error('Error creating spending limit', error, { userId, limitType, amount });
      throw error;
    }
  }

  /**
   * Check if transaction exceeds limits
   */
  async checkLimits(
    userId: string,
    amount: number,
    walletId?: string,
    cardId?: string,
    category?: string
  ): Promise<{ allowed: boolean; reason?: string; limitExceeded?: any }> {
    try {
      // Get applicable limits
      const now = new Date();
      const limits = await prisma.spendingLimit.findMany({
        where: {
          userId,
          isActive: true,
          periodEnd: { gte: now },
          OR: [
            { walletId: walletId || null, cardId: null },
            { cardId: cardId || null, walletId: null },
            { category: category || null },
            { walletId: null, cardId: null, category: null }, // Global limits
          ],
        },
      });

      for (const limit of limits) {
        const remaining = parseFloat(limit.amount.toString()) - parseFloat(limit.currentSpent.toString());
        
        if (amount > remaining) {
          return {
            allowed: false,
            reason: `Spending limit exceeded. ${remaining.toFixed(2)} remaining for ${limit.limitType} period.`,
            limitExceeded: limit,
          };
        }

        // Check if alert threshold reached
        if (limit.alertAt && !limit.alertSent) {
          const alertThreshold = parseFloat(limit.alertAt.toString());
          if (parseFloat(limit.currentSpent.toString()) + amount >= alertThreshold) {
            await this.sendLimitAlert(userId, limit);
            await prisma.spendingLimit.update({
              where: { id: limit.id },
              data: { alertSent: true },
            });
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking limits', error, { userId, amount });
      return { allowed: true }; // Allow on error to not block transactions
    }
  }

  /**
   * Update spending after transaction
   */
  async recordSpending(
    userId: string,
    amount: number,
    walletId?: string,
    cardId?: string,
    category?: string
  ): Promise<void> {
    try {
      const now = new Date();
      const limits = await prisma.spendingLimit.findMany({
        where: {
          userId,
          isActive: true,
          periodEnd: { gte: now },
          OR: [
            { walletId: walletId || null },
            { cardId: cardId || null },
            { category: category || null },
          ],
        },
      });

      for (const limit of limits) {
        await prisma.spendingLimit.update({
          where: { id: limit.id },
          data: {
            currentSpent: { increment: amount },
          },
        });
      }
    } catch (error) {
      logger.error('Error recording spending', error, { userId, amount });
    }
  }

  /**
   * Get spending limits for user
   */
  async getSpendingLimits(userId: string): Promise<any[]> {
    const limits = await prisma.spendingLimit.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return limits;
  }

  /**
   * Get spending summary
   */
  async getSpendingSummary(userId: string): Promise<any> {
    const limits = await this.getSpendingLimits(userId);
    
    const summary = {
      daily: { limit: 0, spent: 0, remaining: 0 },
      weekly: { limit: 0, spent: 0, remaining: 0 },
      monthly: { limit: 0, spent: 0, remaining: 0 },
    };

    for (const limit of limits) {
      const type = limit.limitType as keyof typeof summary;
      if (summary[type]) {
        const limitAmount = parseFloat(limit.amount.toString());
        const spent = parseFloat(limit.currentSpent.toString());
        summary[type].limit += limitAmount;
        summary[type].spent += spent;
        summary[type].remaining += (limitAmount - spent);
      }
    }

    return summary;
  }

  /**
   * Reset expired periods
   */
  async resetExpiredPeriods(): Promise<void> {
    try {
      const now = new Date();
      const expiredLimits = await prisma.spendingLimit.findMany({
        where: {
          periodEnd: { lt: now },
          isActive: true,
        },
      });

      for (const limit of expiredLimits) {
        const { periodStart, periodEnd } = this.calculatePeriod(limit.limitType as any);
        
        await prisma.spendingLimit.update({
          where: { id: limit.id },
          data: {
            currentSpent: 0,
            alertSent: false,
            periodStart,
            periodEnd,
          },
        });
      }
    } catch (error) {
      logger.error('Error resetting periods', error);
    }
  }

  /**
   * Calculate period dates
   */
  private calculatePeriod(limitType: string): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    switch (limitType) {
      case 'daily':
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      case 'weekly': {
        const day = now.getDay();
        periodStart.setDate(now.getDate() - day);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setDate(periodStart.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      }
      case 'monthly':
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setMonth(periodStart.getMonth() + 1);
        periodEnd.setDate(0);
        periodEnd.setHours(23, 59, 59, 999);
        break;
    }

    return { periodStart, periodEnd };
  }

  /**
   * Send alert when limit threshold reached
   */
  private async sendLimitAlert(userId: string, limit: any): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: 'system',
          title: 'Spending Limit Alert',
          body: `You've reached 80% of your ${limit.limitType} spending limit.`,
          channels: ['push', 'in-app'],
          priority: 'high',
        },
      });
    } catch (error) {
      logger.error('Error sending limit alert', error, { userId, limitId: limit.id });
    }
  }
}

export default new BudgetService();

