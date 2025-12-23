/**
 * AES-GCM Encryption with PBKDF2 Key Derivation
 * Encrypts mnemonic with user password (100k iterations)
 */

(function () {
  'use strict';

  const WalletCrypto = {
    /**
     * Encrypt seed phrase with password
     * Returns base64 encoded: salt(16) + iv(12) + ciphertext
     */
    async encryptSeed(mnemonic, password) {
      try {
        // Generate random salt and IV
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Derive encryption key from password
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        const aesKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000, // 100k iterations
            hash: 'SHA-256'
          },
          passwordKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt']
        );

        // Encrypt mnemonic
        const mnemonicBytes = encoder.encode(mnemonic);
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          aesKey,
          mnemonicBytes
        );

        // Combine salt + iv + ciphertext
        const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

        // Return as base64
        return btoa(String.fromCharCode(...combined));
      } catch (error) {
        console.error('[WalletCrypto] Encryption failed:', error);
        throw new Error('Failed to encrypt seed phrase');
      }
    },

    /**
     * Decrypt seed phrase with password
     */
    async decryptSeed(encryptedBlob, password) {
      try {
        // Decode base64
        const combined = Uint8Array.from(atob(encryptedBlob), c => c.charCodeAt(0));

        // Extract components
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const ciphertext = combined.slice(28);

        // Derive decryption key from password
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        const aesKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          passwordKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        // Decrypt
        const decryptedBytes = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          aesKey,
          ciphertext
        );

        return new TextDecoder().decode(decryptedBytes);
      } catch (error) {
        console.error('[WalletCrypto] Decryption failed:', error);
        throw new Error('Invalid password or corrupted data');
      }
    },

    /**
     * Hash data with SHA-256 (for verification)
     */
    async sha256(data) {
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      encryptMnemonic: WalletCrypto.encryptSeed,
      decryptMnemonic: WalletCrypto.decryptSeed,
      sha256: WalletCrypto.sha256,
      WalletCrypto,
    };
  } else {
    window.WalletCrypto = WalletCrypto;
  }
})();
