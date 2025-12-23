"use strict";
/**
 * Polygon Blockchain Client
 * Polygon is EVM-compatible, uses EthereumClient with Polygon chain ID
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.polygonClient = void 0;
const ethereum_1 = require("./ethereum");
const POLYGON_CONFIG = {
    primary: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    fallbacks: [
        'https://rpc.ankr.com/polygon',
        'https://polygon-mainnet.public.blastapi.io',
    ],
    chainId: 137, // Polygon mainnet
};
exports.polygonClient = new ethereum_1.EthereumClient(POLYGON_CONFIG);
exports.default = exports.polygonClient;
