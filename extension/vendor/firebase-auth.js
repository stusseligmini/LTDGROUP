/**
 * Firebase Auth Bundle for Extension (CSP-safe, no CDN)
 * Minimal implementation using Firebase REST API
 * 
 * Full SDK bundle is too large (~200KB). This uses Firebase Auth REST API directly.
 * Reference: https://firebase.google.com/docs/reference/rest/auth
 */

(function () {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.apiKey) || (document.body && document.body.dataset && document.body.dataset.firebaseApiKey) || undefined,
    authDomain: (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.authDomain) || 'celora-7b552.firebaseapp.com',
    projectId: (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.projectId) || 'celora-7b552'
  };

  const API_BASE = `https://identitytoolkit.googleapis.com/v1/accounts`;

  class FirebaseAuthClient {
    constructor() {
      this.currentUser = null;
      this.idToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    }

    /**
     * Sign in with email and password
     */
    async signInWithEmailAndPassword(email, password) {
      try {
        const apiKey = FIREBASE_CONFIG.apiKey;
        if (!apiKey) throw new Error('Missing Firebase API key');
        const response = await fetch(`${API_BASE}:signInWithPassword?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            password: password,
            returnSecureToken: true
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Sign in failed');
        }

        const data = await response.json();
        
        this.idToken = data.idToken;
        this.refreshToken = data.refreshToken;
        this.tokenExpiry = Date.now() + (parseInt(data.expiresIn) * 1000);
        this.currentUser = {
          uid: data.localId,
          email: data.email,
          emailVerified: data.emailVerified || false
        };

        // Store tokens
        await this._saveSession();

        return this.currentUser;
      } catch (error) {
        console.error('[FirebaseAuth] Sign in error:', error);
        throw error;
      }
    }

    /**
     * Create new account
     */
    async createUserWithEmailAndPassword(email, password) {
      try {
        const apiKey = FIREBASE_CONFIG.apiKey;
        if (!apiKey) throw new Error('Missing Firebase API key');
        const response = await fetch(`${API_BASE}:signUp?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            password: password,
            returnSecureToken: true
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Sign up failed');
        }

        const data = await response.json();
        
        this.idToken = data.idToken;
        this.refreshToken = data.refreshToken;
        this.tokenExpiry = Date.now() + (parseInt(data.expiresIn) * 1000);
        this.currentUser = {
          uid: data.localId,
          email: data.email,
          emailVerified: false
        };

        await this._saveSession();

        return this.currentUser;
      } catch (error) {
        console.error('[FirebaseAuth] Sign up error:', error);
        throw error;
      }
    }

    /**
     * Get current ID token (refreshes if expired)
     */
    async getIdToken(forceRefresh = false) {
      // Check if token needs refresh
      if (!this.idToken || forceRefresh || Date.now() >= this.tokenExpiry - 60000) {
        await this._refreshIdToken();
      }

      return this.idToken;
    }

    /**
     * Sign out
     */
    async signOut() {
      this.currentUser = null;
      this.idToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;

      return new Promise((resolve) => {
        chrome.storage.local.remove(['celora_firebase_session'], () => {
          resolve();
        });
      });
    }

    /**
     * Restore session from storage
     */
    async restoreSession() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['celora_firebase_session'], async (result) => {
          const session = result.celora_firebase_session;
          
          if (session) {
            this.idToken = session.idToken;
            this.refreshToken = session.refreshToken;
            this.tokenExpiry = session.tokenExpiry;
            this.currentUser = session.currentUser;

            // Refresh if expired
            if (Date.now() >= this.tokenExpiry) {
              try {
                await this._refreshIdToken();
              } catch (error) {
                console.error('[FirebaseAuth] Session refresh failed:', error);
                await this.signOut();
                resolve(null);
                return;
              }
            }

            resolve(this.currentUser);
          } else {
            resolve(null);
          }
        });
      });
    }

    /**
     * Refresh ID token using refresh token
     */
    async _refreshIdToken() {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      try {
        const apiKey = FIREBASE_CONFIG.apiKey;
        if (!apiKey) throw new Error('Missing Firebase API key');
        const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken
          })
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        
        this.idToken = data.id_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000);

        await this._saveSession();
      } catch (error) {
        console.error('[FirebaseAuth] Token refresh error:', error);
        throw error;
      }
    }

    /**
     * Save session to storage
     */
    async _saveSession() {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          celora_firebase_session: {
            idToken: this.idToken,
            refreshToken: this.refreshToken,
            tokenExpiry: this.tokenExpiry,
            currentUser: this.currentUser
          }
        }, () => {
          resolve();
        });
      });
    }
  }

  // Global instance
  window.FirebaseAuth = new FirebaseAuthClient();
})();
