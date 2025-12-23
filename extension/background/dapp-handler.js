/**
 * Background Service Worker - dApp Request Handler
 * 
 * Handles requests from content script and manages wallet operations
 */

// Import existing modules
importScripts('wallet/store.js');
importScripts('wallet/keys-solana.js');
importScripts('wallet/solana-sign.js');
importScripts('auth.js');

console.log('[Celora Background] dApp handler loaded');

// Connected sites storage
const connectedSites = new Map();

/**
 * Handle dApp requests from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'DAPP_REQUEST') return;

  const { method, params, origin } = message;

  console.log('[Celora] Background received dApp request:', method, origin);

  // Handle request asynchronously
  handleDAppRequest(method, params, origin, sender.tab?.id)
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ error: error.message }));

  return true; // Keep channel open for async response
});

/**
 * Route dApp requests to appropriate handlers
 */
async function handleDAppRequest(method, params, origin, tabId) {
  // Check if user is authenticated
  const isAuth = await CeloraAuth.isAuthenticated();
  if (!isAuth && method !== 'solana_connect' && method !== 'eth_requestAccounts') {
    throw new Error('User not authenticated');
  }

  // Solana methods
  if (method.startsWith('solana_')) {
    return handleSolanaRequest(method, params, origin, tabId);
  }

  // Ethereum methods
  if (method.startsWith('eth_') || method.startsWith('personal_') || method.startsWith('wallet_')) {
    return handleEthereumRequest(method, params, origin, tabId);
  }

  throw new Error(`Unknown method: ${method}`);
}

/**
 * Handle Solana-specific requests
 */
async function handleSolanaRequest(method, params, origin, tabId) {
  switch (method) {
    case 'solana_connect': {
      // Check if already connected
      if (connectedSites.has(origin)) {
        const wallet = await WalletStore.getSolanaWallet();
        return { publicKey: wallet.address };
      }

      // Show connection approval popup
      const approved = await showConnectionApproval(origin, 'solana', tabId);
      if (!approved) {
        throw new Error('User rejected the request');
      }

      // Get wallet
      const wallet = await WalletStore.getSolanaWallet();
      
      // Store connected site
      connectedSites.set(origin, { blockchain: 'solana', connectedAt: Date.now() });

      return { publicKey: wallet.address };
    }

    case 'solana_disconnect': {
      connectedSites.delete(origin);
      return { success: true };
    }

    case 'solana_signAndSendTransaction': {
      // Verify site is connected
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      // Show transaction approval
      const approved = await showTransactionApproval(origin, params, 'solana', tabId);
      if (!approved) {
        throw new Error('User rejected the transaction');
      }

      // Sign and send transaction
      const signature = await SolanaSigner.signAndSendTransaction(
        params.transaction,
        params.options
      );

      return { signature };
    }

    case 'solana_signTransaction': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showTransactionApproval(origin, params, 'solana', tabId);
      if (!approved) {
        throw new Error('User rejected the transaction');
      }

      const signedTx = await SolanaSigner.signTransaction(params.transaction);

      return { signedTransaction: signedTx };
    }

    case 'solana_signAllTransactions': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showTransactionApproval(
        origin,
        { transactions: params.transactions },
        'solana',
        tabId
      );
      if (!approved) {
        throw new Error('User rejected the transactions');
      }

      const signedTxs = await Promise.all(
        params.transactions.map(tx => SolanaSigner.signTransaction(tx))
      );

      return { signedTransactions: signedTxs };
    }

    case 'solana_signMessage': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showMessageSigningApproval(origin, params.message, 'solana', tabId);
      if (!approved) {
        throw new Error('User rejected message signing');
      }

      const signature = await SolanaSigner.signMessage(
        new Uint8Array(params.message),
        params.encoding
      );

      return { signature: Array.from(signature) };
    }

    default:
      throw new Error(`Unknown Solana method: ${method}`);
  }
}

/**
 * Handle Ethereum-specific requests
 */
async function handleEthereumRequest(method, params, origin, tabId) {
  switch (method) {
    case 'eth_requestAccounts': {
      // Check if already connected
      if (connectedSites.has(origin)) {
        const wallet = await WalletStore.getEthereumWallet();
        return { accounts: [wallet.address] };
      }

      // Show connection approval
      const approved = await showConnectionApproval(origin, 'ethereum', tabId);
      if (!approved) {
        throw new Error('User rejected the request');
      }

      // Get wallet
      const wallet = await WalletStore.getEthereumWallet();
      
      // Store connected site
      connectedSites.set(origin, { blockchain: 'ethereum', connectedAt: Date.now() });

      return { accounts: [wallet.address] };
    }

    case 'eth_accounts': {
      if (!connectedSites.has(origin)) {
        return { accounts: [] };
      }

      const wallet = await WalletStore.getEthereumWallet();
      return { accounts: [wallet.address] };
    }

    case 'eth_chainId': {
      // Return current chain ID (default: Ethereum mainnet)
      return { chainId: '0x1' };
    }

    case 'eth_sendTransaction': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showTransactionApproval(origin, params[0], 'ethereum', tabId);
      if (!approved) {
        throw new Error('User rejected the transaction');
      }

      // TODO: Implement full Ethereum signing
      throw new Error('Ethereum signing requires user to sign via web interface');
    }

    case 'eth_signTransaction': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showTransactionApproval(origin, params[0], 'ethereum', tabId);
      if (!approved) {
        throw new Error('User rejected the transaction');
      }

      throw new Error('Ethereum signing requires user to sign via web interface');
    }

    case 'personal_sign': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showMessageSigningApproval(origin, params[0], 'ethereum', tabId);
      if (!approved) {
        throw new Error('User rejected message signing');
      }

      throw new Error('Ethereum signing requires user to sign via web interface');
    }

    case 'eth_sign': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showMessageSigningApproval(origin, params[1], 'ethereum', tabId);
      if (!approved) {
        throw new Error('User rejected message signing');
      }

      throw new Error('Ethereum signing requires user to sign via web interface');
    }

    case 'eth_signTypedData':
    case 'eth_signTypedData_v3':
    case 'eth_signTypedData_v4': {
      if (!connectedSites.has(origin)) {
        throw new Error('Site not connected');
      }

      const approved = await showMessageSigningApproval(origin, JSON.stringify(params[1]), 'ethereum', tabId);
      if (!approved) {
        throw new Error('User rejected typed data signing');
      }

      throw new Error('Ethereum signing requires user to sign via web interface');
    }

    case 'wallet_switchEthereumChain': {
      const chainId = params[0]?.chainId || '0x1';
      return { success: true, chainId };
    }

    case 'wallet_addEthereumChain': {
      return { success: true };
    }

    default:
      throw new Error(`Ethereum method not yet implemented: ${method}`);
  }
}

/**
 * Show connection approval popup
 */
async function showConnectionApproval(origin, blockchain, tabId) {
  return new Promise((resolve) => {
    // Create approval popup
    chrome.windows.create({
      url: `popup.html?approval=connect&origin=${encodeURIComponent(origin)}&blockchain=${blockchain}`,
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      // Listen for approval response
      const listener = (message, sender) => {
        if (message.type === 'CONNECTION_APPROVAL' && sender.tab?.windowId === window.id) {
          chrome.runtime.onMessage.removeListener(listener);
          chrome.windows.remove(window.id);
          resolve(message.approved);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
    });
  });
}

/**
 * Show transaction approval popup
 */
async function showTransactionApproval(origin, txData, blockchain, tabId) {
  return new Promise((resolve) => {
    // Create approval popup
    chrome.windows.create({
      url: `popup.html?approval=transaction&origin=${encodeURIComponent(origin)}&blockchain=${blockchain}&data=${encodeURIComponent(JSON.stringify(txData))}`,
      type: 'popup',
      width: 400,
      height: 700
    }, (window) => {
      // Listen for approval response
      const listener = (message, sender) => {
        if (message.type === 'TRANSACTION_APPROVAL' && sender.tab?.windowId === window.id) {
          chrome.runtime.onMessage.removeListener(listener);
          chrome.windows.remove(window.id);
          resolve(message.approved);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
    });
  });
}

/**
 * Show message signing approval popup
 */
async function showMessageSigningApproval(origin, message, blockchain, tabId) {
  return new Promise((resolve) => {
    // Create approval popup
    chrome.windows.create({
      url: `popup.html?approval=sign&origin=${encodeURIComponent(origin)}&blockchain=${blockchain}&message=${encodeURIComponent(message)}`,
      type: 'popup',
      width: 400,
      height: 500
    }, (window) => {
      // Listen for approval response
      const listener = (message, sender) => {
        if (message.type === 'SIGNING_APPROVAL' && sender.tab?.windowId === window.id) {
          chrome.runtime.onMessage.removeListener(listener);
          chrome.windows.remove(window.id);
          resolve(message.approved);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
    });
  });
}

console.log('[Celora] dApp handler ready');
