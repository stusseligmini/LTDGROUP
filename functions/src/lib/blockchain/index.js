"use strict";
/**
 * Unified Blockchain Client
 * Routes to appropriate blockchain client based on chain
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainService = exports.BlockchainService = void 0;
const ethereum_1 = require("./ethereum");
const celo_1 = require("./celo");
const polygon_1 = require("./polygon");
const arbitrum_1 = require("./arbitrum");
const optimism_1 = require("./optimism");
const bitcoin_1 = require("./bitcoin");
const solana_1 = require("./solana");
const ethereum_2 = require("./ethereum");
const bitcoin_2 = require("./bitcoin");
const solana_2 = require("./solana");
const encryption_1 = require("../security/encryption");
const logger_1 = require("../logger");
class BlockchainService {
    /**
     * Get blockchain client for a specific chain
     */
    getClient(blockchain) {
        switch (blockchain.toLowerCase()) {
            case 'ethereum':
                return ethereum_1.ethereumClient;
            case 'polygon':
                return polygon_1.polygonClient;
            case 'arbitrum':
                return arbitrum_1.arbitrumClient;
            case 'optimism':
                return optimism_1.optimismClient;
            case 'celo':
                return celo_1.celoClient;
            case 'bitcoin':
                return bitcoin_1.bitcoinClient;
            case 'solana':
                return solana_1.solanaClient;
            default:
                throw new Error(`Unsupported blockchain: ${blockchain}`);
        }
    }
    /**
     * Get balance for an address
     */
    async getBalance(blockchain, address) {
        const client = this.getClient(blockchain);
        if (client instanceof ethereum_2.EthereumClient || client instanceof solana_2.SolanaClient) {
            return await client.getBalance(address);
        }
        else if (client instanceof bitcoin_2.BitcoinClient) {
            return await client.getBalance(address);
        }
        throw new Error(`Balance retrieval not implemented for ${blockchain}`);
    }
    /**
     * Send transaction on blockchain
     */
    async sendTransaction(blockchain, fromAddress, toAddress, amount, privateKeyOrEncrypted, options) {
        try {
            // Decrypt private key if it's encrypted (starts with hex:iv:authTag format)
            let privateKey;
            if (privateKeyOrEncrypted.includes(':')) {
                // Assume it's encrypted
                privateKey = (0, encryption_1.decrypt)(privateKeyOrEncrypted);
            }
            else {
                // Assume it's already decrypted (for hardware wallets, etc.)
                privateKey = privateKeyOrEncrypted;
            }
            const client = this.getClient(blockchain);
            if (client instanceof ethereum_2.EthereumClient) {
                const result = await client.sendTransaction(fromAddress, toAddress, amount, privateKey, options);
                return {
                    txHash: result.txHash,
                    blockNumber: result.blockNumber,
                    status: result.blockNumber ? 'confirmed' : 'pending',
                };
            }
            else if (client instanceof bitcoin_2.BitcoinClient) {
                const result = await client.sendTransaction(fromAddress, toAddress, amount, privateKey, options?.feeRate);
                return {
                    txHash: result.txHash,
                    status: 'pending',
                };
            }
            else if (client instanceof solana_2.SolanaClient) {
                // Convert hex private key to Uint8Array for Solana
                const privateKeyBytes = new Uint8Array(Buffer.from(privateKey.replace('0x', ''), 'hex'));
                const result = await client.sendTransaction(fromAddress, toAddress, amount, privateKeyBytes);
                return {
                    txHash: result.txHash,
                    blockNumber: result.slot,
                    status: 'pending',
                };
            }
            throw new Error(`Transaction sending not implemented for ${blockchain}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send blockchain transaction', error, {
                blockchain,
                fromAddress,
                toAddress,
                amount,
            });
            throw error;
        }
    }
    /**
     * Get transaction status
     */
    async getTransactionStatus(blockchain, txHash) {
        const client = this.getClient(blockchain);
        if (client instanceof ethereum_2.EthereumClient) {
            const receipt = await client.getTransactionReceipt(txHash);
            if (!receipt)
                return null;
            return {
                status: receipt.status,
                confirmations: receipt.confirmations,
                blockNumber: receipt.blockNumber,
            };
        }
        else if (client instanceof bitcoin_2.BitcoinClient) {
            const tx = await client.getTransaction(txHash);
            if (!tx)
                return null;
            return {
                status: tx.status === 'confirmed' ? 'success' : 'pending',
                confirmations: tx.confirmations,
                blockNumber: tx.blockNumber,
            };
        }
        else if (client instanceof solana_2.SolanaClient) {
            const tx = await client.getTransaction(txHash);
            if (!tx)
                return null;
            return {
                status: tx.status === 'success' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending',
                confirmations: tx.confirmations || 0,
                blockNumber: tx.slot,
            };
        }
        return null;
    }
    /**
     * Get health status for all blockchains
     */
    getHealthStatus() {
        return {
            ethereum: ethereum_1.ethereumClient.getHealthStatus(),
            polygon: polygon_1.polygonClient.getHealthStatus(),
            arbitrum: arbitrum_1.arbitrumClient.getHealthStatus(),
            optimism: optimism_1.optimismClient.getHealthStatus(),
            celo: celo_1.celoClient.getHealthStatus(),
            bitcoin: bitcoin_1.bitcoinClient.getHealthStatus(),
            solana: solana_1.solanaClient.getHealthStatus(),
        };
    }
}
exports.BlockchainService = BlockchainService;
exports.blockchainService = new BlockchainService();
