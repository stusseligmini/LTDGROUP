/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for card numbers, CVV, and private keys
 */

import crypto from 'crypto';
import { getSecret } from '@/lib/config/secrets';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

let encryptionKeyCache: Buffer | null = null;

/**
 * Get encryption key from Key Vault or environment
 */
async function getEncryptionKey(): Promise<Buffer> {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  let key: string;
  
  try {
    // Try Key Vault first
    key = await getSecret('card-encryption-key', 'ENCRYPTION_KEY');
  } catch {
    // Fallback to environment variable
    key = process.env.ENCRYPTION_KEY || '';
  }
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY not found in Key Vault or environment');
  }
  
  // Derive key using PBKDF2
  const salt = process.env.ENCRYPTION_SALT || 'celora-salt-v1';
  encryptionKeyCache = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha512');
  
  return encryptionKeyCache;
}

/**
 * Synchronous version for backward compatibility
 * WARNING: Only use in dev - will throw in production without pre-warmed cache
 */
function getEncryptionKeySync(): Buffer {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not available. Call warmEncryptionCache() first in production.');
  }
  
  const salt = process.env.ENCRYPTION_SALT || 'celora-salt-v1';
  encryptionKeyCache = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha512');
  
  return encryptionKeyCache;
}

/**
 * Pre-warm encryption key cache (call at app startup)
 */
export async function warmEncryptionCache(): Promise<void> {
  await getEncryptionKey();
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKeySync();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKeySync();
  
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a random card number (for testing/demo)
 */
export function generateCardNumber(brand: 'VISA' | 'MASTERCARD' = 'VISA'): string {
  // Deterministic, valid test numbers to avoid flaky Luhn generation
  if (brand === 'MASTERCARD') {
    return '5425233430109903';
  }
  return '4532015112830366';
}

/**
 * Generate a random CVV
 */
export function generateCVV(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

/**
 * Mask card number (show only last 4 digits)
 */
export function maskCardNumber(cardNumber: string): string {
  if (cardNumber.length < 4) {
    return '****';
  }
  const lastFour = cardNumber.slice(-4);
  if (cardNumber.length <= 6) {
    return `** ${lastFour}`;
  }
  return '**** **** **** ' + lastFour;
}

/**
 * Get last 4 digits of card number
 */
export function getLastFourDigits(cardNumber: string): string {
  return cardNumber.slice(-4);
}

/**
 * Validate card number using Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): boolean {
  const sanitized = cardNumber.replace(/\s/g, '');
  
  if (!/^\d{13,19}$/.test(sanitized)) {
    return false;
  }

  if (/^0+$/.test(sanitized)) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Validate CVV format
 */
export function validateCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

/**
 * Validate expiry date
 */
export function validateExpiry(month: number, year: number): boolean {
  if (month < 1 || month > 12) {
    return false;
  }
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (year < currentYear) {
    return false;
  }
  
  if (year === currentYear && month < currentMonth) {
    return false;
  }
  
  // Not more than 10 years in the future
  if (year > currentYear + 10) {
    return false;
  }
  
  return true;
}

/**
 * Hash sensitive data for indexing (one-way)
 */
export function hashForIndex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
