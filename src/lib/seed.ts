export function normalizeMnemonic(input: string): string[] {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function isLikelyValidMnemonic(words: string[]): boolean {
  // Use real BIP39 validation with checksum verification
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bip39 = require('bip39');
  const mnemonic = words.join(' ');
  return bip39.validateMnemonic(mnemonic);
}

export function deriveAddressPlaceholder(words: string[]): string {
  // Real BIP39/BIP44 derivation for Solana
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bip39 = require('bip39');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { derivePath } = require('ed25519-hd-key');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Keypair } = require('@solana/web3.js');
  
  const mnemonic = words.join(' ');
  
  // Validate before deriving
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }
  
  // Generate seed from mnemonic
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  
  // Derive keypair using BIP44 path for Solana (m/44'/501'/0'/0')
  const path = `m/44'/501'/0'/0'`;
  const derivedSeed = derivePath(path, seed.toString('hex')).key;
  
  // Create Solana keypair
  const keypair = Keypair.fromSeed(derivedSeed);
  
  return keypair.publicKey.toString();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}