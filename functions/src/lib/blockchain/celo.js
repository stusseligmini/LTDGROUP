"use strict";
/**
 * Celo Blockchain Client
 * Celo is EVM-compatible, so we can use ethers.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.celoClient = void 0;
const ethereum_1 = require("./ethereum");
const CELO_CONFIG = {
    primary: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    fallbacks: [
        'https://rpc.ankr.com/celo',
        'https://celo-mainnet.infura.io/v3/YOUR-PROJECT-ID',
    ],
    chainId: 42220, // Celo mainnet
};
exports.celoClient = new ethereum_1.EthereumClient(CELO_CONFIG);
