/**
 * Extension-specific security features
 */

import { setupAutoLock, secureClipboardCopy } from '@/lib/security/extensionSecurity';

// Initialize security features
let unlockCleanup: (() => void) | null = null;

/**
 * Initialize extension security
 */
export function initExtensionSecurity(): void {
  // Setup auto-lock
  unlockCleanup = setupAutoLock(() => {
    // Lock the extension
    chrome.storage.local.set({ locked: true });
    
    // Clear sensitive data from memory
    // Notify user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon48.png',
      title: 'Celora Locked',
      message: 'Extension locked due to inactivity',
    });
  });
  
  // Listen for idle state
  if (chrome.idle) {
    chrome.idle.setDetectionInterval(300); // 5 minutes
    chrome.idle.onStateChanged.addListener((state) => {
      if (state === 'idle' || state === 'locked') {
        chrome.storage.local.set({ locked: true });
      }
    });
  }
}

/**
 * Cleanup security features
 */
export function cleanupExtensionSecurity(): void {
  if (unlockCleanup) {
    unlockCleanup();
    unlockCleanup = null;
  }
}

/**
 * Copy address to clipboard securely
 */
export async function copyAddressSecurely(address: string): Promise<void> {
  await secureClipboardCopy(address, 30000); // Clear after 30 seconds
  
  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icon48.png',
    title: 'Address Copied',
    message: 'Address will be cleared from clipboard in 30 seconds',
  });
}

















