"use strict";
/**
 * Solana Blockchain Client
 * Uses @solana/web3.js for transaction building and signing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.solanaClient = exports.SolanaClient = void 0;
const web3_js_1 = require("@solana/web3.js");
const logger_1 = require("../logger");
class SolanaClient {
    constructor(config) {
        this.connection = null;
        this.fallbackConnections = [];
        this.currentConnectionIndex = 0;
        this.isHealthy = true;
        this.healthCheckInterval = null;
        this.config = config;
        this.initializeConnections();
        this.startHealthCheck();
    }
    initializeConnections() {
        try {
            // Get WebSocket URL from env (Helius devnet)
            const wsEndpoint = process.env.SOLANA_WSS_URL ||
                'wss://devnet.helius-rpc.com/?api-key=' + (process.env.NEXT_PUBLIC_HELIUS_API_KEY || '');
            this.connection = new web3_js_1.Connection(this.config.primary, {
                commitment: 'confirmed',
                wsEndpoint: wsEndpoint,
            });
            this.fallbackConnections = this.config.fallbacks.map(url => new web3_js_1.Connection(url, {
                commitment: 'confirmed',
                wsEndpoint: wsEndpoint,
            }));
            logger_1.logger.info('Solana RPC connections initialized with WebSocket', {
                primary: this.config.primary,
                wsEndpoint: wsEndpoint,
                fallbacks: this.config.fallbacks.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Solana connections', error);
            throw error;
        }
    }
    async checkConnectionHealth(connection) {
        try {
            const slot = await connection.getSlot();
            return slot > 0;
        }
        catch {
            return false;
        }
    }
    async getHealthyConnection() {
        // Check primary first
        if (this.connection && await this.checkConnectionHealth(this.connection)) {
            return this.connection;
        }
        // Try fallbacks
        for (let i = 0; i < this.fallbackConnections.length; i++) {
            const index = (this.currentConnectionIndex + i) % this.fallbackConnections.length;
            const connection = this.fallbackConnections[index];
            if (await this.checkConnectionHealth(connection)) {
                this.currentConnectionIndex = index;
                this.isHealthy = true;
                return connection;
            }
        }
        throw new Error('All Solana RPC connections are unhealthy');
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const connection = await this.getHealthyConnection();
                this.isHealthy = true;
            }
            catch {
                this.isHealthy = false;
                logger_1.logger.warn('Solana RPC health check failed');
            }
        }, 30000);
    }
    async getBalance(address) {
        const connection = await this.getHealthyConnection();
        const publicKey = new web3_js_1.PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / web3_js_1.LAMPORTS_PER_SOL).toString();
    }
    async sendTransaction(fromAddress, toAddress, amount, privateKey) {
        try {
            const connection = await this.getHealthyConnection();
            const fromPubkey = new web3_js_1.PublicKey(fromAddress);
            const toPubkey = new web3_js_1.PublicKey(toAddress);
            // Create keypair from private key
            const keypair = web3_js_1.Keypair.fromSecretKey(privateKey);
            // Build transaction
            const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: Math.floor(parseFloat(amount) * web3_js_1.LAMPORTS_PER_SOL),
            }));
            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;
            // Sign transaction
            transaction.sign(keypair);
            // Send and confirm
            const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [keypair], {
                commitment: 'confirmed',
                maxRetries: 3,
            });
            // Get transaction details
            const tx = await connection.getTransaction(signature, {
                commitment: 'confirmed',
            });
            logger_1.logger.info('Solana transaction sent', {
                txHash: signature,
                from: fromAddress,
                to: toAddress,
                amount,
                slot: tx?.slot,
            });
            return {
                txHash: signature,
                slot: tx?.slot,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to send Solana transaction', error);
            throw error;
        }
    }
    async getTransaction(signature) {
        try {
            const connection = await this.getHealthyConnection();
            const tx = await connection.getTransaction(signature, {
                commitment: 'confirmed',
            });
            if (!tx)
                return null;
            return {
                status: tx.meta?.err ? 'failed' : 'success',
                slot: tx.slot,
                confirmations: tx.slot ? await this.getConfirmations(tx.slot) : undefined,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get Solana transaction', error);
            return null;
        }
    }
    async getConfirmations(slot) {
        try {
            const connection = await this.getHealthyConnection();
            const currentSlot = await connection.getSlot();
            return Math.max(0, currentSlot - slot);
        }
        catch {
            return 0;
        }
    }
    async getLatestBlockhash() {
        const connection = await this.getHealthyConnection();
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        return blockhash;
    }
    getHealthStatus() {
        const connection = this.currentConnectionIndex === 0
            ? this.config.primary
            : this.config.fallbacks[this.currentConnectionIndex - 1];
        return {
            healthy: this.isHealthy,
            currentProvider: connection,
            currentConnection: connection,
        };
    }
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}
exports.SolanaClient = SolanaClient;
// Devnet configuration (for testing with Helius)
const SOLANA_DEVNET_CONFIG = {
    primary: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        'https://devnet.helius-rpc.com/?api-key=' + (process.env.NEXT_PUBLIC_HELIUS_API_KEY || ''),
    fallbacks: [
        'https://api.devnet.solana.com',
    ],
};
exports.solanaClient = new SolanaClient(SOLANA_DEVNET_CONFIG);
