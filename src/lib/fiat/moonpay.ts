/**
 * MoonPay Fiat On-Ramp Integration
 * Allows users to buy crypto with credit card
 * NO CUSTODY - MoonPay sends directly to user's wallet
 */

export interface MoonPayConfig {
  apiKey: string;
  widgetId?: string;
  environment?: 'sandbox' | 'production';
}

export interface MoonPayWidgetOptions {
  address: string; // User's Solana address
  defaultCurrencyCode?: string; // 'usd', 'eur', etc.
  defaultCryptoCurrency?: string; // 'sol'
  colorCode?: string; // Brand color
  paymentMethod?: string; // 'credit_debit_card', 'sepa_bank_transfer', etc.
  lockAmount?: boolean; // Lock crypto amount
  lockCurrency?: boolean; // Lock crypto currency
  walletAddress?: string; // Pre-fill wallet address
}

/**
 * Generate MoonPay widget URL for embedding
 * User buys crypto and it goes directly to their non-custodial wallet
 */
export function getMoonPayWidgetUrl(
  config: MoonPayConfig,
  options: MoonPayWidgetOptions
): string {
  const baseUrl =
    config.environment === 'sandbox'
      ? 'https://buy-sandbox.moonpay.com'
      : 'https://buy.moonpay.com';

  const params = new URLSearchParams({
    apiKey: config.apiKey,
    walletAddress: options.address,
    defaultCurrencyCode: options.defaultCurrencyCode || 'usd',
    defaultCryptoCurrency: options.defaultCryptoCurrency || 'sol',
    ...(options.colorCode && { colorCode: options.colorCode }),
    ...(options.paymentMethod && { paymentMethod: options.paymentMethod }),
    ...(options.lockAmount && { lockAmount: String(options.lockAmount) }),
    ...(options.lockCurrency && { lockCurrency: String(options.lockCurrency) }),
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * MoonPay widget component props
 */
export interface MoonPayWidgetProps {
  address: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

