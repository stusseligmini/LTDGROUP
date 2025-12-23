"use strict";
/**
 * Optimism Blockchain Client
 * Optimism is EVM-compatible, uses EthereumClient with Optimism chain ID
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimismClient = void 0;
const ethereum_1 = require("./ethereum");
const OPTIMISM_CONFIG = {
    primary: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    fallbacks: [
        'https://rpc.ankr.com/optimism',
        'https://optimism-mainnet.public.blastapi.io',
    ],
    chainId: 10, // Optimism mainnet
};
exports.optimismClient = new ethereum_1.EthereumClient(OPTIMISM_CONFIG);
exports.default = exports.optimismClient;
