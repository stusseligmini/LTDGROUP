/**
 * Wallet Transaction Signing Module
 * Signs transactions CLIENT-SIDE with encrypted mnemonic
 * NO FIREBASE - Pure Web Crypto API
 */

(function () {
  'use strict';

  const WalletSigning = {
    /**
     * Get encrypted mnemonic from chrome.storage
     */
    async getEncryptedMnemonic() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['celora_encrypted_mnemonic'], (result) => {
          resolve(result.celora_encrypted_mnemonic || null);
        });
      });
    },

    /**
     * Store encrypted mnemonic
     */
    async storeEncryptedMnemonic(encryptedData) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ celora_encrypted_mnemonic: encryptedData }, resolve);
      });
    },

    /**
     * Decrypt mnemonic with password using Web Crypto API
     */
    async decryptMnemonic(encryptedMnemonic, password) {
      try {
        const combined = Uint8Array.from(atob(encryptedMnemonic), c => c.charCodeAt(0));
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encryptedData = combined.slice(28);

        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveBits', 'deriveKey']
        );

        const aesKey = await crypto.subtle.deriveKey(
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

        const decryptedData = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          aesKey,
          encryptedData
        );

        return new TextDecoder().decode(decryptedData);
      } catch (error) {
        console.error('[WalletSigning] Decryption failed:', error);
        throw new Error('Invalid password or corrupted data');
      }
    },

    /**
     * Encrypt mnemonic with password
     */
    async encryptMnemonic(mnemonic, password) {
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveBits', 'deriveKey']
        );

        const aesKey = await crypto.subtle.deriveKey(
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

        const encryptedData = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          aesKey,
          encoder.encode(mnemonic)
        );

        const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

        return btoa(String.fromCharCode(...combined));
      } catch (error) {
        console.error('[WalletSigning] Encryption failed:', error);
        throw error;
      }
    },

    /**
     * Hash mnemonic for verification (never send actual mnemonic!)
     */
    async hashMnemonic(mnemonic) {
      const encoder = new TextEncoder();
      const data = encoder.encode(mnemonic);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },

    /**
     * Check if wallet exists
     */
    async hasWallet() {
      const encryptedMnemonic = await this.getEncryptedMnemonic();
      return !!encryptedMnemonic;
    },

    /**
     * Import wallet from mnemonic
     */
    async importWallet(mnemonic, password) {
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        throw new Error('Invalid mnemonic: must be 12 or 24 words');
      }

      const encrypted = await this.encryptMnemonic(mnemonic, password);
      await this.storeEncryptedMnemonic(encrypted);

      console.log('[WalletSigning] Wallet imported successfully');
      return { success: true };
    },

    /**
     * Delete wallet (dangerous!)
     */
    async deleteWallet() {
      return new Promise((resolve) => {
        chrome.storage.local.remove(['celora_encrypted_mnemonic'], () => {
          console.log('[WalletSigning] Wallet deleted');
          resolve({ success: true });
        });
      });
    }
  };

  window.WalletSigning = WalletSigning;
})();
