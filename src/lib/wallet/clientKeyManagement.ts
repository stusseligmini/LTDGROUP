/**
 * 🔐 NON-CUSTODIAL WALLET - CLIENT-SIDE KEY MANAGEMENT
 * 
 * CRITICAL RULES:
 * 1. Private keys NEVER leave the user's device
 * 2. Seed phrases NEVER sent to server
 * 3. All encryption happens CLIENT-SIDE only
 * 4. Server only stores PUBLIC addresses
 * 
 * This file handles:
 * - Seed phrase generation (BIP39)
 * - Key derivation (BIP32/BIP44)
 * - Local encrypted storage
 * - Transaction signing (client-side)
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import * as ethers from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

// Derivation paths for different blockchains
export const DERIVATION_PATHS = {
  solana: "m/44'/501'/0'/0'", // Solana (SOL)
  ethereum: "m/44'/60'/0'/0/0", // Ethereum (ETH)
  bitcoin: "m/44'/0'/0'/0/0",   // Bitcoin (BTC)
  celo: "m/44'/52752'/0'/0/0",  // Celo
} as const;

export type SupportedBlockchain = keyof typeof DERIVATION_PATHS;

/**
 * Storage keys for encrypted wallet data
 * Data is encrypted with user's password using AES-GCM
 */
const STORAGE_KEYS = {
  ENCRYPTED_MNEMONIC: 'celora_encrypted_mnemonic',
  WALLET_ADDRESSES: 'celora_wallet_addresses',
  SETTINGS: 'celora_wallet_settings',
} as const;

/**
 * Generate a new 12-word seed phrase
 * 
 * ⚠️ NEVER send this to server!
 * Show it to user ONCE, make them write it down
 */
export function generateSeedPhrase(): string {
  return generateMnemonic(128); // 12 words
}

/**
 * Validate a seed phrase
 */
export function isValidSeedPhrase(mnemonic: string): boolean {
  return validateMnemonic(mnemonic);
}

/**
 * Derive keypair for Solana from seed phrase
 * 
 * This happens CLIENT-SIDE only!
 */
export function deriveSolanaKeypair(mnemonic: string, accountIndex: number = 0): Keypair {
  const seed = mnemonicToSeedSync(mnemonic);
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const derivedSeed = derivePath(path, seed.toString('hex')).key;
  return Keypair.fromSeed(derivedSeed);
}

/**
 * Derive keypair for Ethereum/Celo from seed phrase
 */
export function deriveEthereumKeypair(
  mnemonic: string,
  blockchain: 'ethereum' | 'celo' = 'ethereum',
  accountIndex: number = 0
): ethers.HDNodeWallet {
  const path = blockchain === 'celo' 
    ? `m/44'/52752'/0'/0/${accountIndex}`
    : `m/44'/60'/0'/0/${accountIndex}`;
  
  return ethers.HDNodeWallet.fromPhrase(mnemonic, path);
}

/**
 * Derive keypair for Bitcoin from seed phrase
 */
export function deriveBitcoinKeypair(
  mnemonic: string,
  accountIndex: number = 0
): { privateKey: Buffer; publicKey: Buffer; address: string } {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const path = `m/44'/0'/0'/0/${accountIndex}`;
  const child = root.derivePath(path);
  
  if (!child.privateKey) {
    throw new Error('Failed to derive Bitcoin private key');
  }
  
  const keyPair = ECPair.fromPrivateKey(child.privateKey);
  const { address } = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network: bitcoin.networks.bitcoin,
  });
  
  if (!address) {
    throw new Error('Failed to generate Bitcoin address');
  }
  
  return {
    privateKey: Buffer.from(child.privateKey),
    publicKey: Buffer.from(keyPair.publicKey),
    address,
  };
}

/**
 * Encrypt seed phrase with user password (CLIENT-SIDE)
 * 
 * Uses Web Crypto API (browser) or equivalent (mobile)
 * Never send the encrypted result to server either!
 */
export async function encryptSeedPhrase(
  mnemonic: string,
  password: string
): Promise<string> {
  // Derive key from password using PBKDF2
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Generate salt
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  // Derive AES key
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt mnemonic
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(mnemonic)
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt seed phrase with user password (CLIENT-SIDE)
 */
export async function decryptSeedPhrase(
  encryptedMnemonic: string,
  password: string
): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedMnemonic), c => c.charCodeAt(0));

  // Extract salt, iv, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);

  // Derive key from password
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES key
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Decrypt
  const decryptedData = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedData
  );

  return new TextDecoder().decode(decryptedData);
}

/**
 * Store encrypted seed phrase in browser localStorage
 * 
 * ⚠️ For production, use IndexedDB or browser extension secure storage
 * ⚠️ On mobile, use Secure Enclave (iOS) or Keystore (Android)
 */
export function saveEncryptedSeedPhrase(encryptedMnemonic: string): void {
  if (typeof window === 'undefined') {
    throw new Error('Cannot save seed phrase on server!');
  }
  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_MNEMONIC, encryptedMnemonic);
}

/**
 * Load encrypted seed phrase from storage
 */
export function loadEncryptedSeedPhrase(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
}

/**
 * Delete wallet from local storage
 * Used when user logs out or resets wallet
 */
export function deleteLocalWallet(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
  localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESSES);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
}

/**
 * Check if user has a wallet stored locally
 */
export function hasLocalWallet(): boolean {
  return loadEncryptedSeedPhrase() !== null;
}

/**
 * Generate all wallet addresses from seed phrase
 * Returns PUBLIC addresses only (safe to send to server)
 */
export function deriveAllAddresses(mnemonic: string): {
  solana: string;
  ethereum: string;
  bitcoin: string;
  celo: string;
} {
  const solanaKeypair = deriveSolanaKeypair(mnemonic);
  const ethereumWallet = deriveEthereumKeypair(mnemonic, 'ethereum');
  const bitcoinKeypair = deriveBitcoinKeypair(mnemonic);
  const celoWallet = deriveEthereumKeypair(mnemonic, 'celo');

  return {
    solana: solanaKeypair.publicKey.toBase58(),
    ethereum: ethereumWallet.address,
    bitcoin: bitcoinKeypair.address,
    celo: celoWallet.address,
  };
}

/**
 * USAGE EXAMPLE:
 * 
 * // 1. User creates wallet
 * const mnemonic = generateSeedPhrase();
 * // Show mnemonic to user, make them write it down!
 * 
 * // 2. User sets password
 * const encrypted = await encryptSeedPhrase(mnemonic, "user_password_123");
 * saveEncryptedSeedPhrase(encrypted);
 * 
 * // 3. Derive addresses and send to server (PUBLIC data only!)
 * const addresses = deriveAllAddresses(mnemonic);
 * await fetch('/api/wallet/register', {
 *   method: 'POST',
 *   body: JSON.stringify({ addresses }) // ✅ Safe - no private keys!
 * });
 * 
 * // 4. Later: User wants to send transaction
 * const encrypted = loadEncryptedSeedPhrase();
 * const mnemonic = await decryptSeedPhrase(encrypted, "user_password_123");
 * const solanaKeypair = deriveSolanaKeypair(mnemonic);
 * // Sign transaction CLIENT-SIDE with solanaKeypair
 */
