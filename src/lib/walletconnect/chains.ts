/**
 * Supported blockchain networks for WalletConnect
 */

export interface ChainConfig {
  id: number;
  name: string;
  namespace: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: string;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  // Ethereum Mainnet
  'eip155:1': {
    id: 1,
    name: 'Ethereum',
    namespace: 'eip155',
    rpcUrl: 'https://eth.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://etherscan.io',
  },

  // Polygon
  'eip155:137': {
    id: 137,
    name: 'Polygon',
    namespace: 'eip155',
    rpcUrl: 'https://polygon-rpc.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    blockExplorer: 'https://polygonscan.com',
  },

  // Arbitrum One
  'eip155:42161': {
    id: 42161,
    name: 'Arbitrum One',
    namespace: 'eip155',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://arbiscan.io',
  },

  // Optimism
  'eip155:10': {
    id: 10,
    name: 'Optimism',
    namespace: 'eip155',
    rpcUrl: 'https://mainnet.optimism.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://optimistic.etherscan.io',
  },

  // Celo
  'eip155:42220': {
    id: 42220,
    name: 'Celo',
    namespace: 'eip155',
    rpcUrl: 'https://forno.celo.org',
    nativeCurrency: {
      name: 'CELO',
      symbol: 'CELO',
      decimals: 18,
    },
    blockExplorer: 'https://explorer.celo.org',
  },

  // Solana Mainnet
  'solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ': {
    id: 1,
    name: 'Solana',
    namespace: 'solana',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    nativeCurrency: {
      name: 'SOL',
      symbol: 'SOL',
      decimals: 9,
    },
    blockExplorer: 'https://explorer.solana.com',
  },
};

/**
 * Get supported methods for each namespace
 */
export const SUPPORTED_METHODS = {
  eip155: [
    'eth_sendTransaction',
    'eth_signTransaction',
    'eth_sign',
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v4',
  ],
  solana: [
    'solana_signTransaction',
    'solana_signMessage',
  ],
};

/**
 * Get supported events for each namespace
 */
export const SUPPORTED_EVENTS = {
  eip155: [
    'chainChanged',
    'accountsChanged',
  ],
  solana: [
    'accountsChanged',
  ],
};

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

/**
 * Format account address for WalletConnect
 */
export function formatAccount(namespace: string, chainId: number, address: string): string {
  return `${namespace}:${chainId}:${address}`;
}

/**
 * Parse WalletConnect account string
 */
export function parseAccount(account: string): { namespace: string; chainId: number; address: string } | null {
  const parts = account.split(':');
  if (parts.length !== 3) {
    return null;
  }

  return {
    namespace: parts[0],
    chainId: parseInt(parts[1], 10),
    address: parts[2],
  };
}

/**
 * Get all supported chain IDs for a namespace
 */
export function getSupportedChainIds(namespace: string): string[] {
  return Object.keys(SUPPORTED_CHAINS).filter(key => key.startsWith(`${namespace}:`));
}

