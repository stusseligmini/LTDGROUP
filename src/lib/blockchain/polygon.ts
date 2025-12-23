/**
 * Polygon Blockchain Client
 * Polygon is EVM-compatible, uses EthereumClient with Polygon chain ID
 */

import { EthereumClient, RPCConfig } from './ethereum';

const POLYGON_CONFIG: RPCConfig = {
  primary: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  fallbacks: [
    'https://rpc.ankr.com/polygon',
    'https://polygon-mainnet.public.blastapi.io',
  ],
  chainId: 137, // Polygon mainnet
};

export const polygonClient = new EthereumClient(POLYGON_CONFIG);
export default polygonClient;

