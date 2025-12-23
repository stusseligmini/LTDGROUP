/**
 * Celora dApp Provider - Injected into web pages
 * Implements window.solana (Phantom-compatible) and window.ethereum (EIP-1193)
 * 
 * This script is injected into the main world to provide dApp connectivity
 */

(function () {
  'use strict';

  console.log('[Celora] Initializing dApp provider...');

  // ============================================================================
  // SOLANA PROVIDER (Phantom-compatible)
  // ============================================================================

  class CeloraSolanaProvider {
    constructor() {
      this.isPhantom = true; // ✅ Set true for Phantom compatibility
      this.isCelora = true;
      this.isConnected = false;
      this.publicKey = null;
      this._listeners = new Map();
    }

    async connect(opts = {}) {
      console.log('[Celora] Solana connect requested', opts);
      
      try {
        // Request connection from background script
        const response = await this._sendMessage({
          method: 'solana_connect',
          params: { onlyIfTrusted: opts.onlyIfTrusted || false }
        });

        if (response.publicKey) {
          this.publicKey = { toBase58: () => response.publicKey };
          this.isConnected = true;
          this._emit('connect', this.publicKey);
          return { publicKey: this.publicKey };
        }

        throw new Error(response.error || 'Connection failed');
      } catch (error) {
        console.error('[Celora] Connect error:', error);
        throw error;
      }
    }

    async disconnect() {
      console.log('[Celora] Solana disconnect requested');
      
      try {
        await this._sendMessage({ method: 'solana_disconnect' });
      } catch (error) {
        console.error('[Celora] Disconnect error:', error);
      }
      
      this.isConnected = false;
      this.publicKey = null;
      this._emit('disconnect');
    }

    async signAndSendTransaction(transaction, opts = {}) {
      console.log('[Celora] Sign and send transaction', transaction);

      const response = await this._sendMessage({
        method: 'solana_signAndSendTransaction',
        params: {
          transaction: this._serializeTransaction(transaction),
          options: opts
        }
      });

      if (response.signature) {
        return { signature: response.signature };
      }

      throw new Error(response.error || 'Transaction failed');
    }

    async signTransaction(transaction) {
      console.log('[Celora] Sign transaction', transaction);

      const response = await this._sendMessage({
        method: 'solana_signTransaction',
        params: {
          transaction: this._serializeTransaction(transaction)
        }
      });

      if (response.signedTransaction) {
        return this._deserializeTransaction(response.signedTransaction);
      }

      throw new Error(response.error || 'Signing failed');
    }

    async signAllTransactions(transactions) {
      console.log('[Celora] Sign all transactions', transactions.length);

      const response = await this._sendMessage({
        method: 'solana_signAllTransactions',
        params: {
          transactions: transactions.map(tx => this._serializeTransaction(tx))
        }
      });

      if (response.signedTransactions) {
        return response.signedTransactions.map(tx => this._deserializeTransaction(tx));
      }

      throw new Error(response.error || 'Signing failed');
    }

    async signMessage(message, encoding = 'utf8') {
      console.log('[Celora] Sign message');

      const response = await this._sendMessage({
        method: 'solana_signMessage',
        params: {
          message: Array.from(message),
          encoding
        }
      });

      if (response.signature) {
        return { signature: new Uint8Array(response.signature) };
      }

      throw new Error(response.error || 'Message signing failed');
    }

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
    }

    off(event, callback) {
      if (!this._listeners.has(event)) return;
      const listeners = this._listeners.get(event);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }

    // Aliases for Phantom/Solana Wallet Adapter standard
    addListener(event, callback) {
      return this.on(event, callback);
    }

    removeListener(event, callback) {
      return this.off(event, callback);
    }

    once(event, callback) {
      const wrapper = (...args) => {
        callback(...args);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    }

    _emit(event, ...args) {
      if (!this._listeners.has(event)) return;
      this._listeners.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[Celora] Event listener error (${event}):`, error);
        }
      });
    }

    _serializeTransaction(transaction) {
      // Convert transaction to base64 for message passing
      if (transaction.serialize) {
        return Buffer.from(transaction.serialize()).toString('base64');
      }
      return transaction;
    }

    _deserializeTransaction(serialized) {
      // Reconstruct transaction from base64
      return serialized; // Simplified - proper deserialization needed
    }

    async _sendMessage(message) {
      return new Promise((resolve, reject) => {
        const messageId = Math.random().toString(36).substring(7);
        
        const handleResponse = (event) => {
          if (event.data.type === 'CELORA_RESPONSE' && event.data.id === messageId) {
            window.removeEventListener('message', handleResponse);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };

        window.addEventListener('message', handleResponse);
        
        window.postMessage({
          type: 'CELORA_REQUEST',
          id: messageId,
          ...message
        }, '*');

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          reject(new Error('Request timeout'));
        }, 30000);
      });
    }
  }

  // ============================================================================
  // ETHEREUM PROVIDER (EIP-1193)
  // ============================================================================

  class CeloraEthereumProvider {
    constructor() {
      this.isMetaMask = false; // Set false to avoid conflicts
      this.isCelora = true;
      this.isConnected = false;
      this.selectedAddress = null;
      this.chainId = '0x1'; // Ethereum mainnet
      this._listeners = new Map();
    }

    async request({ method, params = [] }) {
      console.log('[Celora] Ethereum request:', method, params);

      switch (method) {
        case 'eth_requestAccounts':
          return this._requestAccounts();
        
        case 'eth_accounts':
          return this.selectedAddress ? [this.selectedAddress] : [];
        
        case 'eth_chainId':
          return this.chainId;
        
        case 'eth_sendTransaction':
          return this._sendTransaction(params[0]);
        
        case 'eth_signTransaction':
          return this._signTransaction(params[0]);
        
        case 'personal_sign':
          return this._personalSign(params[0], params[1]);
        
        case 'eth_sign':
          return this._ethSign(params[1], params[0]);
        
        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4':
          return this._signTypedData(params[1], params[0]);
        
        case 'wallet_switchEthereumChain':
          return this._switchChain(params[0].chainId);
        
        case 'wallet_addEthereumChain':
          return this._addChain(params[0]);
        
        default:
          throw new Error(`Method not supported: ${method}`);
      }
    }

    async _requestAccounts() {
      const response = await this._sendMessage({
        method: 'eth_requestAccounts',
        params: []
      });

      if (response.accounts && response.accounts.length > 0) {
        this.selectedAddress = response.accounts[0];
        this.isConnected = true;
        this._emit('connect', { chainId: this.chainId });
        this._emit('accountsChanged', response.accounts);
        return response.accounts;
      }

      throw new Error('User rejected the request');
    }

    async _sendTransaction(txParams) {
      const response = await this._sendMessage({
        method: 'eth_sendTransaction',
        params: [txParams]
      });

      if (response.txHash) {
        return response.txHash;
      }

      throw new Error(response.error || 'Transaction failed');
    }

    async _signTransaction(txParams) {
      const response = await this._sendMessage({
        method: 'eth_signTransaction',
        params: [txParams]
      });

      if (response.signedTx) {
        return response.signedTx;
      }

      throw new Error(response.error || 'Signing failed');
    }

    async _personalSign(message, address) {
      const response = await this._sendMessage({
        method: 'personal_sign',
        params: [message, address]
      });

      if (response.signature) {
        return response.signature;
      }

      throw new Error(response.error || 'Signing failed');
    }

    async _ethSign(address, message) {
      const response = await this._sendMessage({
        method: 'eth_sign',
        params: [address, message]
      });

      if (response.signature) {
        return response.signature;
      }

      throw new Error(response.error || 'Signing failed');
    }

    async _signTypedData(address, typedData) {
      const response = await this._sendMessage({
        method: 'eth_signTypedData_v4',
        params: [address, typedData]
      });

      if (response.signature) {
        return response.signature;
      }

      throw new Error(response.error || 'Signing failed');
    }

    async _switchChain(chainId) {
      const response = await this._sendMessage({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });

      if (response.success) {
        this.chainId = chainId;
        this._emit('chainChanged', chainId);
        return null;
      }

      throw new Error(response.error || 'Chain switch failed');
    }

    async _addChain(chainParams) {
      const response = await this._sendMessage({
        method: 'wallet_addEthereumChain',
        params: [chainParams]
      });

      if (response.success) {
        return null;
      }

      throw new Error(response.error || 'Add chain failed');
    }

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
    }

    removeListener(event, callback) {
      if (!this._listeners.has(event)) return;
      const listeners = this._listeners.get(event);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }

    _emit(event, ...args) {
      if (!this._listeners.has(event)) return;
      this._listeners.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[Celora] Event listener error (${event}):`, error);
        }
      });
    }

    async _sendMessage(message) {
      return new Promise((resolve, reject) => {
        const messageId = Math.random().toString(36).substring(7);
        
        const handleResponse = (event) => {
          if (event.data.type === 'CELORA_RESPONSE' && event.data.id === messageId) {
            window.removeEventListener('message', handleResponse);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };

        window.addEventListener('message', handleResponse);
        
        window.postMessage({
          type: 'CELORA_REQUEST',
          id: messageId,
          ...message
        }, '*');

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          reject(new Error('Request timeout'));
        }, 30000);
      });
    }
  }

  // ============================================================================
  // INJECT PROVIDERS
  // ============================================================================

  // Inject Solana provider
  if (!window.solana) {
    Object.defineProperty(window, 'solana', {
      value: new CeloraSolanaProvider(),
      writable: false,
      configurable: false
    });
    console.log('[Celora] ✅ Solana provider injected');
  } else {
    console.warn('[Celora] ⚠️ window.solana already exists, not injecting');
  }

  // Inject Ethereum provider
  if (!window.ethereum) {
    Object.defineProperty(window, 'ethereum', {
      value: new CeloraEthereumProvider(),
      writable: false,
      configurable: false
    });
    console.log('[Celora] ✅ Ethereum provider injected');
  } else {
    console.warn('[Celora] ⚠️ window.ethereum already exists, not injecting');
  }

  // Announce provider availability
  window.dispatchEvent(new Event('celora#initialized'));
  console.log('[Celora] 🎉 dApp provider ready');

})();
