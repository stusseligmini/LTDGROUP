/**
 * Optimism Blockchain Client
 * Optimism is EVM-compatible, uses EthereumClient with Optimism chain ID
 */

import { EthereumClient, RPCConfig } from './ethereum';

const OPTIMISM_CONFIG: RPCConfig = {
  primary: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  fallbacks: [
    'https://rpc.ankr.com/optimism',
    'https://optimism-mainnet.public.blastapi.io',
  ],
  chainId: 10, // Optimism mainnet
};

export const optimismClient = new EthereumClient(OPTIMISM_CONFIG);
export default optimismClient;

