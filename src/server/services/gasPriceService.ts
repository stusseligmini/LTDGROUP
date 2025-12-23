/**
 * Gas Price Management Service
 * Provides dynamic gas price estimation with EIP-1559 support
 */

import { ethereumClient } from '@/lib/blockchain/ethereum';
import { polygonClient } from '@/lib/blockchain/polygon';
import { arbitrumClient } from '@/lib/blockchain/arbitrum';
import { optimismClient } from '@/lib/blockchain/optimism';
import { celoClient } from '@/lib/blockchain/celo';
import { EthereumClient } from '@/lib/blockchain/ethereum';
import { logger } from '@/lib/logger';
import { prisma } from '@/server/db/client';

export interface GasPriceEstimate {
  gasPrice?: bigint; // Legacy gas price
  maxFeePerGas?: bigint; // EIP-1559 max fee
  maxPriorityFeePerGas?: bigint; // EIP-1559 priority fee
  estimatedGasLimit: bigint;
  totalCost: bigint; // Estimated total cost in wei
}

export interface GasPriceCache {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  timestamp: Date;
}

const CACHE_TTL = 30000; // 30 seconds
const gasPriceCache: Map<string, GasPriceCache> = new Map();

export class GasPriceService {
  /**
   * Get gas price estimate for EVM chain
   */
  async getGasPriceEstimate(
    blockchain: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'celo',
    fromAddress: string,
    toAddress: string,
    value: string
  ): Promise<GasPriceEstimate> {
    try {
      // Get appropriate client
      const client = this.getClient(blockchain);
      
      // Check cache first
      const cacheKey = `${blockchain}-${fromAddress}-${toAddress}`;
      const cached = gasPriceCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL) {
        // Use cached values
        const estimatedGas = await client.estimateGas({
          from: fromAddress,
          to: toAddress,
          value: BigInt(value),
        });
        
        return {
          gasPrice: cached.gasPrice,
          maxFeePerGas: cached.maxFeePerGas,
          maxPriorityFeePerGas: cached.maxPriorityFeePerGas,
          estimatedGasLimit: estimatedGas,
          totalCost: this.calculateTotalCost(
            estimatedGas,
            cached.maxFeePerGas || cached.gasPrice || 0n
          ),
        };
      }
      
      // Get fresh fee data
      const feeData = await client.getFeeData();
      
      // Estimate gas limit
      const estimatedGas = await client.estimateGas({
        from: fromAddress,
        to: toAddress,
        value: BigInt(value),
      });
      
      // Cache the fee data
      gasPriceCache.set(cacheKey, {
        gasPrice: feeData.gasPrice ?? undefined,
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
        timestamp: new Date(),
      });
      
      // Calculate total cost
      const totalCost = this.calculateTotalCost(
        estimatedGas,
        feeData.maxFeePerGas || feeData.gasPrice || 0n
      );
      
      logger.debug('Gas price estimate calculated', {
        blockchain,
        estimatedGas: estimatedGas.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
        gasPrice: feeData.gasPrice?.toString(),
        totalCost: totalCost.toString(),
      });
      
      return {
        gasPrice: feeData.gasPrice ?? undefined,
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
        estimatedGasLimit: estimatedGas,
        totalCost,
      };
    } catch (error) {
      logger.error('Failed to estimate gas price', error, {
        blockchain,
        fromAddress,
        toAddress,
      });
      throw error;
    }
  }

  /**
   * Get client for blockchain
   */
  private getClient(blockchain: string): EthereumClient {
    switch (blockchain) {
      case 'ethereum':
        return ethereumClient;
      case 'polygon':
        return polygonClient;
      case 'arbitrum':
        return arbitrumClient;
      case 'optimism':
        return optimismClient;
      case 'celo':
        return celoClient;
      default:
        throw new Error(`Unsupported blockchain for gas estimation: ${blockchain}`);
    }
  }

  /**
   * Calculate total cost (gas limit * gas price)
   */
  private calculateTotalCost(gasLimit: bigint, gasPrice: bigint): bigint {
    return gasLimit * gasPrice;
  }

  /**
   * Get gas price alerts for high fees
   */
  async checkHighGasPrice(
    blockchain: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'celo',
    thresholdGwei?: number
  ): Promise<{ isHigh: boolean; currentPrice: string; threshold: string }> {
    try {
      const client = this.getClient(blockchain);
      const feeData = await client.getFeeData();
      
      // Default thresholds in Gwei
      const thresholds: Record<string, number> = {
        ethereum: 100,
        polygon: 500,
        arbitrum: 1,
        optimism: 1,
        celo: 1,
      };
      
      const threshold = thresholdGwei || thresholds[blockchain] || 100;
      const thresholdWei = BigInt(threshold) * BigInt(10 ** 9);
      
      const currentPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
      const currentGwei = Number(currentPrice) / 10 ** 9;
      
      const isHigh = currentPrice > thresholdWei;
      
      if (isHigh) {
        logger.warn('High gas price detected', {
          blockchain,
          currentGwei,
          threshold,
        });
      }
      
      return {
        isHigh,
        currentPrice: currentGwei.toFixed(2) + ' Gwei',
        threshold: threshold + ' Gwei',
      };
    } catch (error) {
      logger.error('Failed to check gas price', error, { blockchain });
      return {
        isHigh: false,
        currentPrice: 'Unknown',
        threshold: (thresholdGwei || 100).toString() + ' Gwei',
      };
    }
  }

  /**
   * Clear gas price cache
   */
  clearCache(): void {
    gasPriceCache.clear();
    logger.debug('Gas price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: gasPriceCache.size,
      keys: Array.from(gasPriceCache.keys()),
    };
  }
}

export const gasPriceService = new GasPriceService();

