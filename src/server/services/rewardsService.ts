import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

export class RewardsService {
  /**
   * Calculate cashback for transaction
   */
  async calculateCashback(
    cardId: string,
    transactionAmount: number
  ): Promise<number> {
    try {
      const card = await prisma.card.findUnique({
        where: { id: cardId },
      });

      if (!card || !card.cashbackRate) {
        return 0;
      }

      const cashbackRate = parseFloat(card.cashbackRate.toString());
      const cashback = transactionAmount * cashbackRate;

      return cashback;
    } catch (error) {
      logger.error('Error calculating cashback', error, { cardId, transactionAmount });
      return 0;
    }
  }

  /**
   * Apply cashback to card
   */
  async applyCashback(
    cardId: string,
    transactionId: string,
    amount: number
  ): Promise<void> {
    try {
      const cashback = await this.calculateCashback(cardId, amount);

      if (cashback > 0) {
        // Update card rewards
        await prisma.card.update({
          where: { id: cardId },
          data: {
            rewardsEarned: { increment: cashback },
          },
        });

        // Update transaction with cashback
        await prisma.cardTransaction.update({
          where: { id: transactionId },
          data: {
            cashbackAmount: cashback,
            cashbackToken: 'USD', // Or crypto token
          },
        });
      }
    } catch (error) {
      logger.error('Error applying cashback', error, { cardId, transactionId, amount });
    }
  }

  /**
   * Add loyalty points
   */
  async addLoyaltyPoints(
    cardId: string,
    points: number
  ): Promise<void> {
    try {
      await prisma.card.update({
        where: { id: cardId },
        data: {
          loyaltyPoints: { increment: points },
        },
      });
    } catch (error) {
      logger.error('Error adding loyalty points', error, { cardId, points });
    }
  }

  /**
   * Redeem rewards
   */
  async redeemRewards(
    cardId: string,
    amount: number,
    redemptionType: 'cash' | 'crypto' | 'points'
  ): Promise<any> {
    try {
      const card = await prisma.card.findUnique({
        where: { id: cardId },
      });

      if (!card) {
        throw new Error('Card not found');
      }

      const availableRewards = parseFloat(card.rewardsEarned.toString());

      if (amount > availableRewards) {
        throw new Error('Insufficient rewards balance');
      }

      // Deduct rewards
      await prisma.card.update({
        where: { id: cardId },
        data: {
          rewardsEarned: { decrement: amount },
        },
      });

      // Create redemption record (using notification for now)
      await prisma.notification.create({
        data: {
          userId: card.userId,
          type: 'system',
          title: 'Rewards Redeemed',
          body: `You've redeemed $${amount.toFixed(2)} in rewards!`,
          channels: ['in-app', 'push'],
          metadata: {
            cardId,
            amount,
            redemptionType,
            redeemedAt: new Date(),
          },
        },
      });

      return {
        success: true,
        amount,
        newBalance: availableRewards - amount,
      };
    } catch (error) {
      logger.error('Error redeeming rewards', error, { cardId, amount, redemptionType });
      throw error;
    }
  }

  /**
   * Get rewards summary for user
   */
  async getRewardsSummary(userId: string): Promise<any> {
    try {
      const cards = await prisma.card.findMany({
        where: { userId },
        select: {
          id: true,
          nickname: true,
          rewardsEarned: true,
          loyaltyPoints: true,
          cashbackRate: true,
        },
      });

      const totalRewards = cards.reduce(
        (sum, card) => sum + parseFloat(card.rewardsEarned.toString()),
        0
      );

      const totalPoints = cards.reduce(
        (sum, card) => sum + parseFloat(card.loyaltyPoints.toString()),
        0
      );

      return {
        totalRewards,
        totalPoints,
        cards: cards.map(card => ({
          ...card,
          rewardsEarned: parseFloat(card.rewardsEarned.toString()),
          loyaltyPoints: parseFloat(card.loyaltyPoints.toString()),
        })),
      };
    } catch (error) {
      logger.error('Error getting rewards summary', error, { userId });
      return { totalRewards: 0, totalPoints: 0, cards: [] };
    }
  }

  /**
   * Calculate loyalty tier based on spending
   */
  async calculateLoyaltyTier(userId: string): Promise<string> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const totalSpending = await prisma.cardTransaction.aggregate({
        where: {
          userId,
          transactionDate: { gte: thirtyDaysAgo },
          status: 'approved',
        },
        _sum: {
          amount: true,
        },
      });

      const spending = totalSpending._sum.amount
        ? parseFloat(totalSpending._sum.amount.toString())
        : 0;

      if (spending >= 10000) return 'platinum';
      if (spending >= 5000) return 'gold';
      if (spending >= 1000) return 'silver';
      return 'bronze';
    } catch (error) {
      logger.error('Error calculating loyalty tier', error, { userId });
      return 'bronze';
    }
  }
}

export default new RewardsService();

