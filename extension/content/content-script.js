/**
 * Content Script - Bridge between injected provider and background script
 * 
 * This script runs in an isolated context and forwards messages between
 * the injected provider (main world) and the background service worker.
 */

console.log('[Celora] Content script loaded');

// Inject the provider script into the main world
function injectProvider() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/injected-provider.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log('[Celora] Provider injected into page');
  } catch (error) {
    console.error('[Celora] Failed to inject provider:', error);
  }
}

// Inject as early as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectProvider);
} else {
  injectProvider();
}

// Listen for messages from the injected provider
window.addEventListener('message', async (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;
  
  // Only handle Celora requests
  if (event.data.type !== 'CELORA_REQUEST') return;

  const { id, method, params } = event.data;

  console.log('[Celora] Content script received request:', method, params);

  try {
    // Forward to background script
    const response = await chrome.runtime.sendMessage({
      type: 'DAPP_REQUEST',
      method,
      params,
      origin: window.location.origin
    });

    // Send response back to injected provider
    window.postMessage({
      type: 'CELORA_RESPONSE',
      id,
      result: response
    }, '*');

  } catch (error) {
    console.error('[Celora] Content script error:', error);
    
    // Send error back to injected provider
    window.postMessage({
      type: 'CELORA_RESPONSE',
      id,
      error: error.message || 'Request failed'
    }, '*');
  }
});

// Listen for updates from background script (account changes, chain changes, etc.)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACCOUNT_CHANGED') {
    console.log('[Celora] Account changed:', message.accounts);
    
    // Notify Ethereum provider
    window.postMessage({
      type: 'CELORA_EVENT',
      event: 'accountsChanged',
      data: message.accounts
    }, '*');
  }
  
  if (message.type === 'CHAIN_CHANGED') {
    console.log('[Celora] Chain changed:', message.chainId);
    
    // Notify Ethereum provider
    window.postMessage({
      type: 'CELORA_EVENT',
      event: 'chainChanged',
      data: message.chainId
    }, '*');
  }

  if (message.type === 'DISCONNECT') {
    console.log('[Celora] Disconnected');
    
    // Notify both providers
    window.postMessage({
      type: 'CELORA_EVENT',
      event: 'disconnect',
      data: null
    }, '*');
  }
});

console.log('[Celora] Content script ready');
