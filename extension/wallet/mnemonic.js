/**
 * BIP39 Mnemonic Generation & Validation
 * Pure JavaScript implementation for Chrome Extension (NO NODE DEPS)
 */

(function () {
  'use strict';

  // BIP39 English wordlist (first 100 words for demo - you'll need all 2048)
  const WORDLIST = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
    'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
    'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
    'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
    'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
    'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
    'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
    'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
    'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
    'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
    'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact'
    // ... FULL 2048 WORDLIST NEEDED FOR PRODUCTION
  ];

  const WalletMnemonic = {
    /**
     * Generate 12-word mnemonic (128 bits entropy)
     */
    generate12Words() {
      const entropy = new Uint8Array(16); // 128 bits
      crypto.getRandomValues(entropy);
      return this._entropyToMnemonic(entropy, 12);
    },

    /**
     * Generate 24-word mnemonic (256 bits entropy)
     */
    generate24Words() {
      const entropy = new Uint8Array(32); // 256 bits
      crypto.getRandomValues(entropy);
      return this._entropyToMnemonic(entropy, 24);
    },

    /**
     * Validate mnemonic phrase
     */
    validate(mnemonic) {
      const words = mnemonic.trim().toLowerCase().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        return false;
      }

      // Check all words are in wordlist
      for (const word of words) {
        if (!WORDLIST.includes(word)) {
          return false;
        }
      }

      // TODO: Verify checksum for production
      return true;
    },

    /**
     * Convert entropy to mnemonic
     */
    _entropyToMnemonic(entropy, wordCount) {
      // Simplified version - production needs proper BIP39 checksum
      const words = [];
      for (let i = 0; i < wordCount; i++) {
        const index = entropy[i % entropy.length] % WORDLIST.length;
        words.push(WORDLIST[index]);
      }
      return words.join(' ');
    },

    /**
     * Mnemonic to seed (for key derivation)
     */
    async mnemonicToSeed(mnemonic, password = '') {
      const encoder = new TextEncoder();
      const mnemonicBytes = encoder.encode(mnemonic);
      const salt = encoder.encode('mnemonic' + password);

      const key = await crypto.subtle.importKey(
        'raw',
        mnemonicBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const seedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 2048,
          hash: 'SHA-512'
        },
        key,
        512
      );

      return new Uint8Array(seedBits);
    }
  };

  // Export CommonJS for Jest tests; attach to window for extension runtime
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateMnemonic: async (words = 12) => (words === 24 ? WalletMnemonic.generate24Words() : WalletMnemonic.generate12Words()),
      validate: WalletMnemonic.validate,
      WalletMnemonic,
    };
  } else {
    window.WalletMnemonic = WalletMnemonic;
  }
})();
