"use strict";
/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for card numbers, CVV, and private keys
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.warmEncryptionCache = warmEncryptionCache;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.generateCardNumber = generateCardNumber;
exports.generateCVV = generateCVV;
exports.maskCardNumber = maskCardNumber;
exports.getLastFourDigits = getLastFourDigits;
exports.validateCardNumber = validateCardNumber;
exports.validateCVV = validateCVV;
exports.validateExpiry = validateExpiry;
exports.hashForIndex = hashForIndex;
const crypto_1 = __importDefault(require("crypto"));
const secrets_1 = require("@/lib/config/secrets");
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
let encryptionKeyCache = null;
/**
 * Get encryption key from Key Vault or environment
 */
async function getEncryptionKey() {
    if (encryptionKeyCache) {
        return encryptionKeyCache;
    }
    let key;
    try {
        // Try Key Vault first
        key = await (0, secrets_1.getSecret)('card-encryption-key', 'ENCRYPTION_KEY');
    }
    catch {
        // Fallback to environment variable
        key = process.env.ENCRYPTION_KEY || '';
    }
    if (!key) {
        throw new Error('ENCRYPTION_KEY not found in Key Vault or environment');
    }
    // Derive key using PBKDF2
    const salt = process.env.ENCRYPTION_SALT || 'celora-salt-v1';
    encryptionKeyCache = crypto_1.default.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha512');
    return encryptionKeyCache;
}
/**
 * Synchronous version for backward compatibility
 * WARNING: Only use in dev - will throw in production without pre-warmed cache
 */
function getEncryptionKeySync() {
    if (encryptionKeyCache) {
        return encryptionKeyCache;
    }
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY not available. Call warmEncryptionCache() first in production.');
    }
    const salt = process.env.ENCRYPTION_SALT || 'celora-salt-v1';
    encryptionKeyCache = crypto_1.default.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha512');
    return encryptionKeyCache;
}
/**
 * Pre-warm encryption key cache (call at app startup)
 */
async function warmEncryptionCache() {
    await getEncryptionKey();
}
/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(plaintext) {
    const key = getEncryptionKeySync();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(ciphertext) {
    const key = getEncryptionKeySync();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Generate a random card number (for testing/demo)
 */
function generateCardNumber(brand = 'VISA') {
    const prefix = brand === 'VISA' ? '4' : '5';
    let number = prefix;
    // Generate 14 random digits
    for (let i = 0; i < 14; i++) {
        number += Math.floor(Math.random() * 10);
    }
    // Calculate Luhn checksum
    let sum = 0;
    let isEven = false;
    for (let i = number.length - 1; i >= 0; i--) {
        let digit = parseInt(number[i]);
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
        isEven = !isEven;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return number + checksum;
}
/**
 * Generate a random CVV
 */
function generateCVV() {
    return Math.floor(100 + Math.random() * 900).toString();
}
/**
 * Mask card number (show only last 4 digits)
 */
function maskCardNumber(cardNumber) {
    if (cardNumber.length < 4) {
        return '****';
    }
    return '**** **** **** ' + cardNumber.slice(-4);
}
/**
 * Get last 4 digits of card number
 */
function getLastFourDigits(cardNumber) {
    return cardNumber.slice(-4);
}
/**
 * Validate card number using Luhn algorithm
 */
function validateCardNumber(cardNumber) {
    const sanitized = cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(sanitized)) {
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
function validateCVV(cvv) {
    return /^\d{3,4}$/.test(cvv);
}
/**
 * Validate expiry date
 */
function validateExpiry(month, year) {
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
function hashForIndex(data) {
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
}
