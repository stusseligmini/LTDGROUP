/**
 * Client Key Management Wrapper
 * Provides a stable API over existing non-custodial wallet utilities.
 * Ensures mnemonic handling is centralized & never leaked to logs/UI.
 */

import {
  generateMnemonicPhrase,
  validateMnemonicPhrase,
  deriveWallet,
  deriveMultipleWallets,
  WalletEncryption,
  storeWalletLocally,
  getWalletFromLocal,
  removeWalletFromLocal,
  DERIVATION_PATHS,
  type SupportedBlockchain,
} from '@/lib/wallet/nonCustodialWallet';

export { DERIVATION_PATHS, type SupportedBlockchain };

export interface StoredEncryptedMnemonic {
  encryptedMnemonic: string;
  salt: string;
  iv: string;
  createdAt: number;
}

export interface DerivedAddressResult {
  blockchain: SupportedBlockchain;
  address: string;
  publicKey: string;
  derivationPath: string;
}

/** Generate mnemonic (12 or 24 words). */
export function generateMnemonic(words: 12 | 24 = 12): string {
  return generateMnemonicPhrase(words);
}

/** Validate mnemonic phrase. */
export function validateMnemonic(mnemonic: string): boolean {
  return validateMnemonicPhrase(mnemonic);
}

/** Derive a single address for a blockchain. */
export async function deriveAddress(
  mnemonic: string,
  blockchain: SupportedBlockchain,
  accountIndex: number = 0,
  addressIndex: number = 0
): Promise<DerivedAddressResult> {
  const w = await deriveWallet(mnemonic, blockchain, accountIndex, addressIndex);
  const basePath = DERIVATION_PATHS[blockchain];
  const derivationPath = blockchain === 'solana'
    ? `${basePath}/${accountIndex}'/${addressIndex}'`
    : `${basePath}/${accountIndex}/${addressIndex}`;
  return {
    blockchain,
    address: w.address,
    publicKey: w.publicKey,
    derivationPath,
  };
}

/** Derive multiple addresses (one per blockchain). */
export async function deriveMultiple(
  mnemonic: string,
  blockchains: SupportedBlockchain[],
  accountIndex: number = 0
): Promise<DerivedAddressResult[]> {
  return Promise.all(blockchains.map(bc => deriveAddress(mnemonic, bc, accountIndex, 0)));
}

/** Encrypt mnemonic with user password. */
export async function encryptMnemonic(
  mnemonic: string,
  password: string
): Promise<{ encrypted: string; salt: string; iv: string }> {
  const enc = await WalletEncryption.encrypt(mnemonic, password);
  return { encrypted: enc.encrypted, salt: enc.salt, iv: enc.iv };
}

/** Decrypt mnemonic with password. */
export async function decryptMnemonic(
  encrypted: string,
  password: string,
  salt: string,
  iv: string
): Promise<string> {
  return WalletEncryption.decrypt(encrypted, password, salt, iv);
}

/** Store encrypted mnemonic locally (never server-side). */
export function storeEncryptedMnemonic(
  walletId: string,
  encrypted: string,
  salt: string,
  iv: string,
  storage: Storage = localStorage
): void {
  storeWalletLocally(walletId, encrypted, salt, iv, storage);
}

/** Load encrypted mnemonic record for wallet. */
export function loadEncryptedMnemonic(
  walletId: string,
  storage: Storage = localStorage
): StoredEncryptedMnemonic | null {
  const data = getWalletFromLocal(walletId, storage);
  return data ? { ...data } : null;
}

/** Remove encrypted mnemonic (logout / wallet delete). */
export function removeEncryptedMnemonic(
  walletId: string,
  storage: Storage = localStorage
): void {
  removeWalletFromLocal(walletId, storage);
}

/** Safely derive public address from stored encrypted mnemonic without returning mnemonic. */
export async function getPublicAddressFromEncrypted(
  walletId: string,
  password: string,
  blockchain: SupportedBlockchain,
  storage: Storage = localStorage
): Promise<DerivedAddressResult | null> {
  const record = loadEncryptedMnemonic(walletId, storage);
  if (!record) return null;
  const mnemonic = await decryptMnemonic(
    record.encryptedMnemonic || (record as any).encryptedMnemonic || (record as any).encrypted,
    password,
    record.salt,
    record.iv
  );
  // Derive first address
  return await deriveAddress(mnemonic, blockchain, 0, 0);
}

/** Convenience: derive Solana address directly. */
export async function getSolanaAddress(
  walletId: string,
  password: string,
  storage: Storage = localStorage
): Promise<string | null> {
  const res = await getPublicAddressFromEncrypted(walletId, password, 'solana', storage);
  return res?.address || null;
}

/** Redact mnemonic from any object (defensive utility). */
export function redactSensitive<T extends Record<string, any>>(obj: T): T {
  const clone: any = { ...obj };
  for (const k of Object.keys(clone)) {
    if (/mnemonic|seed|private/i.test(k)) clone[k] = '[REDACTED]';
  }
  return clone;
}

/** Basic invariant checks to ensure no accidental mnemonic exposure. */
export function assertNoMnemonicLeak(value: unknown): void {
  if (typeof value === 'string' && /\b[a-z]+\s[a-z]+\s[a-z]+/.test(value) && value.split(' ').length >= 12) {
    throw new Error('Potential mnemonic leak detected');
  }
}
