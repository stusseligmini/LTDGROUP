/**
 * Priority Fee Optimization for Solana
 * Ensures instant transaction confirmation for gambling use case
 * Gamblers need instant deposits/withdrawals - this handles that
 */

import { Connection, ComputeBudgetProgram } from '@solana/web3.js';

export interface PriorityFeeEstimate {
  minFee: number; // Minimum fee in lamports
  recommendedFee: number; // Recommended fee for instant confirmation
  maxFee: number; // Maximum fee in lamports
  unitPrice: number; // MicroLamports per compute unit
}

export type PriorityLevel = 'low' | 'normal' | 'high' | 'instant';

/**
 * Estimate priority fee based on network congestion
 * Perfect for gambling where instant confirmation is critical
 */
export async function estimatePriorityFee(
  connection: Connection,
  level: PriorityLevel = 'instant'
): Promise<PriorityFeeEstimate> {
  try {
    // Get recent prioritization fees from network
    const fees = await connection.getRecentPrioritizationFees();

    if (!fees || fees.length === 0) {
      // Fallback to default fees if network data unavailable
      return getDefaultPriorityFees(level);
    }

    // Sort fees by amount
    const sortedFees = fees
      .map(f => f.prioritizationFee)
      .sort((a, b) => a - b);

    // Calculate statistics
    const minFee = sortedFees[0];
    const maxFee = sortedFees[sortedFees.length - 1];
    const medianFee = sortedFees[Math.floor(sortedFees.length / 2)];
    const p75Fee = sortedFees[Math.floor(sortedFees.length * 0.75)];
    const p90Fee = sortedFees[Math.floor(sortedFees.length * 0.9)];

    // Calculate recommended fee based on priority level
    let recommendedFee: number;

    switch (level) {
      case 'low':
        recommendedFee = medianFee;
        break;
      case 'normal':
        recommendedFee = p75Fee;
        break;
      case 'high':
        recommendedFee = p90Fee;
        break;
      case 'instant': { // For gambling - want instant confirmation
        // Use p95 percentile + 20% buffer to ensure instant confirmation
        const p95Fee = sortedFees[Math.floor(sortedFees.length * 0.95)];
        recommendedFee = Math.ceil(p95Fee * 1.2);
        break;
      }
      default:
        recommendedFee = p75Fee;
    }

    // Convert to microLamports per compute unit (Helius format)
    // Typical Solana transaction uses ~200,000 compute units
    const computeUnits = 200000;
    const unitPrice = Math.ceil((recommendedFee / computeUnits) * 1000); // Convert to microLamports

    return {
      minFee,
      recommendedFee,
      maxFee,
      unitPrice,
    };
  } catch (error) {
    console.warn('Failed to estimate priority fee, using defaults', error);
    return getDefaultPriorityFees(level);
  }
}

/**
 * Get default priority fees when network data unavailable
 */
function getDefaultPriorityFees(level: PriorityLevel): PriorityFeeEstimate {
  // Default fees in lamports (based on typical Solana network)
  const defaults = {
    low: 1000, // ~0.000001 SOL
    normal: 5000, // ~0.000005 SOL
    high: 10000, // ~0.00001 SOL
    instant: 50000, // ~0.00005 SOL (for gambling)
  };

  const recommendedFee = defaults[level] || defaults.normal;

  return {
    minFee: defaults.low,
    recommendedFee,
    maxFee: defaults.instant,
    unitPrice: Math.ceil((recommendedFee / 200000) * 1000), // ~200k CU default
  };
}

/**
 * Add priority fee to transaction
 */
export function addPriorityFeeToTransaction(
  transaction: any, // Transaction or VersionedTransaction
  feeEstimate: PriorityFeeEstimate
): void {
  // Add compute budget instruction for priority fee
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: feeEstimate.unitPrice,
  });

  // Add to beginning of transaction instructions
  if (transaction.instructions) {
    transaction.instructions = [computeBudgetIx, ...transaction.instructions];
  } else {
    // For VersionedTransaction, add as instruction
    transaction.add(computeBudgetIx);
  }
}

/**
 * Get optimal priority fee for gambling use case
 * Always prioritizes instant confirmation over cost
 */
export async function getGamblingPriorityFee(
  connection: Connection
): Promise<number> {
  const estimate = await estimatePriorityFee(connection, 'instant');
  return estimate.recommendedFee;
}

