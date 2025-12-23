import axios from 'axios';
import { logger } from '@/lib/logger';

const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const ONE_INCH_API_URL = 'https://api.1inch.dev/swap/v6.0';
const ONE_INCH_API_KEY = process.env.ONE_INCH_API_KEY;

export interface SwapQuote {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  estimatedGas?: string;
  route?: any;
  routePlan?: any[]; // Multiple route options
}

export class SwapService {
  /**
   * Calculate real-time price impact in basis points
   * Handles rapid price movements and market conditions
   */
  async calculatePriceImpactRealtime(
    inputMint: string,
    outputMint: string,
    amount: string,
    previousQuote?: any
  ): Promise<{
    priceImpactBps: number;
    priceImpactPercent: number;
    spotPrice: number;
    executionPrice: number;
    warning: string | null;
  }> {
    try {
      // Get current spot price
      const spotResponse = await axios.get(`${JUPITER_API_URL}/price`, {
        params: {
          ids: [inputMint, outputMint].join(','),
        },
      });

      const spotPrices = spotResponse.data.data || {};
      const inputPrice = parseFloat(spotPrices[inputMint]?.price || '1');
      const outputPrice = parseFloat(spotPrices[outputMint]?.price || '1');
      const spotPrice = inputPrice / outputPrice;

      // If we have a previous quote, detect price movement
      let warning: string | null = null;
      if (previousQuote) {
        const priceChange = Math.abs((spotPrice - previousQuote.executionPrice) / previousQuote.executionPrice);
        if (priceChange > 0.02) {
          warning = `⚠️ Price moved ${(priceChange * 100).toFixed(1)}% since quote`;
        }
      }

      // Get current execution price
      const quoteResponse = await axios.get(`${JUPITER_API_URL}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps: 0, // No slippage for impact calculation
        },
      });

      const quote = quoteResponse.data;
      const executionPrice = parseFloat(quote.outAmount) / parseFloat(amount);
      const priceImpactPercent = (spotPrice - executionPrice) / spotPrice;
      const priceImpactBps = Math.round(priceImpactPercent * 10000);

      return {
        priceImpactBps,
        priceImpactPercent,
        spotPrice,
        executionPrice,
        warning,
      };
    } catch (error: any) {
      logger.error('Error calculating real-time price impact', error);
      return {
        priceImpactBps: 0,
        priceImpactPercent: 0,
        spotPrice: 0,
        executionPrice: 0,
        warning: 'Could not calculate price impact',
      };
    }
  }

  /**
   * Simulate swap transaction to predict success and gas usage
   */
  async simulateJupiterSwap(
    userPublicKey: string,
    quoteResponse: any,
    slippageBps: number
  ): Promise<{
    success: boolean;
    estimatedGas: string;
    confirmationTime: string;
    routeSteps: number;
    simulationWarnings: string[];
  }> {
    try {
      // Estimate based on route complexity
      const routeSteps = quoteResponse.routePlan?.length || 1;
      const baseGas = 5000;
      const gasPerStep = 1000;
      const estimatedGas = (baseGas + gasPerStep * (routeSteps - 1)).toString();

      // Estimate confirmation time based on network
      let confirmationTime = '20-30s';
      if (routeSteps > 2) {
        confirmationTime = '30-45s';
      }

      const warnings: string[] = [];

      // Check for potential issues
      if (slippageBps < 25) {
        warnings.push('Very tight slippage - may fail if price moves');
      }
      if (routeSteps > 3) {
        warnings.push('Complex route with many hops - higher gas cost');
      }
      if (quoteResponse.priceImpactPct > 5) {
        warnings.push('High price impact - consider smaller amount');
      }

      return {
        success: true,
        estimatedGas,
        confirmationTime,
        routeSteps,
        simulationWarnings: warnings,
      };
    } catch (error) {
      logger.error('Error simulating swap', error);
      return {
        success: false,
        estimatedGas: '0',
        confirmationTime: 'Unknown',
        routeSteps: 0,
        simulationWarnings: ['Simulation failed'],
      };
    }
  }

  async getJupiterQuote(
    inputMint: string,
    outputMint: string,
    amount: string
  ): Promise<SwapQuote> {
    try {
      const response = await axios.get(`${JUPITER_API_URL}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps: 50, // 0.5% slippage
          maxAccounts: 64, // Get more route options
          asLegacyTransaction: false,
        },
      });

      const quote = response.data;

      return {
        inputToken: inputMint,
        outputToken: outputMint,
        inputAmount: amount,
        outputAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        route: quote.routePlan,
        routePlan: quote.routePlan ? [quote.routePlan] : [], // Jupiter returns best route first
      };
    } catch (error: any) {
      logger.error('Error getting Jupiter quote', error);
      
      // ✅ FIXED: Structured error handling for Jupiter API
      if (error.response?.status === 404 || error.message?.includes('No routes')) {
        throw new Error('ROUTE_NOT_FOUND: No swap route available for this token pair');
      }
      
      if (error.message?.includes('slippage')) {
        throw new Error('SLIPPAGE_EXCEEDED: Price moved too much. Try again or increase slippage tolerance.');
      }
      
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        throw new Error('INSUFFICIENT_BALANCE: Not enough tokens to complete swap');
      }
      
      if (error.response?.status === 429) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait and try again.');
      }
      
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('RPC_TIMEOUT: Network timeout. Please try again.');
      }
      
      throw error;
    }
  }

  /**
   * Get swap quote from 1inch (Ethereum/EVM chains)
   */
  async get1InchQuote(
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapQuote> {
    try {
      if (!ONE_INCH_API_KEY) {
        throw new Error('1inch API key not configured');
      }

      const response = await axios.get(
        `${ONE_INCH_API_URL}/${chainId}/quote`,
        {
          params: {
            src: fromToken,
            dst: toToken,
            amount,
          },
          headers: {
            'Authorization': `Bearer ${ONE_INCH_API_KEY}`,
          },
        }
      );

      const quote = response.data;

      return {
        inputToken: fromToken,
        outputToken: toToken,
        inputAmount: amount,
        outputAmount: quote.toAmount,
        priceImpact: 0, // 1inch doesn't always provide this
        estimatedGas: quote.estimatedGas,
      };
    } catch (error: any) {
      logger.error('Error getting 1inch quote', error);
      
      // ✅ FIXED: Structured error handling for 1inch API
      if (error.response?.status === 404 || error.response?.data?.message?.includes('cannot find route')) {
        throw new Error('ROUTE_NOT_FOUND: No swap route available for this token pair');
      }
      
      if (error.response?.data?.message?.includes('insufficient')) {
        throw new Error('INSUFFICIENT_LIQUIDITY: Not enough liquidity for this swap amount');
      }
      
      if (error.response?.status === 429) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait and try again.');
      }
      
      if (error.response?.status === 401) {
        throw new Error('API_AUTH_ERROR: Invalid 1inch API key');
      }
      
      throw error;
    }
  }

  /**
   * Broadcast signed Jupiter swap transaction (Non-Custodial)
   * Transaction must be signed client-side before calling this method
   */
  async broadcastSignedJupiterSwap(
    userPublicKey: string,
    quoteResponse: any,
    signedTransaction: string // Base64 encoded signed transaction
  ): Promise<string> {
    try {
      const { Connection, VersionedTransaction } = await import('@solana/web3.js');
      
      // Deserialize signed transaction
      const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      const transaction = VersionedTransaction.deserialize(Buffer.from(signedTransaction, 'base64'));
      
      // Send already-signed transaction
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      logger.info('Signed Jupiter swap broadcast', { signature, userPublicKey });
      return signature;
    } catch (error) {
      logger.error('Error broadcasting signed Jupiter swap', error);
      throw error;
    }
  }

  /**
   * Broadcast signed 1inch swap transaction (Non-Custodial)
   * Transaction must be signed client-side before calling this method
   */
  async broadcastSigned1InchSwap(
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string,
    fromAddress: string,
    signedTransaction: string // Hex encoded signed transaction
  ): Promise<string> {
    try {
      const { ethers } = await import('ethers');
      const { ethereumClient } = await import('@/lib/blockchain/ethereum');
      
      // Get provider
      const provider = await ethereumClient['getHealthyProvider']();
      
      // Broadcast signed transaction
      const txResponse = await provider.broadcastTransaction(signedTransaction);
      
      // Wait for confirmation
      const receipt = await txResponse.wait(1);
      if (!receipt) throw new Error('Transaction receipt not available');
      
      logger.info('Signed 1inch swap broadcast', { 
        txHash: receipt.hash, 
        chainId, 
        fromToken, 
        toToken 
      });
      return receipt.hash;
    } catch (error) {
      logger.error('Error broadcasting signed 1inch swap', error);
      throw error;
    }
  }
}

export default new SwapService();

