/**
 * Unit tests for encryption utilities
 * Tests AES-256-GCM encryption/decryption
 */

import { encrypt, decrypt, generateCardNumber, generateCVV, maskCardNumber, validateCardNumber, warmEncryptionCache } from '../encryption';

// Mock environment variables
process.env.ENCRYPTION_KEY = '72e1959249461b66b4d5a9e06aba0289b33874ec99dca2934f25c909009273cb';
process.env.ENCRYPTION_SALT = '0c29fd9635ea4dfeb2cee894fd8abbbc8971ef87552f6a3c66f0e13b08d081ee';
process.env.NODE_ENV = 'test';

describe('Encryption utilities', () => {
  beforeAll(async () => {
    // Warm cache with test key
    await warmEncryptionCache();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt card numbers correctly', () => {
      const cardNumber = '4532015112830366';
      const encrypted = encrypt(cardNumber);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(cardNumber);
      expect(encrypted).not.toBe(cardNumber);
      expect(encrypted).toContain(':'); // iv:authTag:encrypted format
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const cardNumber = '4532015112830366';
      const encrypted1 = encrypt(cardNumber);
      const encrypted2 = encrypt(cardNumber);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(cardNumber);
      expect(decrypt(encrypted2)).toBe(cardNumber);
    });

    it('should encrypt and decrypt CVV correctly', () => {
      const cvv = '123';
      const encrypted = encrypt(cvv);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(cvv);
    });

    it('should throw error on invalid ciphertext format', () => {
      expect(() => decrypt('invalid')).toThrow();
    });

    it('should throw error on tampered ciphertext', () => {
      const encrypted = encrypt('4532015112830366');
      const tampered = encrypted.replace(/.$/, '0'); // Change last character
      
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('generateCardNumber', () => {
    it('should generate valid VISA card number', () => {
      const cardNumber = generateCardNumber('VISA');
      
      expect(cardNumber).toMatch(/^4\d{15}$/); // VISA starts with 4, 16 digits
      expect(validateCardNumber(cardNumber)).toBe(true);
    });

    it('should generate valid MASTERCARD card number', () => {
      const cardNumber = generateCardNumber('MASTERCARD');
      
      expect(cardNumber).toMatch(/^5[1-5]\d{14}$/); // MC starts with 51-55, 16 digits
      expect(validateCardNumber(cardNumber)).toBe(true);
    });

    it('should pass Luhn checksum validation', () => {
      for (let i = 0; i < 10; i++) {
        const visaCard = generateCardNumber('VISA');
        const mcCard = generateCardNumber('MASTERCARD');
        
        expect(validateCardNumber(visaCard)).toBe(true);
        expect(validateCardNumber(mcCard)).toBe(true);
      }
    });
  });

  describe('generateCVV', () => {
    it('should generate 3-digit CVV', () => {
      const cvv = generateCVV();
      
      expect(cvv).toMatch(/^\d{3}$/);
      expect(cvv.length).toBe(3);
    });

    it('should generate random CVVs', () => {
      const cvvs = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        cvvs.add(generateCVV());
      }
      
      // At least 90% unique in 100 generations
      expect(cvvs.size).toBeGreaterThan(90);
    });
  });

  describe('maskCardNumber', () => {
    it('should mask card number showing only last 4 digits', () => {
      const cardNumber = '4532015112830366';
      const masked = maskCardNumber(cardNumber);
      
      expect(masked).toBe('**** **** **** 0366');
    });

    it('should handle short card numbers', () => {
      const cardNumber = '123456';
      const masked = maskCardNumber(cardNumber);
      
      expect(masked).toBe('** 3456');
    });
  });

  describe('validateCardNumber (Luhn algorithm)', () => {
    it('should validate correct card numbers', () => {
      // Real test card numbers (always valid)
      expect(validateCardNumber('4532015112830366')).toBe(true); // VISA
      expect(validateCardNumber('5425233430109903')).toBe(true); // MASTERCARD
      expect(validateCardNumber('374245455400126')).toBe(true);  // AMEX
    });

    it('should reject invalid card numbers', () => {
      expect(validateCardNumber('4532015112830367')).toBe(false); // Wrong checksum
      expect(validateCardNumber('1234567890123456')).toBe(false);
      expect(validateCardNumber('0000000000000000')).toBe(false);
    });

    it('should reject non-numeric input', () => {
      expect(validateCardNumber('abcd-efgh-ijkl-mnop')).toBe(false);
      expect(validateCardNumber('')).toBe(false);
    });
  });
});
