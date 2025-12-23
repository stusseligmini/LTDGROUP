/**
 * Fraud Detection Service
 * Real-time fraud detection for card transactions and crypto transfers
 * Implements velocity checks, geo-validation, and anomaly detection
 */

import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

export interface FraudCheckRequest {
  userId: string;
  amount: number;
  amountUsd: number;
  type: 'card' | 'crypto' | 'swap';
  cardId?: string;
  merchantCountry?: string;
  merchantCategory?: string; // MCC code
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export interface FraudCheckResult {
  allowed: boolean;
  riskScore: number; // 0-100, where 100 is highest risk
  flags: string[];
  reason?: string;
  requiresReview?: boolean;
}

// Configuration
const VELOCITY_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_TXS_PER_MINUTE = 3;
const MAX_AMOUNT_PER_HOUR = 5000; // USD
const NIGHT_HOURS_START = 2; // 2 AM
const NIGHT_HOURS_END = 6; // 6 AM
const SUSPICIOUS_MCC_CODES = [
  '5816', // Digital goods - games
  '5967', // Direct marketing - inbound teleservices
  '7995', // Gambling
];

/**
 * Check transaction for fraud indicators
 */
export async function checkFraud(request: FraudCheckRequest): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    // 1. Velocity check - transactions per minute
    const velocityResult = await checkVelocity(request.userId, VELOCITY_WINDOW_MS);
    if (velocityResult.count >= MAX_TXS_PER_MINUTE) {
      flags.push('VELOCITY_EXCEEDED');
      riskScore += 40;
    }

    // 2. Large spike check - compare to user's average
    const spikeResult = await checkLargeSpike(request.userId, request.amountUsd);
    if (spikeResult.isSpike) {
      flags.push('LARGE_SPIKE');
      riskScore += 30;
    }

    // 3. Night pattern anomaly
    const isNightTransaction = checkNightPattern();
    if (isNightTransaction) {
      flags.push('NIGHT_TRANSACTION');
      riskScore += 15;
    }

    // 4. Card-specific checks
    if (request.type === 'card' && request.cardId) {
      // Check merchant country mismatch
      const geoResult = await checkGeoMismatch(request.userId, request.merchantCountry);
      if (geoResult.isMismatch) {
        flags.push('GEO_MISMATCH');
        riskScore += 35;
      }

      // Check suspicious MCC code
      if (request.merchantCategory && SUSPICIOUS_MCC_CODES.includes(request.merchantCategory)) {
        flags.push('SUSPICIOUS_MERCHANT');
        riskScore += 20;
      }
    }

    // 5. Device fingerprint mismatch
    if (request.deviceFingerprint) {
      const deviceResult = await checkDeviceFingerprint(request.userId, request.deviceFingerprint);
      if (deviceResult.isNewDevice) {
        flags.push('NEW_DEVICE');
        riskScore += 10;
      }
    }

    // 6. Hourly spending limit check
    const hourlySpend = await getHourlySpending(request.userId);
    if (hourlySpend + request.amountUsd > MAX_AMOUNT_PER_HOUR) {
      flags.push('HOURLY_LIMIT_EXCEEDED');
      riskScore += 25;
    }

    // Determine if transaction should be allowed
    const allowed = riskScore < 70; // Threshold for auto-decline
    const requiresReview = riskScore >= 50 && riskScore < 70; // Manual review range

    // Log fraud check result
    await logFraudCheck(request, {
      allowed,
      riskScore,
      flags,
      requiresReview,
    });

    logger.info('Fraud check completed', {
      userId: request.userId,
      amount: request.amountUsd,
      riskScore,
      flags,
      allowed,
      requiresReview,
    });

    return {
      allowed,
      riskScore,
      flags,
      reason: !allowed ? flags.join(', ') : undefined,
      requiresReview,
    };
  } catch (error) {
    logger.error('Fraud check failed', error);

    // Fail-safe: If fraud check fails, deny for security
    return {
      allowed: false,
      riskScore: 100,
      flags: ['FRAUD_CHECK_ERROR'],
      reason: 'Unable to verify transaction safety',
    };
  }
}

/**
 * Check transaction velocity (# of transactions in time window)
 */
async function checkVelocity(userId: string, windowMs: number): Promise<{ count: number }> {
  const since = new Date(Date.now() - windowMs);

  const count = await prisma.transaction.count({
    where: {
      wallet: { userId },
      timestamp: { gte: since },
      status: { in: ['pending', 'confirmed', 'completed'] },
    },
  });

  return { count };
}

/**
 * Check if transaction is significantly larger than user's average
 */
async function checkLargeSpike(
  userId: string,
  currentAmount: number
): Promise<{ isSpike: boolean; averageAmount: number }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const aggregate = await prisma.transaction.aggregate({
    where: {
      wallet: { userId },
      timestamp: { gte: thirtyDaysAgo },
      status: { in: ['confirmed', 'completed'] },
      amountUsd: { not: null },
    },
    _avg: { amountUsd: true },
  });

  const averageAmount = Number(aggregate._avg.amountUsd) || 0;
  
  // Spike if current amount is 5x average
  const isSpike = averageAmount > 0 && currentAmount > averageAmount * 5;

  return { isSpike, averageAmount };
}

/**
 * Check if transaction occurs during night hours (2 AM - 6 AM local time)
 */
function checkNightPattern(): boolean {
  const hour = new Date().getHours();
  return hour >= NIGHT_HOURS_START && hour < NIGHT_HOURS_END;
}

/**
 * Check for geolocation mismatch
 */
async function checkGeoMismatch(
  userId: string,
  merchantCountry?: string
): Promise<{ isMismatch: boolean }> {
  if (!merchantCountry) return { isMismatch: false };

  // Get user's typical countries from past transactions
  const recentTransactions = await prisma.cardTransaction.findMany({
    where: {
      card: { userId },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { merchantCountry: true },
    take: 50,
  });

  const typicalCountries = new Set(
    recentTransactions.map((tx) => tx.merchantCountry).filter(Boolean)
  );

  // Mismatch if merchant country is not in user's typical countries
  const isMismatch = typicalCountries.size > 0 && !typicalCountries.has(merchantCountry);

  return { isMismatch };
}

/**
 * Check device fingerprint
 */
async function checkDeviceFingerprint(
  userId: string,
  deviceFingerprint: string
): Promise<{ isNewDevice: boolean }> {
  // Check if device fingerprint has been used before
  const existingSession = await prisma.session.findFirst({
    where: {
      userId,
      userAgent: { contains: deviceFingerprint },
    },
  });

  return { isNewDevice: !existingSession };
}

/**
 * Get total spending in the last hour
 */
async function getHourlySpending(userId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const aggregate = await prisma.transaction.aggregate({
    where: {
      wallet: { userId },
      timestamp: { gte: oneHourAgo },
      status: { in: ['pending', 'confirmed', 'completed'] },
      amountUsd: { not: null },
    },
    _sum: { amountUsd: true },
  });

  return Number(aggregate._sum.amountUsd) || 0;
}

/**
 * Log fraud check to FraudAlert table
 */
async function logFraudCheck(
  request: FraudCheckRequest,
  result: FraudCheckResult
): Promise<void> {
  try {
    await prisma.fraudAlert.create({
      data: {
        userId: request.userId,
        alertType: request.type || 'crypto',
        severity: result.riskScore >= 70 ? 'high' : result.riskScore >= 50 ? 'medium' : 'low',
        description: `Fraud check: ${result.reason || 'Transaction analyzed'}. Flags: ${result.flags.join(', ')}`,
        amount: request.amountUsd,
        ruleTriggered: result.flags.join(', '),
        status: result.allowed ? 'resolved' : 'pending',
        resolvedAt: result.allowed ? new Date() : null,
        metadata: {
          riskScore: result.riskScore,
          flags: result.flags,
          merchantCountry: request.merchantCountry,
          merchantCategory: request.merchantCategory,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          deviceFingerprint: request.deviceFingerprint,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log fraud check', error);
  }
}

/**
 * Get fraud alerts for a user
 */
export async function getUserFraudAlerts(userId: string): Promise<any[]> {
  return prisma.fraudAlert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
