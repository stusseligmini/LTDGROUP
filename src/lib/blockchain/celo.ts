/**
 * Celo Blockchain Client
 * Celo is EVM-compatible, so we can use ethers.js
 */

import { EthereumClient, RPCConfig } from './ethereum';

const CELO_CONFIG: RPCConfig = {
  primary: process.env.CELO_RPC_URL || 'https://forno.celo.org',
  fallbacks: [
    'https://rpc.ankr.com/celo',
    'https://celo-mainnet.infura.io/v3/YOUR-PROJECT-ID',
  ],
  chainId: 42220, // Celo mainnet
};

export const celoClient = new EthereumClient(CELO_CONFIG);


