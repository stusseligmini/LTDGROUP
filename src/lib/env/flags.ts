export const envFlags = {
  disablePrices: (process.env.NEXT_PUBLIC_DISABLE_PRICES || '').toLowerCase() === 'true',
  disableWss: (process.env.NEXT_PUBLIC_DISABLE_WSS || '').toLowerCase() === 'true',
};

export function isPerfLightMode(): boolean {
  return envFlags.disablePrices || envFlags.disableWss;
}