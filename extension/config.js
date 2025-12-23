(function () {
  var appUrl = document.body.dataset.appUrl || 'https://celora-7b552.web.app';
  var apiBase = document.body.dataset.apiBase;
  if (appUrl && appUrl.endsWith('/')) {
    appUrl = appUrl.slice(0, -1);
  }
  window.__CELORA_APP_URL__ = appUrl;
  window.__CELORA_API_BASE__ = apiBase || appUrl + '/api';

  // Firebase configuration (injected via HTML data-* attributes or runtime)
  window.__FIREBASE_CONFIG__ = {
    apiKey: document.body.dataset.firebaseApiKey || window.__FIREBASE_API_KEY,
    authDomain: document.body.dataset.firebaseAuthDomain || 'celora-7b552.firebaseapp.com',
    projectId: document.body.dataset.firebaseProjectId || 'celora-7b552',
    storageBucket: document.body.dataset.firebaseStorageBucket || 'celora-7b552.firebasestorage.app',
    messagingSenderId: document.body.dataset.firebaseMessagingSenderId || '505448793868',
    appId: document.body.dataset.firebaseAppId || '1:505448793868:web:df0e3f80e669ab47a26b29'
  };

  // Storage keys
  window.__STORAGE_KEYS__ = {
    SESSION: 'celora_session',
    USER: 'celora_user',
    TOKEN: 'celora_token'
  };

  // API endpoints
  window.__API_ENDPOINTS__ = {
    WALLET: '/wallet/summary',
    CARDS: '/cards',
    TRANSACTIONS: '/solana/transactions',
    SETTINGS: '/settings',
    NOTIFICATIONS: '/notifications',
    STAKING: '/staking'
  };
})();
