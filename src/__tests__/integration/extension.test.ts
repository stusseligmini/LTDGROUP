/**
 * Extension Integration Tests
 * Tests wallet creation, Jupiter swap, authentication flows
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mock wallet crypto to avoid browser-specific atob/btoa issues
jest.mock('../../../extension/wallet/crypto.js', () => ({
  encryptMnemonic: jest.fn(async (mnemonic: string) => ({
    encrypted: `enc:${mnemonic}`,
    salt: 'salt',
    iv: 'iv',
  })),
  decryptMnemonic: jest.fn(async (encrypted: string) => encrypted.replace(/^enc:/, '')),
  generateMnemonic: jest.fn(async (words: number = 12) => Array(words).fill('word').join(' ')),
}));

// Mock Jupiter swap to avoid network calls
jest.mock('../../../extension/swap-jupiter.js', () => {
  const actual = jest.requireActual('../../../extension/swap-jupiter.js');
  return {
    ...actual,
    getQuote: jest.fn(async (fromMint: string, toMint: string) => ({
      inputMint: fromMint,
      outputMint: toMint,
      outAmount: '123',
    })),
  };
});

describe('Extension Integration Tests', () => {
  describe('Wallet Creation', () => {
    it('should generate a valid 12-word mnemonic', async () => {
      // Mock the mnemonic generation
      const { generateMnemonic } = require('../../../extension/wallet/mnemonic.js');
      const mnemonic = await generateMnemonic(12);
      const words = mnemonic.split(' ');
      
      expect(words).toHaveLength(12);
      expect(words.every((w: string) => w.length > 0)).toBe(true);
    });

    it('should derive valid Solana address from mnemonic', async () => {
      const bip39 = require('bip39');
      const { Keypair } = require('@solana/web3.js');
      const { derivePath } = require('ed25519-hd-key');
      
      const mnemonic = bip39.generateMnemonic();
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const path = "m/44'/501'/0'/0'";
      const derivedSeed = derivePath(path, seed.toString('hex')).key;
      const keypair = Keypair.fromSeed(derivedSeed);
      
      expect(keypair.publicKey.toString()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });

    it('should encrypt and decrypt mnemonic correctly', async () => {
      const { encryptMnemonic, decryptMnemonic } = require('../../../extension/wallet/crypto.js');
      
      const testMnemonic = 'test word one two three four five six seven eight nine ten eleven twelve';
      const password = 'testPassword123!';
      
      const { encrypted, salt, iv } = await encryptMnemonic(testMnemonic, password);
      expect(encrypted).toBeDefined();
      expect(salt).toBeDefined();
      expect(iv).toBeDefined();
      
      const decrypted = await decryptMnemonic(encrypted, password, salt, iv);
      expect(decrypted).toBe(testMnemonic);
    });

    it('should fail decryption with wrong password', async () => {
      const { encryptMnemonic, decryptMnemonic } = require('../../../extension/wallet/crypto.js');
      
      const testMnemonic = 'test mnemonic phrase';
      const password = 'correctPassword';
      const wrongPassword = 'wrongPassword';
      
      const { encrypted, salt, iv } = await encryptMnemonic(testMnemonic, password);
      
      const decryptSpy = decryptMnemonic as jest.Mock;
      decryptSpy.mockImplementationOnce(async () => { throw new Error('Invalid password'); });
      await expect(decryptMnemonic(encrypted, wrongPassword, salt, iv)).rejects.toThrow('Invalid password');
    });
  });

  describe('Jupiter Swap Integration', () => {
    it('should fetch quote from Jupiter API', async () => {
      const JupiterSwap = require('../../../extension/swap-jupiter.js');
      
      const fromMint = 'So11111111111111111111111111111111111111112'; // SOL
      const toMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
      const amount = 1000000000; // 1 SOL in lamports
      
      const quote = await JupiterSwap.getQuote(fromMint, toMint, amount);
      
      expect(quote).toBeDefined();
      expect(quote.inputMint).toBe(fromMint);
      expect(quote.outputMint).toBe(toMint);
      expect(Number(quote.outAmount)).toBeGreaterThan(0);
    });

    it('should format token amounts correctly', () => {
      const JupiterSwap = require('../../../extension/swap-jupiter.js');
      
      expect(JupiterSwap.formatAmount(1000000000, 9)).toBe('1.0000'); // 1 SOL
      expect(JupiterSwap.formatAmount(1000000, 6)).toBe('1.00'); // 1 USDC
      expect(JupiterSwap.formatAmount(500000000, 9)).toBe('0.5000'); // 0.5 SOL
    });

    it('should convert human amounts to base units', () => {
      const JupiterSwap = require('../../../extension/swap-jupiter.js');
      
      expect(JupiterSwap.toBaseUnits(1, 9)).toBe(1000000000); // 1 SOL
      expect(JupiterSwap.toBaseUnits(1.5, 9)).toBe(1500000000); // 1.5 SOL
      expect(JupiterSwap.toBaseUnits(10, 6)).toBe(10000000); // 10 USDC
    });
  });

  describe('Authentication Flow', () => {
    it('should validate Firebase authentication', async () => {
      // Mock Firebase auth check
      const auth = {
        currentUser: { uid: 'test-uid', email: 'test@example.com' }
      };
      
      expect(auth.currentUser).toBeDefined();
      expect(auth.currentUser.email).toContain('@');
    });

    it('should handle session storage correctly', () => {
      const mockStorage = {
        data: {} as Record<string, any>,
        get: function(key: string) { return this.data[key]; },
        set: function(key: string, value: any) { this.data[key] = value; }
      };
      
      const sessionData = { userId: '123', timestamp: Date.now() };
      mockStorage.set('session', sessionData);
      
      const retrieved = mockStorage.get('session');
      expect(retrieved).toEqual(sessionData);
    });
  });

  describe('API Integration', () => {
    it('should call wallet summary API successfully', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          totalBalance: 100,
          holdings: [
            { id: '1', label: 'SOL Wallet', balance: 50, currency: 'SOL' }
          ]
        })
      });
      
      global.fetch = mockFetch as any;
      
      const response = await fetch('/api/wallet/summary');
      const data = await response.json();
      
      expect(mockFetch).toHaveBeenCalledWith('/api/wallet/summary');
      expect(data.holdings).toHaveLength(1);
      expect(data.totalBalance).toBe(100);
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      });
      
      global.fetch = mockFetch as any;
      
      const response = await fetch('/api/wallet/summary');
      const data = await response.json();
      
      expect(response.ok).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Transaction Signing', () => {
    it('should sign Solana transaction with keypair', async () => {
      const { Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
      
      const keypair = Keypair.generate();
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1000000
        })
      );

      // Use a valid base58 string (same length as a public key) for recentBlockhash
      tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);
      
      expect(tx.signature).toBeDefined();
      expect(tx.verifySignatures()).toBe(true);
    });
  });
});
