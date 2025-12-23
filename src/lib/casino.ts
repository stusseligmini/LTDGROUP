/**
 * Unified casino utilities: presets, deposit addresses, helpers
 */

export interface CasinoPreset {
  id: string;
  name: string;
  depositAddress: string;
  network: 'solana';
  currency: 'SOL' | 'USDC';
  minDeposit: number;
  website: string;
  description: string;
  instantDeposit: boolean;
  logo?: string;
  icon?: string;
  tags?: string[];
  verified: boolean;
  category: 'casino' | 'sportsbook' | 'poker' | 'other';
}

export const CASINO_PRESETS: CasinoPreset[] = [
  {
    id: 'stake',
    name: 'Stake.com',
    depositAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    network: 'solana',
    currency: 'SOL',
    minDeposit: 0.05,
    website: 'https://stake.com',
    description: 'Leading crypto casino with sports betting',
    instantDeposit: true,
    icon: '🎲',
    tags: ['casino', 'sports', 'popular'],
    verified: true,
    category: 'casino',
  },
  {
    id: 'roobet',
    name: 'Roobet',
    depositAddress: 'BvzKvn6nUUAYBSrKYxXGxUJ7PhqHjHJqRi9eLcGfSrZ7',
    network: 'solana',
    currency: 'SOL',
    minDeposit: 0.02,
    website: 'https://roobet.com',
    description: 'Popular crypto casino with instant deposits',
    instantDeposit: true,
    icon: '🎰',
    tags: ['casino', 'slots', 'fast'],
    verified: true,
    category: 'casino',
  },
  {
    id: 'rollbit',
    name: 'Rollbit',
    depositAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    network: 'solana',
    currency: 'SOL',
    minDeposit: 0.01,
    website: 'https://rollbit.com',
    description: 'Fast crypto casino and sportsbook with NFT rewards',
    instantDeposit: true,
    icon: '🎯',
    tags: ['casino', 'nft', 'rewards'],
    verified: true,
    category: 'casino',
  },
  {
    id: 'bc-game',
    name: 'BC.Game',
    depositAddress: 'F5RYi7FMPefkc7okJNh21Hcsch7RUaLVr8Rzc8SQqxUb',
    network: 'solana',
    currency: 'SOL',
    minDeposit: 0.01,
    website: 'https://bc.game',
    description: 'Blockchain gaming platform with provably fair games',
    instantDeposit: true,
    icon: '🎮',
    tags: ['casino', 'gaming', 'rewards'],
    verified: true,
    category: 'casino',
  },
  {
    id: 'shuffle',
    name: 'Shuffle',
    depositAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    network: 'solana',
    currency: 'SOL',
    minDeposit: 0.05,
    website: 'https://shuffle.com',
    description: 'Modern crypto casino',
    instantDeposit: true,
    icon: '⭐',
    tags: ['casino', 'modern'],
    verified: true,
    category: 'casino',
  },
];

export function getCasinoById(id: string): CasinoPreset | undefined {
  return CASINO_PRESETS.find(c => c.id === id);
}

export function getCasinoPreset(id: string): CasinoPreset | undefined {
  return getCasinoById(id);
}

export function getCasinosByTag(tag: string): CasinoPreset[] {
  return CASINO_PRESETS.filter(c => c.tags?.includes(tag));
}

export function isCasinoAddress(address: string): CasinoPreset | undefined {
  return CASINO_PRESETS.find(c => c.depositAddress === address);
}

export function getVerifiedPresets(): CasinoPreset[] {
  return CASINO_PRESETS.filter(preset => preset.verified);
}

export function getPresetsByCategory(category: CasinoPreset['category']): CasinoPreset[] {
  return CASINO_PRESETS.filter(preset => preset.category === category && preset.verified);
}

export function searchPresets(query: string): CasinoPreset[] {
  const lowerQuery = query.toLowerCase();
  return CASINO_PRESETS.filter(
    preset =>
      preset.verified &&
      (preset.name.toLowerCase().includes(lowerQuery) ||
        preset.description.toLowerCase().includes(lowerQuery))
  );
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function addCustomCasinoPreset(
  name: string,
  address: string,
  category: CasinoPreset['category'] = 'casino'
): CasinoPreset | null {
  if (!isValidSolanaAddress(address)) return null;
  return {
    id: `custom-${Date.now()}`,
    name,
    depositAddress: address,
    network: 'solana',
    currency: 'SOL',
    minDeposit: 0.01,
    website: '',
    description: `Custom ${category} preset`,
    instantDeposit: false,
    tags: ['custom'],
    verified: false,
    category,
  };
}
