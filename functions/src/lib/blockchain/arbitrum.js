"use strict";
/**
 * Arbitrum Blockchain Client
 * Arbitrum is EVM-compatible, uses EthereumClient with Arbitrum chain ID
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbitrumClient = void 0;
const ethereum_1 = require("./ethereum");
const ARBITRUM_CONFIG = {
    primary: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    fallbacks: [
        'https://rpc.ankr.com/arbitrum',
        'https://arbitrum-mainnet.public.blastapi.io',
    ],
    chainId: 42161, // Arbitrum mainnet
};
exports.arbitrumClient = new ethereum_1.EthereumClient(ARBITRUM_CONFIG);
exports.default = exports.arbitrumClient;
