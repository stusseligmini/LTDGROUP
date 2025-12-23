import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

interface FraudCheckResult {
  isSuspicious: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  confidence: number;
}

interface TransactionPattern {
  averageAmount: number;
  frequency: number;
  commonRecipients: string[];
  commonTime: string;
}

export class AIService {
  /**
   * Analyze transaction for fraud
   */
  async analyzeFraud(
    userId: string,
    amount: number,
    recipient: string,
    blockchain: string
  ): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    // Get user's transaction history
    const userPattern = await this.getUserTransactionPattern(userId);
    const safePattern: TransactionPattern = {
      averageAmount: userPattern?.averageAmount ?? 0,
      frequency: userPattern?.frequency ?? 0,
      commonRecipients: userPattern?.commonRecipients ?? [],
      commonTime: userPattern?.commonTime ?? 'day',
    };

    // Rule 1: Unusually large amount (velocity check)
    if (amount > safePattern.averageAmount * 10) {
      reasons.push(`Transaction amount (${amount}) is 10x larger than average (${safePattern.averageAmount.toFixed(2)})`);
      riskScore += 30;
    }

    // Rule 2: First-time recipient with large amount
    const recipientList = safePattern.commonRecipients ?? [];
    const avgAmount = safePattern.averageAmount ?? 0;
    const isNewRecipient = !recipientList.includes(recipient);
    if (isNewRecipient && amount > avgAmount * 3) {
      reasons.push('First-time recipient with large amount');
      riskScore += 25;
    }

    // Rule 3: Rapid succession of transactions
    const recentTxCount = await this.getRecentTransactionCount(userId, 10); // Last 10 minutes
    if (recentTxCount > 5) {
      reasons.push(`${recentTxCount} transactions in last 10 minutes`);
      riskScore += 20;
    }

    // Rule 4: Known malicious address (placeholder - would need a database)
    const isKnownBad = await this.isKnownMaliciousAddress(recipient);
    if (isKnownBad) {
      reasons.push('Recipient is flagged as malicious');
      riskScore += 50;
    }

    // Rule 5: Unusual time (if user typically transacts during business hours)
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 22) {
      if (safePattern.commonTime !== 'night') {
        reasons.push('Transaction at unusual time');
        riskScore += 10;
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 50) {
      riskLevel = 'critical';
    } else if (riskScore >= 30) {
      riskLevel = 'high';
    } else if (riskScore >= 15) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    const isSuspicious = riskScore >= 30;

    // Create fraud alert if suspicious
    if (isSuspicious) {
      await this.createFraudAlert(userId, {
        alertType: 'velocity',
        severity: riskLevel,
        title: 'Suspicious Transaction Detected',
        description: reasons.join('; '),
        amount,
        confidence: riskScore / 100,
        metadata: {
          recipient,
          blockchain,
          reasons,
        },
      });
    }

    return {
      isSuspicious,
      riskLevel,
      reasons,
      confidence: riskScore / 100,
    };
  }

  /**
   * Get user's transaction pattern
   */
  private async getUserTransactionPattern(userId: string): Promise<TransactionPattern> {
    // Get transactions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await prisma.transaction.findMany({
      where: {
        wallet: {
          userId,
        },
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
    });

    if (transactions.length === 0) {
      return {
        averageAmount: 100, // Default
        frequency: 0,
        commonRecipients: [],
        commonTime: 'day',
      };
    }

    // Calculate average amount
    const amounts = transactions.map(tx => parseFloat(tx.amount));
    const averageAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;

    // Get common recipients
    const recipientCounts: Record<string, number> = {};
    transactions.forEach(tx => {
      recipientCounts[tx.toAddress] = (recipientCounts[tx.toAddress] || 0) + 1;
    });
    const commonRecipients = Object.entries(recipientCounts)
      .filter(([_, count]) => count >= 3)
      .map(([address, _]) => address);

    // Determine common time
    const hours = transactions.map(tx => tx.timestamp.getHours());
    const nightTransactions = hours.filter(h => h < 6 || h > 22).length;
    const commonTime = nightTransactions > transactions.length / 2 ? 'night' : 'day';

    return {
      averageAmount,
      frequency: transactions.length,
      commonRecipients,
      commonTime,
    };
  }

  /**
   * Get count of recent transactions
   */
  private async getRecentTransactionCount(userId: string, minutesAgo: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - minutesAgo);

    const count = await prisma.transaction.count({
      where: {
        wallet: {
          userId,
        },
        timestamp: {
          gte: cutoff,
        },
      },
    });

    return count;
  }

  /**
   * Check if address is known malicious
   */
  private async isKnownMaliciousAddress(address: string): Promise<boolean> {
    // In production, check against a database of known malicious addresses
    // For now, return false
    return false;
  }

  /**
   * Create fraud alert
   */
  private async createFraudAlert(userId: string, data: any): Promise<void> {
    try {
      await prisma.fraudAlert.create({
        data: {
          userId,
          alertType: data.alertType,
          severity: data.severity,
          title: data.title,
          description: data.description,
          amount: data.amount,
          confidence: data.confidence,
          ruleTriggered: data.reasons?.join('; '),
          metadata: data.metadata,
        },
      });
    } catch (error) {
      logger.error('Error creating fraud alert', error, { userId, alertType: data.alertType });
    }
  }

  /**
   * Categorize transaction
   */
  async categorizeTransaction(
    merchantName: string,
    amount: number,
    mcc?: string
  ): Promise<{ category: string; subcategory?: string; confidence: number }> {
    // Rule-based categorization
    const merchantLower = merchantName.toLowerCase();

    // Groceries
    if (
      merchantLower.includes('grocery') ||
      merchantLower.includes('supermarket') ||
      merchantLower.includes('walmart') ||
      merchantLower.includes('target') ||
      mcc === '5411'
    ) {
      return { category: 'groceries', confidence: 0.9 };
    }

    // Transport
    if (
      merchantLower.includes('uber') ||
      merchantLower.includes('lyft') ||
      merchantLower.includes('gas') ||
      merchantLower.includes('shell') ||
      merchantLower.includes('chevron') ||
      mcc?.startsWith('47') // Gas stations
    ) {
      return { category: 'transport', confidence: 0.85 };
    }

    // Dining
    if (
      merchantLower.includes('restaurant') ||
      merchantLower.includes('cafe') ||
      merchantLower.includes('coffee') ||
      merchantLower.includes('starbucks') ||
      mcc === '5812' || mcc === '5814'
    ) {
      return { category: 'dining', confidence: 0.9 };
    }

    // Entertainment
    if (
      merchantLower.includes('netflix') ||
      merchantLower.includes('spotify') ||
      merchantLower.includes('cinema') ||
      merchantLower.includes('theater') ||
      mcc === '7832' || mcc === '7841'
    ) {
      return { category: 'entertainment', confidence: 0.85 };
    }

    // Bills
    if (
      merchantLower.includes('electric') ||
      merchantLower.includes('water') ||
      merchantLower.includes('internet') ||
      merchantLower.includes('phone') ||
      merchantLower.includes('utility')
    ) {
      return { category: 'bills', confidence: 0.9 };
    }

    // Shopping
    if (
      merchantLower.includes('amazon') ||
      merchantLower.includes('ebay') ||
      merchantLower.includes('shop')
    ) {
      return { category: 'shopping', confidence: 0.8 };
    }

    // Default
    return { category: 'other', confidence: 0.5 };
  }

  /**
   * Generate spending insights
   */
  async generateSpendingInsights(userId: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Get transactions for last 30 days
      const recentTxs = await prisma.cardTransaction.findMany({
        where: {
          userId,
          transactionDate: {
            gte: thirtyDaysAgo,
          },
        },
      });

      // Get transactions for previous 30 days
      const previousTxs = await prisma.cardTransaction.findMany({
        where: {
          userId,
          transactionDate: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          },
        },
      });

      const recentTotal = recentTxs.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
      const previousTotal = previousTxs.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

      const percentChange = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 0;

      // Spending increase insight
      if (percentChange > 20) {
        await prisma.spendingInsight.create({
          data: {
            userId,
            insightType: 'trend',
            type: 'trend',
            title: 'Spending Increased',
            description: `Your spending increased by ${percentChange.toFixed(0)}% this month compared to last month.`,
            amount: recentTotal,
            percentage: percentChange,
            period: 'month',
            severity: percentChange > 50 ? 'warning' : 'info',
            insightDate: new Date(),
            data: { recentTotal, previousTotal, percentChange },
          },
        });
      }

      // Category-specific insights
      const categorySpending: Record<string, number> = {};
      recentTxs.forEach(tx => {
        if (tx.category) {
          categorySpending[tx.category] = (categorySpending[tx.category] || 0) + parseFloat(tx.amount.toString());
        }
      });

      // Top spending category
      const topCategory = Object.entries(categorySpending)
        .sort(([, a], [, b]) => b - a)[0];

      if (topCategory) {
        await prisma.spendingInsight.create({
          data: {
            userId,
            insightType: 'comparison',
            type: 'comparison',
            category: topCategory[0],
            title: `Highest Spending: ${topCategory[0]}`,
            description: `You spent $${topCategory[1].toFixed(2)} on ${topCategory[0]} this month.`,
            amount: topCategory[1].toString(),
            period: 'month',
            severity: 'info',
            insightDate: new Date(),
            data: { category: topCategory[0], amount: topCategory[1] },
          },
        });
      }
    } catch (error) {
      logger.error('Error generating spending insights', error, { userId });
    }
  }
}

export default new AIService();

