/**
 * Arbitrum Blockchain Client
 * Arbitrum is EVM-compatible, uses EthereumClient with Arbitrum chain ID
 */

import { EthereumClient, RPCConfig } from './ethereum';

const ARBITRUM_CONFIG: RPCConfig = {
  primary: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  fallbacks: [
    'https://rpc.ankr.com/arbitrum',
    'https://arbitrum-mainnet.public.blastapi.io',
  ],
  chainId: 42161, // Arbitrum mainnet
};

export const arbitrumClient = new EthereumClient(ARBITRUM_CONFIG);
export default arbitrumClient;

