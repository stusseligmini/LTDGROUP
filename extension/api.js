/**
 * CeloraAPI - API Client for Extension
 * Handles all API requests with Bearer token authentication
 */

(function () {
  'use strict';

  const CeloraAPI = {
    _baseURL: null,
    _maxRetries: 2,

    /**
     * Initialize API client
     */
    init() {
      this._baseURL = window.__CELORA_API_BASE__;
      if (!this._baseURL) {
        throw new Error('API base URL not configured');
      }
      console.log('[CeloraAPI] Initialized with base URL:', this._baseURL);
    },

    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
      if (!this._baseURL) this.init();

      const url = `${this._baseURL}${endpoint}`;
      let lastError = null;

      // Retry logic
      for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
        try {
          // Get fresh token and user
          const token = await CeloraAuth.getToken();
          if (!token) {
            throw new Error('No authentication token available');
          }

          const user = await CeloraAuth.getCurrentUser();
          
          // Prepare headers
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(user?.uid && { 'X-User-Id': user.uid }),
            ...options.headers
          };

          // Debug log headers (without full token)
          console.log('[CeloraAPI] Request headers:', {
            url: endpoint,
            hasAuthorization: !!headers['Authorization'],
            tokenPrefix: token?.substring(0, 20) + '...',
            userId: user?.uid,
            method: options.method || 'GET'
          });

          // Make request
          const response = await fetch(url, {
            ...options,
            headers
          });

          // Handle 401 Unauthorized
          if (response.status === 401) {
            console.warn('[CeloraAPI] Unauthorized, signing out...');
            await CeloraAuth.signOut();
            throw new Error('Authentication failed. Please sign in again.');
          }

          // Handle other errors
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          }

          // Return response data
          return await response.json();
        } catch (error) {
          lastError = error;
          console.error(`[CeloraAPI] Request failed (attempt ${attempt + 1}/${this._maxRetries + 1}):`, error);

          // Don't retry on auth errors or client errors
          if (error.message.includes('Authentication') || error.message.includes('401')) {
            break;
          }

          // Wait before retry (exponential backoff)
          if (attempt < this._maxRetries) {
            await this._sleep(Math.pow(2, attempt) * 1000);
          }
        }
      }

      // All retries failed
      throw lastError || new Error('API request failed');
    },

    /**
     * Get wallet data
     */
    async getWallet() {
      try {
        const result = await this.request(window.__API_ENDPOINTS__.WALLET, {
          method: 'GET'
        });
        console.log('[CeloraAPI] Wallet data:', result);
        return result;
      } catch (error) {
        console.error('[CeloraAPI] getWallet failed:', error);
        return { data: { totalFiatBalance: 0, assets: [] } };
      }
    },

    /**
     * Get cards data
     */
    async getCards() {
      try {
        const result = await this.request(window.__API_ENDPOINTS__.CARDS, {
          method: 'GET'
        });
        console.log('[CeloraAPI] Cards:', result);
        return result;
      } catch (error) {
        console.error('[CeloraAPI] getCards failed:', error.message);
        return { success: true, data: { cards: [], pagination: { page: 1, limit: 10, total: 0 } } };
      }
    },

    /**
     * Get transactions
     */
    async getTransactions(params = {}) {
      try {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = window.__API_ENDPOINTS__.TRANSACTIONS + (queryString ? `?${queryString}` : '');
        const result = await this.request(endpoint, {
          method: 'GET'
        });
        console.log('[CeloraAPI] Transactions data:', result);
        return result;
      } catch (error) {
        console.error('[CeloraAPI] getTransactions error:', error.message);
        return { success: true, data: { transactions: [] } };
      }
    },

    /**
     * Get settings
     */
    async getSettings() {
      try {
        const result = await this.request(window.__API_ENDPOINTS__.SETTINGS, {
          method: 'GET'
        });
        console.log('[CeloraAPI] Settings:', result);
        return result;
      } catch (error) {
        console.error('[CeloraAPI] getSettings failed:', error.message);
        return { success: true, data: { settings: { notifications: true, currency: 'USD' } } };
      }
    },

    /**
     * Update settings
     */
    async updateSettings(settings) {
      return this.request(window.__API_ENDPOINTS__.SETTINGS, {
        method: 'POST',
        body: JSON.stringify(settings)
      });
    },

    /**
     * Get notifications
     */
    async getNotifications() {
      try {
        const result = await this.request(window.__API_ENDPOINTS__.NOTIFICATIONS, {
          method: 'GET'
        });
        console.log('[CeloraAPI] Notifications:', result);
        return result;
      } catch (error) {
        console.error('[CeloraAPI] getNotifications failed:', error.message);
        return { success: true, data: { notifications: [] } };
      }
    },

    /**
     * Get staking positions
     */
    async getStakingPositions() {
      try {
        const result = await this.request(window.__API_ENDPOINTS__.STAKING, {
          method: 'GET'
        });
        console.log('[CeloraAPI] Staking positions:', result);
        return result;
      } catch (error) {
        console.error('[CeloraAPI] getStakingPositions error:', error.message);
        return { success: true, data: { positions: [] } };
      }
    },

    /**
     * Sleep utility for retries
     */
    _sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };

  // Export to global scope
  window.CeloraAPI = CeloraAPI;
})();
