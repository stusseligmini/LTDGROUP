/**
 * Extension Security Utilities
 */

// Auto-lock functionality
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
let idleTimer: NodeJS.Timeout | null = null;

export function setupAutoLock(onLock: () => void): () => void {
  const resetTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(onLock, IDLE_TIMEOUT);
  };
  
  // Reset timer on user activity
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);
  }
  
  resetTimer();
  
  // Cleanup function
  return () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('click', resetTimer);
    }
  };
}

/**
 * Encrypt data for extension storage
 */
export async function encryptForStorage(data: any, key: string): Promise<string> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  
  // Use SubtleCrypto for encryption
  const cryptoKey = await getCryptoKey(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data from extension storage
 */
export async function decryptFromStorage(encrypted: string, key: string): Promise<any> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  // Decrypt
  const cryptoKey = await getCryptoKey(key);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedData
  );
  
  // Convert back to JSON
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonString);
}

/**
 * Get or create crypto key for encryption
 */
async function getCryptoKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = encoder.encode('celora-extension-v1');
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Secure clipboard copy with auto-clear
 */
export async function secureClipboardCopy(text: string, clearAfterMs: number = 30000): Promise<void> {
  await navigator.clipboard.writeText(text);
  
  // Clear after timeout
  setTimeout(async () => {
    const current = await navigator.clipboard.readText();
    if (current === text) {
      await navigator.clipboard.writeText('');
    }
  }, clearAfterMs);
}

/**
 * Validate URL to prevent phishing
 */
export function isValidCeloraUrl(url: string): boolean {
  const allowedDomains = [
    'celora-7b552.web.app',
    'app.celora.com',
    'celora.net',
    'celora.com',
    'localhost',
  ];
  
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}

















