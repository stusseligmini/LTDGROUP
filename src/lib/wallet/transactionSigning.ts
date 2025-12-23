/**
 * Client-Side Transaction Signing Library
 * Signs transactions locally without exposing private keys to the server
 */

import { ethers, TransactionRequest } from 'ethers';
import { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import type { WalletKey } from './nonCustodialWallet';

const ECPair = ECPairFactory(ecc);

export interface SignedTransaction {
  signedTx: string; // Serialized signed transaction (hex or base64)
  txHash?: string; // Transaction hash (if available before broadcast)
}

/**
 * Sign an EVM transaction (Ethereum, Celo, Polygon, Arbitrum, Optimism)
 */
export async function signEVMTransaction(
  privateKey: string,
  tx: {
    to: string;
    value: string; // In ETH/CELO/etc units
    data?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    gasPrice?: string;
    nonce?: number;
    chainId: number;
  }
): Promise<SignedTransaction> {
  const wallet = new ethers.Wallet(privateKey);

  // Prepare transaction
  const transaction: TransactionRequest = {
    to: tx.to,
    value: ethers.parseEther(tx.value),
    chainId: tx.chainId,
  };

  if (tx.data) transaction.data = tx.data;
  if (tx.gasLimit) transaction.gasLimit = BigInt(tx.gasLimit);
  if (tx.maxFeePerGas) transaction.maxFeePerGas = BigInt(tx.maxFeePerGas);
  if (tx.maxPriorityFeePerGas) transaction.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas);
  if (tx.gasPrice) transaction.gasPrice = BigInt(tx.gasPrice);
  if (tx.nonce !== undefined) transaction.nonce = tx.nonce;

  // Sign transaction (async method)
  const signedTx = await wallet.signTransaction(transaction);
  
  return {
    signedTx: signedTx,
    txHash: ethers.keccak256(signedTx),
  };
}

/**
 * Sign a Solana transaction
 */
export function signSolanaTransaction(
  privateKey: string, // Hex string of private key
  tx: {
    from: string;
    to: string;
    amount: string; // In SOL units
    recentBlockhash: string;
  }
): SignedTransaction {
  // Convert hex private key to Uint8Array
  const privateKeyBytes = Uint8Array.from(
    Buffer.from(privateKey.replace('0x', ''), 'hex')
  );

  // Create keypair (first 32 bytes are the seed for Ed25519)
  const keypair = Keypair.fromSeed(privateKeyBytes.slice(0, 32));

  // Build transaction
  const transaction = new Transaction();
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(tx.from),
      toPubkey: new PublicKey(tx.to),
      lamports: Math.floor(parseFloat(tx.amount) * LAMPORTS_PER_SOL),
    })
  );

  transaction.recentBlockhash = tx.recentBlockhash;
  transaction.feePayer = new PublicKey(tx.from);

  // Sign transaction
  transaction.sign(keypair);

  // Serialize transaction
  const serialized = transaction.serialize({
    requireAllSignatures: true,
    verifySignatures: false,
  });

  return {
    signedTx: Buffer.from(serialized).toString('base64'),
    txHash: undefined, // Solana hash is calculated after submission
  };
}

/**
 * Sign a Bitcoin transaction
 */
export function signBitcoinTransaction(
  privateKey: string, // Hex string of private key
  tx: {
    utxos: Array<{
      txid: string;
      vout: number;
      value: number; // In satoshis
      scriptPubKey: string; // Hex
    }>;
    to: string;
    amount: number; // In satoshis
    changeAddress?: string;
    feeRate?: number; // Satoshis per byte
    network?: bitcoin.Network;
  }
): SignedTransaction {
  const network = tx.network || bitcoin.networks.bitcoin;

  // Create key pair from private key
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network });

  // Build PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Add inputs
  for (const utxo of tx.utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(utxo.scriptPubKey, 'hex'),
    });
  }

  // Add output
  psbt.addOutput({
    address: tx.to,
    value: tx.amount,
  });

  // Calculate change if needed
  const totalInput = tx.utxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const fee = tx.feeRate 
    ? Math.ceil((tx.utxos.length * 148 + 34 + 10) * tx.feeRate)
    : 10000; // Default 10000 satoshis

  const change = totalInput - tx.amount - fee;
  if (change > 546 && tx.changeAddress) { // Dust threshold
    psbt.addOutput({
      address: tx.changeAddress,
      value: change,
    });
  }

  // Sign all inputs
  for (let i = 0; i < tx.utxos.length; i++) {
    // Create a compatible keypair with Buffer publicKey for PSBT signing
    const bufferKeyPair = {
      ...keyPair,
      publicKey: Buffer.from(keyPair.publicKey),
    };
    psbt.signInput(i, bufferKeyPair as any);
  }

  // Finalize
  psbt.finalizeAllInputs();

  // Extract transaction
  const transaction = psbt.extractTransaction();
  const txHex = transaction.toHex();
  const txHash = transaction.getId();

  return {
    signedTx: txHex,
    txHash,
  };
}

/**
 * Helper: Create a transaction request from wallet key
 */
export function createEVMTransactionRequest(
  walletKey: WalletKey,
  to: string,
  amount: string,
  options?: {
    data?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: number;
    chainId: number;
  }
) {
  if (!options?.chainId) {
    throw new Error('Chain ID is required for EVM transactions');
  }

  return {
    privateKey: walletKey.privateKey,
    tx: {
      to,
      value: amount,
      ...options,
    },
  };
}

