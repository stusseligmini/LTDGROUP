/**
 * Bitcoin Blockchain Client
 * Uses bitcoinjs-lib for transaction building and signing
 */

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';
import { logger } from '../logger';

const ECPair = ECPairFactory(ecc);

export interface BitcoinRPCConfig {
  primary: string;
  fallbacks: string[];
  network: bitcoin.Network;
  testnet?: boolean;
}

export class BitcoinClient {
  private config: BitcoinRPCConfig;
  private currentRPCIndex = 0;
  private isHealthy = true;

  constructor(config: BitcoinRPCConfig) {
    this.config = config;
  }

  private getCurrentRPC(): string {
    const rpcs = [this.config.primary, ...this.config.fallbacks];
    return rpcs[this.currentRPCIndex % rpcs.length];
  }

  private async callRPC(method: string, params: any[]): Promise<any> {
    const rpcUrl = this.getCurrentRPC();
    
    try {
      const response = await axios.post(rpcUrl, {
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
    } catch (error) {
      // Try next RPC
      this.currentRPCIndex++;
      if (this.currentRPCIndex < this.config.fallbacks.length + 1) {
        return this.callRPC(method, params);
      }
      
      logger.error('Bitcoin RPC call failed', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      // For Bitcoin, we need to use a block explorer API or full node
      // This is a simplified version - in production, use a proper Bitcoin RPC
      const utxos = await this.getUnspentOutputs(address);
      
      const total = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      return (total / 100000000).toString(); // Convert satoshis to BTC
    } catch (error) {
      logger.error('Failed to get Bitcoin balance', error);
      throw error;
    }
  }

  async getUnspentOutputs(address: string): Promise<Array<{ txid: string; vout: number; value: number }>> {
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
      
      return addressData.utxo.map((utxo: any) => ({
        txid: utxo.transaction_hash,
        vout: utxo.index,
        value: utxo.value,
      }));
    } catch (error) {
      logger.error('Failed to get Bitcoin UTXOs', error);
      return [];
    }
  }

  async sendTransaction(
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKey: string,
    feeRate?: number
  ): Promise<{ txHash: string; txHex: string }> {
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
        psbt.signInput(i, keyPair as any);
      }

      // Finalize and extract transaction
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();

      const txHex = tx.toHex();
      const txHash = tx.getId();

      logger.info('Bitcoin transaction created', {
        txHash,
        from: fromAddress,
        to: toAddress,
        amount,
      });

      // Broadcast transaction
      await this.broadcastTransaction(txHex);

      return { txHash, txHex };
    } catch (error) {
      logger.error('Failed to send Bitcoin transaction', error);
      throw error;
    }
  }

  async broadcastTransaction(txHex: string): Promise<void> {
    try {
      // Broadcast using RPC
      await this.callRPC('sendrawtransaction', [txHex]);
    } catch (error) {
      logger.error('Failed to broadcast Bitcoin transaction', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<{
    confirmations: number;
    blockNumber?: number;
    status: 'confirmed' | 'pending';
  } | null> {
    try {
      // Use RPC to get transaction
      const tx = await this.callRPC('gettransaction', [txHash]);
      
      if (!tx) return null;

      return {
        confirmations: tx.confirmations || 0,
        blockNumber: tx.blockheight,
        status: tx.confirmations > 0 ? 'confirmed' : 'pending',
      };
    } catch (error) {
      logger.error('Failed to get Bitcoin transaction', error);
      return null;
    }
  }

  async estimateFee(blocks: number = 6): Promise<number> {
    try {
      // Get fee estimate from RPC
      const feeRate = await this.callRPC('estimatesmartfee', [blocks]);
      return feeRate.feerate || 0.00001; // Default to 10 sat/vB
    } catch (error) {
      logger.warn('Failed to estimate Bitcoin fee', error as any);
      return 0.00001; // Default fee rate
    }
  }

  getHealthStatus(): { healthy: boolean; currentProvider: string; currentRPC: string } {
    return {
      healthy: this.isHealthy,
      currentProvider: this.getCurrentRPC(),
      currentRPC: this.getCurrentRPC(),
    };
  }
}

// Mainnet configuration
const BITCOIN_MAINNET_CONFIG: BitcoinRPCConfig = {
  primary: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
  fallbacks: [
    'https://mempool.space/api',
  ],
  network: bitcoin.networks.bitcoin,
};

export const bitcoinClient = new BitcoinClient(BITCOIN_MAINNET_CONFIG);


