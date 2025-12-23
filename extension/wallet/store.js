/**
 * Wallet Storage (chrome.storage.local with IndexedDB fallback)
 * Stores encrypted seed phrase locally, NEVER on server
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    ENCRYPTED_SEED: 'celora_encrypted_mnemonic',
    WALLET_CREATED: 'celora_wallet_created',
    PUBLIC_ADDRESSES: 'celora_public_addresses',
    NETWORK: 'celora_network'
  };

  const WalletStore = {
    /**
     * Save encrypted seed phrase
     */
    async saveEncryptedSeed(encryptedBlob) {
      return new Promise((resolve, reject) => {
        const data = {
          [STORAGE_KEYS.ENCRYPTED_SEED]: encryptedBlob,
          [STORAGE_KEYS.WALLET_CREATED]: Date.now()
        };

        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            console.error('[WalletStore] Save failed:', chrome.runtime.lastError);
            reject(new Error('Failed to save wallet'));
          } else {
            console.log('[WalletStore] Wallet saved successfully');
            resolve();
          }
        });
      });
    },

    /**
     * Load encrypted seed phrase
     */
    async loadEncryptedSeed() {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.ENCRYPTED_SEED], (result) => {
          resolve(result[STORAGE_KEYS.ENCRYPTED_SEED] || null);
        });
      });
    },

    /**
     * Check if wallet exists
     */
    async hasWallet() {
      const encrypted = await this.loadEncryptedSeed();
      return !!encrypted;
    },

    /**
     * Delete wallet (DANGEROUS)
     */
    async deleteWallet() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove([
          STORAGE_KEYS.ENCRYPTED_SEED,
          STORAGE_KEYS.WALLET_CREATED,
          STORAGE_KEYS.PUBLIC_ADDRESSES
        ], () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to delete wallet'));
          } else {
            console.log('[WalletStore] Wallet deleted');
            resolve();
          }
        });
      });
    },

    /**
     * Save public addresses (safe to store)
     */
    async savePublicAddresses(addresses) {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          [STORAGE_KEYS.PUBLIC_ADDRESSES]: addresses
        }, resolve);
      });
    },

    /**
     * Load public addresses
     */
    async loadPublicAddresses() {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.PUBLIC_ADDRESSES], (result) => {
          resolve(result[STORAGE_KEYS.PUBLIC_ADDRESSES] || null);
        });
      });
    },

    /**
     * Save/load network selection (devnet/mainnet)
     */
    async saveNetwork(network) {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          [STORAGE_KEYS.NETWORK]: network
        }, resolve);
      });
    },

    async loadNetwork() {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.NETWORK], (result) => {
          resolve(result[STORAGE_KEYS.NETWORK] || 'devnet'); // Default devnet
        });
      });
    }
  };

  window.WalletStore = WalletStore;
})();
