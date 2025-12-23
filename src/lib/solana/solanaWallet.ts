/**
 * Solana-Focused Non-Custodial Wallet Library
 * Optimized for gambling use case with instant transactions
 */

import { Keypair, PublicKey, Connection, Transaction, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { mnemonicToSeedSync } from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { deriveWallet } from '@/lib/wallet/nonCustodialWallet';

/**
 * Public Solana wallet representation (no secret key exposure).
 * keypair is retained for server-side signing contexts only.
 */
export interface SolanaWallet {
  publicKey: PublicKey;
  address: string;
  keypair: Keypair; // do NOT expose secretKey outside controlled flows
}

export interface SolanaTransactionOptions {
  priorityFeeMicroLamports?: number; // Direct microLamports per compute unit (no implicit scaling)
  computeUnitLimit?: number; // Optional CU limit for stability
  maxRetries?: number;
  skipPreflight?: boolean;
}

/**
 * Derive Solana wallet from mnemonic using correct SLIP-0010 Ed25519 path:
 * m/44'/501'/{accountIndex}'/0'
 * Legacy fallback (non-standard) enabled if NEXT_PUBLIC_LEGACY_SOLANA_DERIVATION === 'true'.
 */
export async function deriveSolanaWallet(mnemonic: string, accountIndex: number = 0): Promise<SolanaWallet> {
  const useLegacy = process.env.NEXT_PUBLIC_LEGACY_SOLANA_DERIVATION === 'true';

  if (useLegacy) {
    // Maintain old behavior temporarily (off-spec) via deriveWallet
    const legacy = await deriveWallet(mnemonic, 'solana', accountIndex);
    const legacyBytes = Uint8Array.from(Buffer.from(legacy.privateKey.replace('0x', ''), 'hex'));
    const legacyKeypair = Keypair.fromSeed(legacyBytes.slice(0, 32));
    return {
      publicKey: legacyKeypair.publicKey,
      address: legacyKeypair.publicKey.toBase58(),
      keypair: legacyKeypair,
    };
  }

  const seed = mnemonicToSeedSync(mnemonic); // BIP39 seed buffer
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const { key } = derivePath(path, seed.toString('hex')); // 32-byte ed25519 seed
  const keypair = Keypair.fromSeed(key);

  return {
    publicKey: keypair.publicKey,
    address: keypair.publicKey.toBase58(),
    keypair,
  };
}

/**
 * Solana connection singleton with pooling
 */
let connectionInstance: Connection | null = null;
let connectionConfig: { rpcUrl?: string; wsUrl?: string } = {};

export function getSolanaConnection(rpcUrl?: string, wsUrl?: string): Connection {
  // Use configured RPC URL from environment
  const httpUrl = rpcUrl || 
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
    process.env.SOLANA_RPC_URL ||
    'https://api.mainnet-beta.solana.com';
  
  const websocketUrl = wsUrl ||
    process.env.SOLANA_WSS_URL ||
    'wss://api.mainnet-beta.solana.com';
  
  // Reuse existing connection if config matches
  if (connectionInstance && 
      connectionConfig.rpcUrl === httpUrl && 
      connectionConfig.wsUrl === websocketUrl) {
    return connectionInstance;
  }
  
  // Create new connection if config changed or no instance exists
  connectionInstance = new Connection(httpUrl, {
    commitment: 'confirmed',
    wsEndpoint: websocketUrl,
  });
  connectionConfig = { rpcUrl: httpUrl, wsUrl: websocketUrl };
  
  return connectionInstance;
}

/**
 * Get Solana balance
 */
export async function getSolanaBalance(address: string, connection?: Connection): Promise<number> {
  const conn = connection || getSolanaConnection();
  const publicKey = new PublicKey(address);
  const balance = await conn.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Send SOL with priority fee for instant confirmation
 * Perfect for gambling where speed matters
 */
export async function sendSol(
  fromWallet: SolanaWallet,
  toAddress: string,
  amountSol: number,
  options?: SolanaTransactionOptions
): Promise<{ signature: string }> {
  const connection = getSolanaConnection();
  const toPublicKey = new PublicKey(toAddress);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: toPublicKey,
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    })
  );

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromWallet.publicKey;

  if (options?.computeUnitLimit) {
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: options.computeUnitLimit,
      })
    );
  }

  if (options?.priorityFeeMicroLamports) {
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: options.priorityFeeMicroLamports,
      })
    );
  }

  transaction.sign(fromWallet.keypair);

  const raw = transaction.serialize();
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: options?.skipPreflight || false,
    maxRetries: options?.maxRetries ?? 3,
  });

  await connection.confirmTransaction(signature, 'confirmed');
  return { signature };
}

/**
 * Estimate priority fee for instant confirmation
 * Checks current network congestion and suggests optimal fee
 */
export async function estimatePriorityFeeMicroLamports(
  connection?: Connection
): Promise<number> {
  const conn = connection || getSolanaConnection();
  try {
    const fees = await conn.getRecentPrioritizationFees();
    if (fees?.length) {
      const sorted = fees.map(f => f.prioritizationFee).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return Math.ceil(median * 1.2); // 20% buffer
    }
  } catch (e) {
    console.warn('Priority fee estimation failed', e);
  }
  return 1000; // sensible default microLamports
}

/**
 * Subscribe to account balance changes (WebSocket)
 * Perfect for real-time updates when user wins/loses bets
 */
export function subscribeToBalance(
  address: string,
  callback: (balance: number) => void,
  connection?: Connection
): () => void {
  const conn = connection || getSolanaConnection();
  const publicKey = new PublicKey(address);
  
  // Subscribe to account changes
  const subscriptionId = conn.onAccountChange(
    publicKey,
    (accountInfo) => {
      const balance = accountInfo.lamports / LAMPORTS_PER_SOL;
      callback(balance);
    },
    'confirmed'
  );
  
  // Return unsubscribe function
  return () => {
    conn.removeAccountChangeListener(subscriptionId);
  };
}

/**
 * Subscribe to transaction updates
 * Get real-time transaction confirmations
 */
export function subscribeToSignature(
  signature: string,
  callback: (status: 'pending' | 'confirmed' | 'failed') => void,
  connection?: Connection
): () => void {
  const conn = connection || getSolanaConnection();
  callback('pending');
  const id = conn.onSignature(
    signature,
    (result) => {
      if (result.err) callback('failed');
      else callback('confirmed');
    },
    'confirmed'
  );
  return () => conn.removeSignatureListener(id);
}

/**
 * Build and sign transaction (returns signed transaction for client-side signing)
 */
/**
 * Build unsigned transfer transaction (client-side signing flow).
 */
export async function buildTransferUnsigned(
  fromPubkey: PublicKey,
  toAddress: string,
  amountSol: number,
  options?: { priorityFeeMicroLamports?: number; computeUnitLimit?: number }
): Promise<Transaction> {
  const connection = getSolanaConnection();
  const toPublicKey = new PublicKey(toAddress);
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: toPublicKey,
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    })
  );
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;
  if (options?.computeUnitLimit) {
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: options.computeUnitLimit }));
  }
  if (options?.priorityFeeMicroLamports) {
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: options.priorityFeeMicroLamports }));
  }
  return transaction;
}

/**
 * Broadcast signed transaction (non-custodial)
 */
export async function broadcastSignedTransaction(
  signedTransaction: string | Uint8Array,
  connection?: Connection
): Promise<{ signature: string; slot?: number }> {
  const conn = connection || getSolanaConnection();
  const bytes = typeof signedTransaction === 'string'
    ? Uint8Array.from(atob(signedTransaction), c => c.charCodeAt(0))
    : signedTransaction;
  const signature = await conn.sendRawTransaction(bytes, { skipPreflight: false, maxRetries: 3 });
  await conn.confirmTransaction(signature, 'confirmed');
  const tx = await conn.getTransaction(signature, { commitment: 'confirmed' });
  return { signature, slot: tx?.slot };
}

/**
 * DEPRECATED wrappers (temporary) to avoid immediate breakage.
 */
// Unified export object for ergonomic imports
export const solanaWallet = {
  deriveSolanaWallet,
  getSolanaConnection,
  getSolanaBalance,
  sendSol,
  estimatePriorityFeeMicroLamports,
  buildTransferUnsigned,
  broadcastSignedTransaction,
  subscribeToSignature,
};

