/**
 * Solana Transaction Signing
 * Builds, signs, and serializes Solana transactions
 * 
 * NOTE: This uses simplified Web Crypto + REST API approach.
 * Production should bundle @solana/web3.js for full transaction support.
 */

(function () {
  'use strict';

  const SolanaSign = {
    /**
     * Get user's Solana address from encrypted wallet
     */
    async getSolanaAddress(password) {
      try {
        // Load encrypted seed
        const encryptedSeed = await WalletStore.loadEncryptedSeed();
        if (!encryptedSeed) {
          throw new Error('No wallet found. Create or import wallet first.');
        }

        // Decrypt seed
        const mnemonic = await WalletCrypto.decryptSeed(encryptedSeed, password);

        // Derive Solana address
        const { address } = await SolanaKeys.deriveAddress(mnemonic);

        return address;
      } catch (error) {
        console.error('[SolanaSign] Get address failed:', error);
        throw error;
      }
    },

    /**
     * Build and sign transfer transaction
     */
    async signTransfer(params) {
      const { password, toAddress, amount, network = 'devnet' } = params;

      try {
        // Validate inputs
        if (!toAddress || !amount || amount <= 0) {
          throw new Error('Invalid transfer parameters');
        }

        // Load and decrypt mnemonic
        const encryptedSeed = await WalletStore.loadEncryptedSeed();
        if (!encryptedSeed) {
          throw new Error('No wallet found');
        }

        const mnemonic = await WalletCrypto.decryptSeed(encryptedSeed, password);

        // Derive keypair
        const { address: fromAddress } = await SolanaKeys.deriveAddress(mnemonic);

        // Get RPC endpoint
        const rpcUrl = this._getRpcUrl(network);

        // Fetch recent blockhash
        const blockhash = await this._getRecentBlockhash(rpcUrl);

        // Build transaction message
        const transaction = {
          recentBlockhash: blockhash,
          feePayer: fromAddress,
          instructions: [
            {
              programId: '11111111111111111111111111111111', // System Program
              keys: [
                { pubkey: fromAddress, isSigner: true, isWritable: true },
                { pubkey: toAddress, isSigner: false, isWritable: true }
              ],
              data: this._encodeTransferInstruction(amount)
            }
          ]
        };

        // Serialize transaction
        const message = this._serializeMessage(transaction);

        // Sign transaction
        const signature = await SolanaKeys.signTransaction(mnemonic, message);

        // Encode signed transaction
        const signedTx = this._encodeSignedTransaction(transaction, signature);

        return {
          signedTransaction: signedTx,
          signature: this._uint8ArrayToBase58(signature),
          fromAddress,
          toAddress,
          amount,
          blockhash
        };
      } catch (error) {
        console.error('[SolanaSign] Sign transfer failed:', error);
        throw error;
      }
    },

    /**
     * Broadcast signed transaction to network
     */
    async sendSignedTransaction(signedTransaction, network = 'devnet') {
      try {
        const rpcUrl = this._getRpcUrl(network);

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendTransaction',
            params: [
              signedTransaction,
              { encoding: 'base64', preflightCommitment: 'confirmed' }
            ]
          })
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'Transaction broadcast failed');
        }

        return data.result; // Transaction signature
      } catch (error) {
        console.error('[SolanaSign] Broadcast failed:', error);
        throw error;
      }
    },

    /**
     * Get Solana RPC URL for network
     */
    _getRpcUrl(network) {
      const urls = {
        devnet: 'https://api.devnet.solana.com',
        mainnet: 'https://api.mainnet-beta.solana.com'
      };
      return urls[network] || urls.devnet;
    },

    /**
     * Fetch recent blockhash from RPC
     */
    async _getRecentBlockhash(rpcUrl) {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestBlockhash',
          params: [{ commitment: 'confirmed' }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error('Failed to fetch blockhash');
      }

      return data.result.value.blockhash;
    },

    /**
     * Encode transfer instruction data
     */
    _encodeTransferInstruction(lamports) {
      // System Program Transfer instruction: [2, 0, 0, 0] + u64 lamports
      const data = new Uint8Array(12);
      data[0] = 2; // Transfer instruction discriminator
      
      const view = new DataView(data.buffer);
      // Convert SOL to lamports (1 SOL = 1e9 lamports)
      const lamportsBigInt = BigInt(Math.floor(lamports * 1e9));
      view.setBigUint64(4, lamportsBigInt, true); // Little-endian

      return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Serialize transaction message
     */
    _serializeMessage(transaction) {
      // Simplified serialization (production needs full Solana wire format)
      const message = JSON.stringify(transaction);
      return new TextEncoder().encode(message);
    },

    /**
     * Encode signed transaction
     */
    _encodeSignedTransaction(transaction, signature) {
      // Simplified encoding (production needs proper compact-array format)
      const payload = {
        transaction: transaction,
        signature: Array.from(signature)
      };
      return btoa(JSON.stringify(payload));
    },

    /**
     * Convert Uint8Array to Base58
     */
    _uint8ArrayToBase58(uint8Array) {
      const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let num = BigInt('0x' + Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join(''));
      let encoded = '';

      while (num > 0) {
        const remainder = Number(num % 58n);
        encoded = ALPHABET[remainder] + encoded;
        num = num / 58n;
      }

      for (let i = 0; i < uint8Array.length && uint8Array[i] === 0; i++) {
        encoded = '1' + encoded;
      }

      return encoded || '1';
    }
  };

  window.SolanaSign = SolanaSign;
})();
