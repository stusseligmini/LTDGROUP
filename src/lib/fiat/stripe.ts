/**
 * Stripe Crypto On-Ramp Integration
 * Allows users to buy crypto with credit card via Stripe
 * NO CUSTODY - crypto sent directly to user's wallet
 */

export interface StripeOnRampConfig {
  publishableKey: string;
  environment?: 'test' | 'production';
}

export interface StripeOnRampSession {
  clientSecret: string;
  sessionId: string;
}

export interface StripeOnRampOptions {
  walletAddress: string;
  destinationNetwork: string; // 'solana', 'ethereum', etc.
  destinationCurrency: string; // 'sol', 'usdc', 'eth', etc.
  sourceAmount?: string; // Fiat amount (e.g., '100.00')
  sourceCurrency?: string; // 'usd', 'eur', etc.
}

/**
 * Create Stripe Crypto On-Ramp session
 * Must be called server-side to protect secret key
 */
export async function createStripeOnRampSession(
  options: StripeOnRampOptions,
  secretKey: string
): Promise<StripeOnRampSession> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  }) as any;

  const session = await stripe.crypto.onrampSessions.create({
    wallet_addresses: {
      [options.destinationNetwork]: options.walletAddress,
    },
    transaction_details: {
      destination_currency: options.destinationCurrency,
      destination_network: options.destinationNetwork,
      ...(options.sourceAmount && {
        source_amount: Math.round(parseFloat(options.sourceAmount) * 100), // Convert to cents
      }),
      ...(options.sourceCurrency && {
        source_currency: options.sourceCurrency,
      }),
      lock_wallet_address: true,
    },
  });

  return {
    clientSecret: session.client_secret!,
    sessionId: session.id,
  };
}

/**
 * Get Stripe On-Ramp session status
 */
export async function getStripeOnRampSessionStatus(
  sessionId: string,
  secretKey: string
): Promise<{
  status: string;
  transactionHash?: string;
}> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  }) as any;

  const session = await stripe.crypto.onrampSessions.retrieve(sessionId);

  return {
    status: session.status,
    transactionHash: session.crypto_transaction_id,
  };
}
