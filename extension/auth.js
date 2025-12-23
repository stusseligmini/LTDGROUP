/**
 * CeloraAuth - Firebase Authentication (REST API)
 * Handles sign in, sign out, token management, and session persistence
 * Uses bundled Firebase Auth client (CSP-safe)
 */

(function () {
  'use strict';

  const CeloraAuth = {
    _initialized: false,
    _currentUser: null,

    /**
     * Initialize Auth
     */
    async init() {
      if (this._initialized) return;

      try {
        // Restore Firebase session
        const user = await window.FirebaseAuth.restoreSession();
        if (user) {
          this._currentUser = user;
          console.log('[CeloraAuth] Session restored:', user.email);
        }
        
        this._initialized = true;
        console.log('[CeloraAuth] Initialized');
      } catch (error) {
        console.error('[CeloraAuth] Initialization failed:', error);
        throw error;
      }
    },

    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
      if (!this._initialized) await this.init();

      try {
        console.log('[CeloraAuth] Attempting sign in for:', email);
        
        // Sign in with Firebase
        const user = await window.FirebaseAuth.signInWithEmailAndPassword(email, password);
        this._currentUser = user;
        console.log('[CeloraAuth] ✅ Firebase sign in successful, uid:', user.uid);

        // Get ID token
        const idToken = await window.FirebaseAuth.getIdToken();
        console.log('[CeloraAuth] ✅ ID token acquired, length:', idToken?.length);

        // Save to local storage keys
        await this._saveSession({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          token: idToken,
          expiresAt: Date.now() + 3600000
        });

        console.log('[CeloraAuth] ✅ Session saved, sign in complete');
        return { user, token: idToken };
      } catch (error) {
        console.error('[CeloraAuth] ❌ Sign in failed:', error.message);
        throw new Error(error.message || 'Sign in failed');
      }
    },

    /**
     * Sign out current user
     */
    async signOut() {
      try {
        await window.FirebaseAuth.signOut();
        this._currentUser = null;
        await this._clearSession();
        console.log('[CeloraAuth] Sign out successful');
      } catch (error) {
        console.error('[CeloraAuth] Sign out failed:', error);
        throw error;
      }
    },

    /**
     * Get current ID token (refresh if expired)
     */
    async getToken() {
      if (!this._initialized) await this.init();

      try {
        // Check session expiry first
        const session = await this._getStoredSession();
        if (session && session.expiresAt) {
          const timeRemaining = session.expiresAt - Date.now();
          console.log('[CeloraAuth] Token expiry check:', {
            expiresAt: new Date(session.expiresAt).toISOString(),
            timeRemainingMs: timeRemaining,
            needsRefresh: timeRemaining < 300000 // 5 minutes
          });

          // Force refresh if less than 5 minutes remaining
          if (timeRemaining < 300000) {
            console.log('[CeloraAuth] Token expiring soon, forcing refresh');
            const idToken = await window.FirebaseAuth.getIdToken(true);
            console.log('[CeloraAuth] ✅ Token refreshed, length:', idToken?.length);
            return idToken;
          }
        }

        // Get token (Firebase will auto-refresh if needed)
        const idToken = await window.FirebaseAuth.getIdToken();
        console.log('[CeloraAuth] ✅ Token acquired, length:', idToken?.length);
        return idToken;
      } catch (error) {
        console.error('[CeloraAuth] Get token failed:', error);
        return null;
      }
    },

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
      const session = await this._getStoredSession();
      return !!(session && session.token && session.expiresAt > Date.now());
    },

    /**
     * Get current user data
     */
    async getCurrentUser() {
      const session = await this._getStoredSession();
      return session ? {
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
        photoURL: session.photoURL
      } : null;
    },

    /**
     * Save session to chrome.storage.local
     */
    async _saveSession(session) {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          [window.__STORAGE_KEYS__.SESSION]: session,
          [window.__STORAGE_KEYS__.USER]: {
            uid: session.uid,
            email: session.email,
            displayName: session.displayName,
            photoURL: session.photoURL
          },
          [window.__STORAGE_KEYS__.TOKEN]: session.token
        }, resolve);
      });
    },

    /**
     * Get stored session from chrome.storage.local
     */
    async _getStoredSession() {
      return new Promise((resolve) => {
        chrome.storage.local.get([window.__STORAGE_KEYS__.SESSION], (result) => {
          resolve(result[window.__STORAGE_KEYS__.SESSION] || null);
        });
      });
    },

    /**
     * Clear session from storage
     */
    async _clearSession() {
      return new Promise((resolve) => {
        chrome.storage.local.remove([
          window.__STORAGE_KEYS__.SESSION,
          window.__STORAGE_KEYS__.USER,
          window.__STORAGE_KEYS__.TOKEN
        ], resolve);
      });
    },

    /**
     * Restore session on init
     */
    async _restoreSession() {
      const session = await this._getStoredSession();
      if (session && session.expiresAt > Date.now()) {
        console.log('[CeloraAuth] Session restored:', session.email);
        // Note: Firebase user state is not restored here, only session data
        // This is sufficient for API calls with the stored token
      }
    }
  };

  // Export to global scope
  window.CeloraAuth = CeloraAuth;
})();
