"use strict";
/**
 * Bitcoin Blockchain Client
 * Uses bitcoinjs-lib for transaction building and signing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bitcoinClient = exports.BitcoinClient = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ecpair_1 = require("ecpair");
const ecc = __importStar(require("tiny-secp256k1"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../logger");
const ECPair = (0, ecpair_1.ECPairFactory)(ecc);
class BitcoinClient {
    constructor(config) {
        this.currentRPCIndex = 0;
        this.isHealthy = true;
        this.config = config;
    }
    getCurrentRPC() {
        const rpcs = [this.config.primary, ...this.config.fallbacks];
        return rpcs[this.currentRPCIndex % rpcs.length];
    }
    async callRPC(method, params) {
        const rpcUrl = this.getCurrentRPC();
        try {
            const response = await axios_1.default.post(rpcUrl, {
                jsonrpc: '2.0',
                id: 1,
                method,
                params,
            }, {
                timeout: 10000,
            });
            if (response.data.error) {
                throw new Error(response.data.error.message);
            }
            this.isHealthy = true;
            return response.data.result;
        }
        catch (error) {
            // Try next RPC
            this.currentRPCIndex++;
            if (this.currentRPCIndex < this.config.fallbacks.length + 1) {
                return this.callRPC(method, params);
            }
            logger_1.logger.error('Bitcoin RPC call failed', error);
            throw error;
        }
    }
    async getBalance(address) {
        try {
            // For Bitcoin, we need to use a block explorer API or full node
            // This is a simplified version - in production, use a proper Bitcoin RPC
            const utxos = await this.getUnspentOutputs(address);
            const total = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
            return (total / 100000000).toString(); // Convert satoshis to BTC
        }
        catch (error) {
            logger_1.logger.error('Failed to get Bitcoin balance', error);
            throw error;
        }
    }
    async getUnspentOutputs(address) {
        try {
            const apiKey = process.env.BLOCKCHAIR_API_KEY || '';
            const network = this.config.testnet ? 'bitcoin/testnet' : 'bitcoin';
            const url = `https://api.blockchair.com/${network}/dashboards/address/${address}${apiKey ? `?key=${apiKey}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Blockchair API error: ${response.statusText}`);
            }
            const data = await response.json();
            const addressData = data.data?.[address];
            if (!addressData || !addressData.utxo) {
                return [];
            }
            return addressData.utxo.map((utxo) => ({
                txid: utxo.transaction_hash,
                vout: utxo.index,
                value: utxo.value,
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get Bitcoin UTXOs', error);
            return [];
        }
    }
    async sendTransaction(fromAddress, toAddress, amount, privateKey, feeRate) {
        try {
            // Get UTXOs for the sender
            const utxos = await this.getUnspentOutputs(fromAddress);
            if (utxos.length === 0) {
                throw new Error('No unspent outputs found');
            }
            // Create key pair from private key
            const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), {
                network: this.config.network,
            });
            // Build transaction
            const psbt = new bitcoin.Psbt({ network: this.config.network });
            // Add inputs
            let totalInput = 0;
            for (const utxo of utxos) {
                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout,
                });
                totalInput += utxo.value;
            }
            // Calculate amount in satoshis
            const amountSatoshis = Math.floor(parseFloat(amount) * 100000000);
            // Estimate fee (or use provided fee rate)
            const estimatedFee = feeRate
                ? Math.ceil((utxos.length * 148 + 34 + 10) * feeRate)
                : 10000; // Default 10000 satoshis
            // Add output
            psbt.addOutput({
                address: toAddress,
                value: amountSatoshis,
            });
            // Add change output if needed
            const change = totalInput - amountSatoshis - estimatedFee;
            if (change > 546) { // Dust threshold
                psbt.addOutput({
                    address: fromAddress,
                    value: change,
                });
            }
            // Sign inputs
            for (let i = 0; i < utxos.length; i++) {
                psbt.signInput(i, keyPair);
            }
            // Finalize and extract transaction
            psbt.finalizeAllInputs();
            const tx = psbt.extractTransaction();
            const txHex = tx.toHex();
            const txHash = tx.getId();
            logger_1.logger.info('Bitcoin transaction created', {
                txHash,
                from: fromAddress,
                to: toAddress,
                amount,
            });
            // Broadcast transaction
            await this.broadcastTransaction(txHex);
            return { txHash, txHex };
        }
        catch (error) {
            logger_1.logger.error('Failed to send Bitcoin transaction', error);
            throw error;
        }
    }
    async broadcastTransaction(txHex) {
        try {
            // Broadcast using RPC
            await this.callRPC('sendrawtransaction', [txHex]);
        }
        catch (error) {
            logger_1.logger.error('Failed to broadcast Bitcoin transaction', error);
            throw error;
        }
    }
    async getTransaction(txHash) {
        try {
            // Use RPC to get transaction
            const tx = await this.callRPC('gettransaction', [txHash]);
            if (!tx)
                return null;
            return {
                confirmations: tx.confirmations || 0,
                blockNumber: tx.blockheight,
                status: tx.confirmations > 0 ? 'confirmed' : 'pending',
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get Bitcoin transaction', error);
            return null;
        }
    }
    async estimateFee(blocks = 6) {
        try {
            // Get fee estimate from RPC
            const feeRate = await this.callRPC('estimatesmartfee', [blocks]);
            return feeRate.feerate || 0.00001; // Default to 10 sat/vB
        }
        catch (error) {
            logger_1.logger.warn('Failed to estimate Bitcoin fee', error);
            return 0.00001; // Default fee rate
        }
    }
    getHealthStatus() {
        return {
            healthy: this.isHealthy,
            currentProvider: this.getCurrentRPC(),
            currentRPC: this.getCurrentRPC(),
        };
    }
}
exports.BitcoinClient = BitcoinClient;
// Mainnet configuration
const BITCOIN_MAINNET_CONFIG = {
    primary: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
    fallbacks: [
        'https://mempool.space/api',
    ],
    network: bitcoin.networks.bitcoin,
};
exports.bitcoinClient = new BitcoinClient(BITCOIN_MAINNET_CONFIG);
