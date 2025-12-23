/**
 * Non-Custodial Wallet Library
 * Generates wallets, manages keys, and signs transactions client-side
 * Private keys are encrypted with user passwords and NEVER sent to the server
 */

import { mnemonicToSeedSync, generateMnemonic, validateMnemonic, mnemonicToEntropy, entropyToMnemonic } from 'bip39';
import { HDKey } from '@scure/bip32';
import { sha256 } from '@noble/hashes/sha2.js';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';

// Lazy-load tiny-secp256k1 to avoid async wasm warning at build time
let eccInstance: any = null;
let ECPair: any = null;

async function getECPair() {
  if (!ECPair) {
    const ecc = await import('tiny-secp256k1');
    eccInstance = ecc;
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

export interface WalletKey {
  address: string;
  publicKey: string;
  privateKey: string; // In hex format
}

export interface EncryptedWallet {
  encryptedPrivateKey: string;
  encryptedMnemonic: string;
  salt: string;
  iv: string;
  address: string;
  publicKey: string;
}

export interface WalletDerivation {
  blockchain: string;
  address: string;
  publicKey: string;
  derivationPath: string;
}

/**
 * Blockchain derivation path constants (BIP-44)
 */
export const DERIVATION_PATHS = {
  ethereum: "m/44'/60'/0'/0",
  celo: "m/44'/52752'/0'/0",
  polygon: "m/44'/60'/0'/0", // Uses Ethereum derivation
  arbitrum: "m/44'/60'/0'/0", // Uses Ethereum derivation
  optimism: "m/44'/60'/0'/0", // Uses Ethereum derivation
  bitcoin: "m/84'/0'/0'/0", // Native SegWit (Bech32)
  solana: "m/44'/501'/0'/0'",
} as const;

export type SupportedBlockchain = keyof typeof DERIVATION_PATHS;

/**
 * Generate a new mnemonic phrase (12 or 24 words)
 */
export function generateMnemonicPhrase(wordCount: 12 | 24 = 12): string {
  const strength = wordCount === 12 ? 128 : 256;
  return generateMnemonic(strength);
}

/**
 * Validate a mnemonic phrase
 */
export function validateMnemonicPhrase(mnemonic: string): boolean {
  return validateMnemonic(mnemonic);
}

/**
 * Hash mnemonic for verification (stored on server)
 */
export function hashMnemonic(mnemonic: string): string {
  const normalized = mnemonic.trim().toLowerCase();
  const hash = sha256(new TextEncoder().encode(normalized));
  return Buffer.from(hash).toString('hex');
}

/**
 * Derive wallet keys from mnemonic for a specific blockchain
 */
export async function deriveWallet(
  mnemonic: string,
  blockchain: SupportedBlockchain,
  accountIndex: number = 0,
  addressIndex: number = 0
): Promise<WalletKey> {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  // Get base derivation path
  const basePath = DERIVATION_PATHS[blockchain];
  
  // Derive master seed
  const seed = mnemonicToSeedSync(mnemonic);
  const masterKey = HDKey.fromMasterSeed(seed);

  let derivationPath: string;
  let address: string;
  let publicKey: string;
  let privateKey: string;

  switch (blockchain) {
    case 'ethereum':
    case 'celo':
    case 'polygon':
    case 'arbitrum':
    case 'optimism': {
      // EVM chains use same derivation
      derivationPath = `${basePath}/${accountIndex}/${addressIndex}`;
      const derivedKey = masterKey.derive(derivationPath);
      if (!derivedKey.privateKey) {
        throw new Error('Failed to derive private key');
      }
      
      const privateKeyHex = '0x' + Buffer.from(derivedKey.privateKey).toString('hex');
      const wallet = new ethers.Wallet(privateKeyHex);
      address = wallet.address;
      publicKey = wallet.signingKey.publicKey;
      privateKey = wallet.privateKey;
      break;
    }

    case 'bitcoin': {
      // Bitcoin uses BIP84 (Native SegWit)
      derivationPath = `${basePath}/${accountIndex}/${addressIndex}`;
      const derivedKey = masterKey.derive(derivationPath);
      if (!derivedKey.privateKey) {
        throw new Error('Failed to derive private key');
      }

      const ECPairInstance = await getECPair();
      const keyPair = ECPairInstance.fromPrivateKey(Buffer.from(derivedKey.privateKey!), {
        network: bitcoin.networks.bitcoin,
      });
      
      // Convert publicKey to Buffer (ECPair returns Uint8Array)
      const publicKeyBuffer = Buffer.from(keyPair.publicKey);
      
      // Generate native SegWit address (P2WPKH)
      const { address: btcAddress } = bitcoin.payments.p2wpkh({
        pubkey: publicKeyBuffer,
        network: bitcoin.networks.bitcoin,
      });

      address = btcAddress!;
      publicKey = publicKeyBuffer.toString('hex');
      privateKey = Buffer.from(derivedKey.privateKey!).toString('hex');
      break;
    }

    case 'solana': {
      // Solana uses Ed25519
      derivationPath = `${basePath}/${accountIndex}'/${addressIndex}'`;
      const derivedKey = masterKey.derive(derivationPath);
      if (!derivedKey.privateKey) {
        throw new Error('Failed to derive private key');
      }

      // Solana needs 64-byte seed (32 bytes private + 32 bytes public)
      // We use the private key directly for Ed25519
      const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
      
      address = keypair.publicKey.toBase58();
      publicKey = Buffer.from(keypair.publicKey.toBytes()).toString('hex');
      privateKey = Buffer.from(keypair.secretKey).toString('hex');
      break;
    }

    default:
      throw new Error(`Unsupported blockchain: ${blockchain}`);
  }

  return {
    address,
    publicKey,
    privateKey,
  };
}

/**
 * Derive multiple wallets from the same mnemonic for different blockchains
 */
export async function deriveMultipleWallets(
  mnemonic: string,
  blockchains: SupportedBlockchain[],
  accountIndex: number = 0
): Promise<WalletDerivation[]> {
  const wallets = await Promise.all(
    blockchains.map(async (blockchain) => {
      const wallet = await deriveWallet(mnemonic, blockchain, accountIndex);
      const basePath = DERIVATION_PATHS[blockchain];
      
      return {
        blockchain,
        address: wallet.address,
        publicKey: wallet.publicKey,
        derivationPath: `${basePath}/${accountIndex}/0`,
      };
    })
  );
  return wallets;
}

/**
 * Client-side encryption using Web Crypto API
 * Encrypts private keys and mnemonics with user password
 */
export class WalletEncryption {
  /**
   * Derive encryption key from password using PBKDF2
   */
  private static async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
  ): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data (private key or mnemonic) with password
   */
  static async encrypt(
    data: string,
    password: string
  ): Promise<{ encrypted: string; salt: string; iv: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

    const key = await this.deriveKey(password, salt);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      new TextEncoder().encode(data)
    );

    // Convert to base64 for storage
    const encryptedBase64 = btoa(
      String.fromCharCode(...new Uint8Array(encrypted))
    );

    return {
      encrypted: encryptedBase64,
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
    };
  }

  /**
   * Decrypt sensitive data with password
   */
  static async decrypt(
    encrypted: string,
    password: string,
    salt: string,
    iv: string
  ): Promise<string> {
    // Convert from base64
    const encryptedBytes = Uint8Array.from(
      atob(encrypted),
      c => c.charCodeAt(0)
    );
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    const key = await this.deriveKey(password, saltBytes);

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes,
        },
        key,
        encryptedBytes
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt. Wrong password or corrupted data.');
    }
  }
}

/**
 * Store wallet locally (browser or extension)
 */
export async function storeWalletLocally(
  walletId: string,
  encryptedMnemonic: string,
  salt: string,
  iv: string,
  storage: Storage = localStorage
): Promise<void> {
  const walletData = {
    encryptedMnemonic,
    salt,
    iv,
    createdAt: Date.now(),
  };

  storage.setItem(`wallet_${walletId}`, JSON.stringify(walletData));
}

/**
 * Retrieve wallet from local storage
 */
export function getWalletFromLocal(
  walletId: string,
  storage: Storage = localStorage
): {
  encryptedMnemonic: string;
  salt: string;
  iv: string;
  createdAt: number;
} | null {
  const data = storage.getItem(`wallet_${walletId}`);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Remove wallet from local storage
 */
export function removeWalletFromLocal(
  walletId: string,
  storage: Storage = localStorage
): void {
  storage.removeItem(`wallet_${walletId}`);
}

