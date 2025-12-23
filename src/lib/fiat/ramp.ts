/**
 * Ramp Network Fiat On-Ramp Integration
 * Alternative to MoonPay for buying crypto with card/bank
 * NO CUSTODY - Ramp sends directly to user's wallet
 */

export interface RampConfig {
  hostApiKey: string;
  hostAppName: string;
  environment?: 'sandbox' | 'production';
}

export interface RampWidgetOptions {
  address: string; // User's Solana address
  defaultAsset?: string; // 'SOL'
  userEmailAddress?: string;
  userLegalName?: string;
  selectedCountryCode?: string; // 'US', 'GB', etc.
  defaultFlow?: 'ONRAMP' | 'OFFRAMP';
  swapAsset?: string;
  swapAmount?: number;
  hostLogoUrl?: string;
  hostAppName?: string;
}

/**
 * Generate Ramp widget configuration
 */
export function getRampWidgetConfig(
  config: RampConfig,
  options: RampWidgetOptions
): {
  url: string;
  hostAppName: string;
  hostLogoUrl?: string;
  variant?: 'mobile' | 'desktop';
} {
  const baseUrl =
    config.environment === 'sandbox'
      ? 'https://app.sandbox.ramp.network'
      : 'https://app.ramp.network';

  const params = new URLSearchParams({
    hostApiKey: config.hostApiKey,
    hostAppName: config.hostAppName,
    userAddress: options.address,
    ...(options.defaultAsset && { defaultAsset: options.defaultAsset }),
    ...(options.userEmailAddress && { userEmailAddress: options.userEmailAddress }),
    ...(options.userLegalName && { userLegalName: options.userLegalName }),
    ...(options.selectedCountryCode && { selectedCountryCode: options.selectedCountryCode }),
    ...(options.defaultFlow && { defaultFlow: options.defaultFlow }),
    ...(options.swapAsset && { swapAsset: options.swapAsset }),
    ...(options.swapAmount && { swapAmount: String(options.swapAmount) }),
  });

  return {
    url: `${baseUrl}?${params.toString()}`,
    hostAppName: config.hostAppName,
    hostLogoUrl: options.hostLogoUrl,
  };
}

/**
 * Ramp widget component props
 */
export interface RampWidgetProps {
  address: string;
  onSuccess?: (purchaseData: any) => void;
  onError?: (error: Error) => void;
}

