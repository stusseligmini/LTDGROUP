/**
 * Celora Extension - Background Service Worker (MV3)
 * Main entry point for background processes + dApp handling
 */

console.log('[Celora Extension] Background service worker initialized');

// Import dApp handler
importScripts('background/dapp-handler.js');

// Listen for extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Celora Extension] Installed:', details.reason);
  
  if (details.reason === 'install') {
    chrome.storage.local.set({
      installTimestamp: Date.now(),
      version: chrome.runtime.getManifest().version,
    });
  }
});

// Listen for extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Celora Extension] Extension started');
});

// Simple message handler (legacy support)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Celora Extension] Message received:', message.type || message);
  
  // Let dapp-handler.js handle dApp requests
  if (message.type === 'DAPP_REQUEST') {
    return true; // Handled by dapp-handler.js
  }
  
  sendResponse({ success: true });
  return true;
});
