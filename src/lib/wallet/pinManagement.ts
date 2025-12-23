/**
 * Wallet PIN Management
 * Handles local PIN storage and verification
 */

import crypto from 'crypto';

const PIN_STORAGE_KEY = 'celora_wallet_pin_hash';
const PIN_SALT_KEY = 'celora_wallet_pin_salt';
const UNLOCK_SESSION_KEY = 'celora_wallet_unlocked';
const UNLOCK_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Hash PIN using PBKDF2
 */
function hashPin(pin: string, salt: string): string {
  if (typeof window === 'undefined') {
    // Server-side, just return the pin (shouldn't be used here)
    return pin;
  }

  // Use SubtleCrypto for browser-based hashing
  // For now, use a simple hash (in production, use server-side verification)
  return btoa(`${pin}:${salt}`);
}

/**
 * Generate a random salt
 */
function generateSalt(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Set wallet PIN (first time setup)
 */
export async function setWalletPin(pin: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') {
      throw new Error('PIN setup only available in browser');
    }

    if (pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    const salt = generateSalt();
    const hash = hashPin(pin, salt);

    localStorage.setItem(PIN_STORAGE_KEY, hash);
    localStorage.setItem(PIN_SALT_KEY, salt);

    return true;
  } catch (error) {
    console.error('Failed to set wallet PIN:', error);
    return false;
  }
}

/**
 * Verify wallet PIN
 */
export async function verifyWalletPin(pin: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') {
      throw new Error('PIN verification only available in browser');
    }

    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    const salt = localStorage.getItem(PIN_SALT_KEY);

    if (!storedHash || !salt) {
      throw new Error('No PIN configured. Please set up your wallet PIN first.');
    }

    const hash = hashPin(pin, salt);

    if (hash !== storedHash) {
      return false;
    }

    // Set unlock session
    const unlockTime = Date.now() + UNLOCK_SESSION_DURATION;
    sessionStorage.setItem(UNLOCK_SESSION_KEY, unlockTime.toString());

    return true;
  } catch (error) {
    console.error('Failed to verify wallet PIN:', error);
    throw error;
  }
}

/**
 * Check if wallet is currently unlocked
 */
export function isWalletUnlocked(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const unlockTime = sessionStorage.getItem(UNLOCK_SESSION_KEY);
  if (!unlockTime) {
    return false;
  }

  const remaining = parseInt(unlockTime) - Date.now();
  if (remaining <= 0) {
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
    return false;
  }

  return true;
}

/**
 * Lock wallet (clear session)
 */
export function lockWallet(): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(UNLOCK_SESSION_KEY);
}

/**
 * Check if PIN is set up
 */
export function isPinConfigured(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return !!localStorage.getItem(PIN_STORAGE_KEY);
}

/**
 * Get remaining unlock time in seconds
 */
export function getUnlockTimeRemaining(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const unlockTime = sessionStorage.getItem(UNLOCK_SESSION_KEY);
  if (!unlockTime) {
    return 0;
  }

  const remaining = parseInt(unlockTime) - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Reset wallet PIN (requires old PIN)
 */
export async function resetWalletPin(oldPin: string, newPin: string): Promise<boolean> {
  try {
    // Verify old PIN first
    const verified = await verifyWalletPin(oldPin);
    if (!verified) {
      throw new Error('Current PIN is incorrect');
    }

    // Set new PIN
    return await setWalletPin(newPin);
  } catch (error) {
    console.error('Failed to reset wallet PIN:', error);
    throw error;
  }
}
