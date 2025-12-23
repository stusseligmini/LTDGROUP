"use strict";
/**
 * Ethereum Blockchain Client
 * Supports Ethereum mainnet and EIP-1559 transactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ethereumClient = exports.EthereumClient = void 0;
const ethers_1 = require("ethers");
const logger_1 = require("../logger");
class EthereumClient {
    constructor(config) {
        this.provider = null;
        this.fallbackProviders = [];
        this.currentProviderIndex = 0;
        this.healthCheckInterval = null;
        this.isHealthy = true;
        this.config = config;
        this.initializeProviders();
        this.startHealthCheck();
    }
    initializeProviders() {
        try {
            this.provider = new ethers_1.JsonRpcProvider(this.config.primary);
            this.fallbackProviders = this.config.fallbacks.map(url => new ethers_1.JsonRpcProvider(url));
            logger_1.logger.info('Ethereum RPC providers initialized', {
                primary: this.config.primary,
                fallbacks: this.config.fallbacks.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Ethereum providers', error);
            throw error;
        }
    }
    async checkProviderHealth(provider) {
        try {
            const blockNumber = await provider.getBlockNumber();
            return blockNumber > 0;
        }
        catch {
            return false;
        }
    }
    async getHealthyProvider() {
        // Check primary first
        if (this.provider && await this.checkProviderHealth(this.provider)) {
            return this.provider;
        }
        // Try fallbacks
        for (let i = 0; i < this.fallbackProviders.length; i++) {
            const index = (this.currentProviderIndex + i) % this.fallbackProviders.length;
            const provider = this.fallbackProviders[index];
            if (await this.checkProviderHealth(provider)) {
                this.currentProviderIndex = index;
                this.isHealthy = true;
                return provider;
            }
        }
        // If all fail, throw error
        throw new Error('All Ethereum RPC providers are unhealthy');
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const provider = await this.getHealthyProvider();
                this.isHealthy = true;
            }
            catch {
                this.isHealthy = false;
                logger_1.logger.warn('Ethereum RPC health check failed');
            }
        }, 30000); // Check every 30 seconds
    }
    async getBalance(address) {
        const provider = await this.getHealthyProvider();
        const balance = await provider.getBalance(address);
        return ethers_1.ethers.formatEther(balance);
    }
    async getTransactionCount(address) {
        const provider = await this.getHealthyProvider();
        return await provider.getTransactionCount(address);
    }
    async estimateGas(tx) {
        const provider = await this.getHealthyProvider();
        return await provider.estimateGas(tx);
    }
    async getProvider() {
        return await this.getHealthyProvider();
    }
    getChainId() {
        return this.config.chainId;
    }
    async getFeeData() {
        const provider = await this.getHealthyProvider();
        return await provider.getFeeData();
    }
    async sendTransaction(fromAddress, toAddress, amount, privateKey, options) {
        const provider = await this.getHealthyProvider();
        const wallet = new ethers_1.Wallet(privateKey, provider);
        // Get nonce
        const nonce = await provider.getTransactionCount(fromAddress, 'pending');
        // Get fee data (EIP-1559)
        const feeData = await this.getFeeData();
        // Build transaction
        const tx = {
            to: toAddress,
            value: ethers_1.ethers.parseEther(amount),
            nonce,
            chainId: this.config.chainId,
        };
        // Use provided gas settings or estimate
        if (options?.gasPrice) {
            tx.gasPrice = options.gasPrice;
        }
        else if (options?.maxFeePerGas && options?.maxPriorityFeePerGas) {
            tx.maxFeePerGas = options.maxFeePerGas;
            tx.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
        }
        else if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            // Use EIP-1559
            tx.maxFeePerGas = feeData.maxFeePerGas;
            tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        }
        else if (feeData.gasPrice) {
            // Fallback to legacy gas price
            tx.gasPrice = feeData.gasPrice;
        }
        // Estimate gas if not provided
        if (!options?.gasLimit) {
            tx.gasLimit = await this.estimateGas(tx);
        }
        else {
            tx.gasLimit = options.gasLimit;
        }
        // Send transaction
        const response = await wallet.sendTransaction(tx);
        logger_1.logger.info('Ethereum transaction sent', {
            txHash: response.hash,
            from: fromAddress,
            to: toAddress,
            amount,
        });
        // Wait for confirmation (optional - can be done async)
        const receipt = await response.wait(1); // Wait for 1 confirmation
        return {
            txHash: response.hash,
            blockNumber: receipt?.blockNumber,
        };
    }
    async getTransactionReceipt(txHash) {
        const provider = await this.getHealthyProvider();
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt)
            return null;
        return {
            status: receipt.status === 1 ? 'success' : 'failed',
            blockNumber: receipt.blockNumber,
            confirmations: await receipt.confirmations(),
            gasUsed: receipt.gasUsed,
        };
    }
    async getBlockNumber() {
        const provider = await this.getHealthyProvider();
        return await provider.getBlockNumber();
    }
    getHealthStatus() {
        return {
            healthy: this.isHealthy,
            currentProvider: this.currentProviderIndex === 0
                ? this.config.primary
                : this.config.fallbacks[this.currentProviderIndex - 1],
        };
    }
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}
exports.EthereumClient = EthereumClient;
// Singleton instances for different EVM chains
const ETHEREUM_CONFIG = {
    primary: process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth',
    fallbacks: [
        'https://eth.llamarpc.com',
        'https://cloudflare-eth.com',
        'https://eth-mainnet.public.blastapi.io',
    ],
    chainId: 1,
};
exports.ethereumClient = new EthereumClient(ETHEREUM_CONFIG);
