/**
 * TRANSACTION VERIFICATION UTILITIES
 * 
 * Backend-safe transaction validation
 * Does NOT sign - only verifies signatures
 */

import { Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Verify signed transaction
 * 
 * @param signedTransactionBase64 - Base64 encoded signed transaction
 * @returns Verification result
 */
export function verifySignedTransaction(signedTransactionBase64: string): {
  valid: boolean;
  amount?: number;
  to?: string;
  from?: string;
  error?: string;
} {
  try {
    const txBuffer = Buffer.from(signedTransactionBase64, 'base64');
    const transaction = Transaction.from(txBuffer);
    
    // Verify signatures
    if (!transaction.verifySignatures()) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // Extract transfer instruction
    const transferInstruction = transaction.instructions.find(
      (ix) => ix.programId.toString() === '11111111111111111111111111111111'
    );
    
    if (!transferInstruction) {
      return { valid: false, error: 'No transfer instruction found' };
    }
    
    // Decode amount (last 8 bytes of data)
    const data = transferInstruction.data;
    if (data.length >= 12) {
      const amountBuffer = data.slice(4, 12);
      const amountLamports = Number(amountBuffer.readBigUInt64LE(0));
      const amount = amountLamports / LAMPORTS_PER_SOL;
      
      return {
        valid: true,
        amount,
        from: transferInstruction.keys[0]?.pubkey.toString(),
        to: transferInstruction.keys[1]?.pubkey.toString(),
      };
    }
    
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Transaction verification failed',
    };
  }
}
