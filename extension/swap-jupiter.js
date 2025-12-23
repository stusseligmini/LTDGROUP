/**
 * Jupiter Swap Integration for Chrome Extension
 * Implements real token swaps using Jupiter v6 API
 */

const JupiterSwap = {
  TOKENS: [
    { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
    { symbol: 'USDT', mint: 'Es9vMFrzaCERZzW1Yw4qF9hQxNxqzqH7h1gW4P3AfkG', decimals: 6 },
  ],

  /**
   * Fetch a swap quote from Jupiter
   */
  async getQuote(fromMint, toMint, amount, slippageBps = 50) {
    try {
      const params = new URLSearchParams({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote from Jupiter');
      }

      return await response.json();
    } catch (error) {
      console.error('Jupiter quote error:', error);
      throw error;
    }
  },

  /**
   * Execute a swap transaction
   */
  async executeSwap(quoteResponse, userPublicKey, signTransaction) {
    try {
      // Build swap transaction
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
        }),
      });

      if (!swapResponse.ok) {
        throw new Error('Failed to build swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();

      // Decode and sign transaction
      const txBuffer = Buffer.from(swapTransaction, 'base64');
      const signedTx = await signTransaction(txBuffer);

      // Send transaction
      const connection = new solanaWeb3.Connection(
        'https://devnet.helius-rpc.com/?api-key=8170da90-466c-4824-9f08-3dd293dd69af'
      );

      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      return { signature, success: true };
    } catch (error) {
      console.error('Jupiter swap execution error:', error);
      throw error;
    }
  },

  /**
   * Format token amount for display
   */
  formatAmount(amount, decimals) {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals === 9 ? 4 : 2);
  },

  /**
   * Convert human-readable amount to lamports/smallest unit
   */
  toBaseUnits(amount, decimals) {
    return Math.floor(Number(amount) * Math.pow(10, decimals));
  },
};

// Export for use in popup-app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JupiterSwap;
} else {
  window.JupiterSwap = JupiterSwap;
}
