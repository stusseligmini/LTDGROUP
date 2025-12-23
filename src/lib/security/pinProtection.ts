/**
 * PIN Protection for Hidden Vaults
 * Provides secure PIN validation and vault access control
 */

import crypto from 'crypto';

const SALT_ROUNDS = 10;
const PIN_LENGTH = 6;

/**
 * Hash a PIN using PBKDF2
 */
export function hashPin(pin: string): string {
  if (pin.length !== PIN_LENGTH) {
    throw new Error(`PIN must be exactly ${PIN_LENGTH} digits`);
  }
  
  if (!/^\d+$/.test(pin)) {
    throw new Error('PIN must contain only digits');
  }
  
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex');
  
  return `${salt}:${hash}`;
}

/**
 * Verify a PIN against a stored hash
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  if (!storedHash || !pin) {
    return false;
  }
  
  try {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex');
    
    return hash === verifyHash;
  } catch (error) {
    return false;
  }
}

/**
 * Validate PIN format (6 digits)
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Check if PIN is weak (common patterns)
 */
export function isWeakPin(pin: string): boolean {
  const weakPatterns = [
    '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999',
    '123456', '654321', '012345', '543210',
    '112233', '121212', '123123', '234234'
  ];
  
  // Check for sequential digits
  const isSequential = /^(?:012345|123456|234567|345678|456789|987654|876543|765432|654321|543210)$/.test(pin);
  
  // Check for repeating pattern
  const isRepeating = /^(\d)\1{5}$/.test(pin);
  
  return weakPatterns.includes(pin) || isSequential || isRepeating;
}

/**
 * Generate vault session token (expires after 5 minutes)
 */
export function generateVaultToken(userId: string, walletId: string): string {
  const payload = {
    userId,
    walletId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Verify vault session token
 */
export function verifyVaultToken(
  token: string,
  userId: string,
  walletId: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes
): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    if (payload.userId !== userId || payload.walletId !== walletId) {
      return false;
    }
    
    const age = Date.now() - payload.timestamp;
    return age < maxAgeMs;
  } catch {
    return false;
  }
}

/**
 * Rate limiting for PIN attempts
 */
const pinAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkPinRateLimit(userId: string, walletId: string): { allowed: boolean; remainingAttempts: number } {
  const key = `${userId}:${walletId}`;
  const now = Date.now();
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  let record = pinAttempts.get(key);
  
  // Reset if window expired
  if (record && now > record.resetAt) {
    record = undefined;
    pinAttempts.delete(key);
  }
  
  if (!record) {
    record = { count: 0, resetAt: now + windowMs };
    pinAttempts.set(key, record);
  }
  
  const remainingAttempts = Math.max(0, maxAttempts - record.count);
  const allowed = record.count < maxAttempts;
  
  if (allowed) {
    record.count++;
  }
  
  return { allowed, remainingAttempts };
}

/**
 * Reset PIN attempts after successful unlock
 */
export function resetPinAttempts(userId: string, walletId: string): void {
  const key = `${userId}:${walletId}`;
  pinAttempts.delete(key);
}

/**
 * Session-based vault unlock tracking
 * Stores unlocked vault state in memory with expiration
 */
const unlockedVaults = new Map<string, { expiresAt: number }>();

/**
 * Mark vault as unlocked for a session
 */
export function markVaultUnlocked(userId: string, walletId: string, durationMs: number = 5 * 60 * 1000): void {
  const key = `${userId}:${walletId}`;
  unlockedVaults.set(key, {
    expiresAt: Date.now() + durationMs,
  });
}

/**
 * Check if vault is unlocked in current session
 */
export function isVaultUnlocked(userId: string, walletId: string): boolean {
  const key = `${userId}:${walletId}`;
  const record = unlockedVaults.get(key);
  
  if (!record) {
    return false;
  }
  
  // Check if expired
  if (Date.now() > record.expiresAt) {
    unlockedVaults.delete(key);
    return false;
  }
  
  return true;
}

/**
 * Clear vault unlock session
 */
export function clearVaultUnlock(userId: string, walletId: string): void {
  const key = `${userId}:${walletId}`;
  unlockedVaults.delete(key);
}

/**
 * Clear all vault unlocks for a user (e.g., on logout)
 */
export function clearAllVaultUnlocks(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of unlockedVaults.keys()) {
    if (key.startsWith(prefix)) {
      unlockedVaults.delete(key);
    }
  }
}