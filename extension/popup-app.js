/**
 * CeloraUI - Full Wallet Interface for Extension
 * Tabbed interface with Wallet, Cards, Transactions, Alerts, Settings
 */

(function () {
  'use strict';

  function qs(sel) { return document.querySelector(sel); }
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'style') Object.assign(node.style, attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  const CeloraUI = {
    state: {
      currentTab: 'wallet',
      loading: false,
      error: null,
      walletData: null,
      cardsData: null,
      stakingData: null,
      transactionsData: null,
      settingsData: null,
      splashShown: false
    },

    async init() {
      console.log('[CeloraUI] Initializing...');
      
      // Initialize auth
      try {
        await CeloraAuth.init();
      } catch (error) {
        console.error('[CeloraUI] Auth init failed:', error);
      }

      // Initialize API
      CeloraAPI.init();

      // Check if splash screen should be shown
      const hasSeenSplash = localStorage.getItem('celora_splash_seen') === 'true';
      
      if (!hasSeenSplash) {
        this.showSplash();
      } else {
        // Check authentication and render
        const isAuth = await CeloraAuth.isAuthenticated();
        if (isAuth) {
          await this.showWallet();
        } else {
          this.showAuth();
        }
      }
    },

    showSplash() {
      const root = qs('#root');
      root.innerHTML = '';
      root.className = 'cel-splash-container';

      const splashScreen = el('div', { className: 'cel-splash' }, [
        el('div', { className: 'cel-splash__logo' }, [
          el('img', { 
            src: 'assets/image-1764871623265.png',
            alt: 'Celora Lock',
            className: 'cel-lock-image'
          }),
          el('img', { 
            src: 'assets/ea912b77-5b64-4248-bbc1-5cb1615c4695.png',
            alt: 'Celora',
            className: 'cel-text-logo'
          })
        ]),
        el('button', {
          className: 'cel-button cel-button--primary cel-splash__button',
          onclick: async () => {
            localStorage.setItem('celora_splash_seen', 'true');
            this.state.splashShown = true;
            
            // Check auth and show appropriate screen
            const isAuth = await CeloraAuth.isAuthenticated();
            if (isAuth) {
              await this.showWallet();
            } else {
              this.showAuth();
            }
          }
        }, ['Unlock Wallet'])
      ]);

      root.appendChild(splashScreen);
    },

    showAuth() {
      const root = qs('#root');
      root.innerHTML = '';

      const form = el('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          const email = qs('#cel-email').value.trim();
          const password = qs('#cel-password').value;
          await this.handleSignIn(email, password);
        }
      }, [
        el('input', { id: 'cel-email', type: 'email', placeholder: 'Email', required: 'true', className: 'cel-input' }),
        el('input', { id: 'cel-password', type: 'password', placeholder: 'Password', required: 'true', className: 'cel-input' }),
        el('button', { type: 'submit', className: 'cel-button cel-button--primary', style: { width: '100%', marginBottom: '10px' } }, ['Sign In']),
        el('button', { 
          type: 'button', 
          className: 'cel-button cel-button--outline', 
          style: { width: '100%' },
          onclick: () => this.showCreateAccount()
        }, ['Create Account'])
      ]);

      const card = el('div', { className: 'cel-auth-card' }, [
        el('div', { className: 'cel-auth-header' }, [
          el('span', { className: 'cel-auth-icon' }, ['🔒']),
          el('span', { className: 'cel-auth-title' }, ['Celora Wallet'])
        ]),
        this.state.error ? el('div', { className: 'cel-error' }, [this.state.error]) : null,
        form
      ].filter(Boolean));

      root.appendChild(el('div', { className: 'cel-auth' }, [card]));
    },

    showCreateAccount() {
      const root = qs('#root');
      root.innerHTML = '';

      const form = el('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          const email = qs('#cel-new-email').value.trim();
          const password = qs('#cel-new-password').value;
          const confirmPassword = qs('#cel-confirm-password').value;
          
          if (password !== confirmPassword) {
            this.state.error = 'Passwords do not match';
            this.showCreateAccount();
            return;
          }
          
          if (password.length < 8) {
            this.state.error = 'Password must be at least 8 characters';
            this.showCreateAccount();
            return;
          }
          
          await this.handleCreateAccount(email, password);
        }
      }, [
        el('input', { id: 'cel-new-email', type: 'email', placeholder: 'Email', required: 'true', className: 'cel-input' }),
        el('input', { id: 'cel-new-password', type: 'password', placeholder: 'Password (min 8 characters)', required: 'true', className: 'cel-input' }),
        el('input', { id: 'cel-confirm-password', type: 'password', placeholder: 'Confirm Password', required: 'true', className: 'cel-input' }),
        el('button', { type: 'submit', className: 'cel-button cel-button--primary', style: { width: '100%', marginBottom: '10px' } }, ['Create Account']),
        el('button', { 
          type: 'button', 
          className: 'cel-button cel-button--outline', 
          style: { width: '100%' },
          onclick: () => this.showAuth()
        }, ['Back to Sign In'])
      ]);

      const card = el('div', { className: 'cel-auth-card' }, [
        el('div', { className: 'cel-auth-header' }, [
          el('span', { className: 'cel-auth-icon' }, ['✨']),
          el('span', { className: 'cel-auth-title' }, ['Create Account'])
        ]),
        this.state.error ? el('div', { className: 'cel-error' }, [this.state.error]) : null,
        form
      ].filter(Boolean));

      root.appendChild(el('div', { className: 'cel-auth' }, [card]));
    },

    async handleCreateAccount(email, password) {
      this.state.loading = true;
      this.state.error = null;

      try {
        await window.FirebaseAuth.createUserWithEmailAndPassword(email, password);
        alert('✅ Account created! Please sign in.');
        this.showAuth();
      } catch (error) {
        this.state.error = error.message || 'Account creation failed';
        this.showCreateAccount();
      } finally {
        this.state.loading = false;
      }
    },

    async handleSignIn(email, password) {
      this.state.loading = true;
      this.state.error = null;

      try {
        await CeloraAuth.signIn(email, password);
        await this.showWallet();
      } catch (error) {
        this.state.error = error.message || 'Sign in failed';
        this.showAuth();
      } finally {
        this.state.loading = false;
      }
    },

    async handleSignOut() {
      try {
        await CeloraAuth.signOut();
        this.state = {
          currentTab: 'wallet',
          loading: false,
          error: null,
          walletData: null,
          cardsData: null,
          stakingData: null,
          transactionsData: null,
          settingsData: null
        };
        this.showAuth();
      } catch (error) {
        console.error('[CeloraUI] Sign out failed:', error);
      }
    },

    async showWallet() {
      const user = await CeloraAuth.getCurrentUser();
      if (!user) {
        this.showAuth();
        return;
      }

      // Check if wallet is created
      const hasWallet = await WalletStore.hasWallet();
      if (!hasWallet) {
        this.showWalletSetup();
        return;
      }

      const root = qs('#root');
      root.innerHTML = '';

      // Header
      const header = this.renderHeader(user);

      // Tabs
      const tabs = this.renderTabs();

      // Content
      const content = el('div', { className: 'cel-wallet__content', id: 'cel-content' });

      const wallet = el('div', { className: 'cel-wallet' }, [header, tabs, content]);
      root.appendChild(wallet);

      // Load initial tab
      await this.switchTab(this.state.currentTab);
    },

    showWalletSetup() {
      const root = qs('#root');
      root.innerHTML = '';

      const setupCard = el('div', { className: 'cel-auth-card' }, [
        el('div', { className: 'cel-auth-header' }, [
          el('span', { className: 'cel-auth-icon' }, ['🔐']),
          el('span', { className: 'cel-auth-title' }, ['Wallet Setup'])
        ]),
        el('p', { style: { textAlign: 'center', color: '#666', marginBottom: '20px' } }, [
          'Create or import your Solana wallet to get started.'
        ]),
        el('button', {
          className: 'cel-button cel-button--primary',
          style: { width: '100%', marginBottom: '10px' },
          onclick: () => this.createWallet()
        }, ['Create New Wallet']),
        el('button', {
          className: 'cel-button cel-button--outline',
          style: { width: '100%' },
          onclick: () => this.importWallet()
        }, ['Import Existing Wallet'])
      ]);

      root.appendChild(el('div', { className: 'cel-auth' }, [setupCard]));
    },

    async createWallet() {
      try {
        // Generate 12-word mnemonic
        const mnemonic = WalletMnemonic.generate12Words();
        
        // Step 1: Show recovery phrase
        await this.showModal({
          title: '🔐 Save Your Recovery Phrase',
          content: el('div', { style: { textAlign: 'center' } }, [
            el('p', { style: { marginBottom: '15px', color: '#e53e3e', fontWeight: 'bold' } }, [
              '⚠️ IMPORTANT: Write these words down on paper!'
            ]),
            el('div', { 
              style: { 
                background: '#1a202c', 
                padding: '15px', 
                borderRadius: '8px', 
                marginBottom: '15px',
                wordBreak: 'break-word',
                lineHeight: '1.8',
                fontSize: '14px'
              } 
            }, [mnemonic]),
            el('p', { style: { fontSize: '12px', color: '#a0aec0' } }, [
              'You will need this phrase to recover your wallet. Store it safely!'
            ])
          ]),
          confirmText: 'I Have Written It Down',
          cancelText: 'Cancel'
        });

        // Step 2: Confirm saved
        await this.showModal({
          title: '✅ Confirm Backup',
          content: el('p', { style: { textAlign: 'center' } }, [
            'Have you written down all 12 words in order?',
            el('br'),
            el('br'),
            'This is your only way to recover your wallet if you forget your password.'
          ]),
          confirmText: 'Yes, I Saved It',
          cancelText: 'Go Back'
        });

        // Step 3: Set password
        const password = await this.showPasswordModal({
          title: '🔒 Set Wallet Password',
          placeholder: 'Enter password (min 8 characters)',
          confirmPlaceholder: 'Confirm password'
        });

        if (!password) return;

        // Encrypt and save
        const encryptedSeed = await WalletCrypto.encryptSeed(mnemonic, password);
        await WalletStore.saveEncryptedSeed(encryptedSeed);

        // Derive addresses
        const { address: solanaAddress } = await SolanaKeys.deriveAddress(mnemonic);
        await WalletStore.savePublicAddresses({ solana: solanaAddress });

        // Register address with backend
        try {
          await CeloraAPI.request('/wallet/register', {
            method: 'POST',
            body: JSON.stringify({ address: solanaAddress, chain: 'solana' })
          });
        } catch (error) {
          console.error('[CeloraUI] Failed to register address:', error);
        }

        // Success modal
        await this.showModal({
          title: '✅ Wallet Created!',
          content: el('div', { style: { textAlign: 'center' } }, [
            el('p', { style: { marginBottom: '10px' } }, ['Your wallet has been created successfully.']),
            el('p', { style: { fontSize: '12px', color: '#a0aec0', wordBreak: 'break-all' } }, [
              'Address: ' + solanaAddress.slice(0, 8) + '...' + solanaAddress.slice(-8)
            ])
          ]),
          confirmText: 'Continue',
          cancelText: null
        });

        await this.showWallet();
      } catch (error) {
        if (error.message !== 'cancelled') {
          await this.showModal({
            title: '❌ Error',
            content: el('p', null, ['Failed to create wallet: ' + error.message]),
            confirmText: 'OK',
            cancelText: null
          });
        }
      }
    },

    async importWallet() {
      try {
        // Step 1: Get recovery phrase
        const mnemonic = await this.showInputModal({
          title: '📥 Import Wallet',
          placeholder: 'Enter your 12 or 24 word recovery phrase',
          multiline: true
        });

        if (!mnemonic) return;

        // Validate mnemonic
        const isValid = WalletMnemonic.validate(mnemonic);
        if (!isValid) {
          await this.showModal({
            title: '❌ Invalid Phrase',
            content: el('p', null, ['The recovery phrase you entered is invalid. Please check and try again.']),
            confirmText: 'OK',
            cancelText: null
          });
          return;
        }

        // Step 2: Set password
        const password = await this.showPasswordModal({
          title: '🔒 Set Wallet Password',
          placeholder: 'Enter password (min 8 characters)',
          confirmPlaceholder: 'Confirm password'
        });

        if (!password) return;

        // Encrypt and save
        const encryptedSeed = await WalletCrypto.encryptSeed(mnemonic, password);
        await WalletStore.saveEncryptedSeed(encryptedSeed);

        // Derive addresses
        const { address: solanaAddress } = await SolanaKeys.deriveAddress(mnemonic);
        await WalletStore.savePublicAddresses({ solana: solanaAddress });

        // Register with backend
        try {
          await CeloraAPI.request('/wallet/register', {
            method: 'POST',
            body: JSON.stringify({ address: solanaAddress, chain: 'solana' })
          });
        } catch (error) {
          console.error('[CeloraUI] Failed to register address:', error);
        }

        // Success modal
        await this.showModal({
          title: '✅ Wallet Imported!',
          content: el('div', { style: { textAlign: 'center' } }, [
            el('p', { style: { marginBottom: '10px' } }, ['Your wallet has been imported successfully.']),
            el('p', { style: { fontSize: '12px', color: '#a0aec0', wordBreak: 'break-all' } }, [
              'Address: ' + solanaAddress.slice(0, 8) + '...' + solanaAddress.slice(-8)
            ])
          ]),
          confirmText: 'Continue',
          cancelText: null
        });

        await this.showWallet();
      } catch (error) {
        if (error.message !== 'cancelled') {
          await this.showModal({
            title: '❌ Error',
            content: el('p', null, ['Failed to import wallet: ' + error.message]),
            confirmText: 'OK',
            cancelText: null
          });
        }
      }
    },

    renderHeader(user) {
      return el('div', { className: 'cel-wallet__header' }, [
        el('div', { className: 'cel-wallet__info' }, [
          el('div', { className: 'cel-logo' }, [
            el('div', { className: 'cel-logo__gradient' }, ['C']),
            el('span', { className: 'cel-logo__text' }, ['CELORA'])
          ]),
          el('div', { className: 'cel-wallet__email' }, [user.email || 'Unknown'])
        ]),
        el('div', { className: 'cel-wallet__actions' }, [
          el('button', {
            type: 'button',
            className: 'cel-button cel-button--icon',
            onclick: () => this.handleSignOut(),
            title: 'Sign out'
          }, ['→'])
        ])
      ]);
    },

    renderTabs() {
      const tabs = [
        { id: 'wallet', label: 'Wallet', icon: '💰' },
        { id: 'cards', label: 'Cards', icon: '💳' },
        { id: 'defi', label: 'DeFi', icon: '🏦' },
        { id: 'transactions', label: 'Activity', icon: '📊' },
        { id: 'settings', label: 'Settings', icon: '⚙️' }
      ];

      return el('div', { className: 'cel-tabs' }, tabs.map(tab =>
        el('button', {
          type: 'button',
          className: `cel-tab ${this.state.currentTab === tab.id ? 'cel-tab--active' : ''}`,
          onclick: () => this.switchTab(tab.id)
        }, [
          el('span', { className: 'cel-tab__icon' }, [tab.icon]),
          el('span', { className: 'cel-tab__label' }, [tab.label])
        ])
      ));
    },

    async switchTab(tabId) {
      this.state.currentTab = tabId;
      
      // Update tab buttons
      document.querySelectorAll('.cel-tab').forEach(btn => {
        btn.classList.toggle('cel-tab--active', btn.textContent.includes(this.getTabIcon(tabId)));
      });

      // Render content
      const content = qs('#cel-content');
      content.innerHTML = '';
      content.appendChild(el('div', { className: 'cel-loading' }, ['Loading...']));

      try {
        let view;
        switch (tabId) {
          case 'wallet':
            view = await this.renderWalletTab();
            break;
          case 'cards':
            view = await this.renderCardsTab();
            break;
          case 'defi':
            view = await this.renderDeFiTab();
            break;
          case 'transactions':
            view = await this.renderTransactionsTab();
            break;
          case 'settings':
            view = await this.renderSettingsTab();
            break;
          default:
            view = el('div', null, ['Unknown tab']);
        }
        content.innerHTML = '';
        content.appendChild(view);
      } catch (error) {
        content.innerHTML = '';
        content.appendChild(el('div', { className: 'cel-error' }, [error.message || 'Failed to load']));
      }
    },

    getTabIcon(tabId) {
      const icons = { wallet: '💰', cards: '💳', defi: '🏦', transactions: '📊', settings: '⚙️' };
      return icons[tabId] || '';
    },

    async renderWalletTab() {
      // Load public addresses from storage
      const addresses = await WalletStore.loadPublicAddresses();
      const solanaAddress = addresses?.solana || 'Not available';

      // Try to get balance from backend
      if (!this.state.walletData) {
        try {
          this.state.walletData = await CeloraAPI.getWallet();
        } catch (error) {
          console.error('[CeloraUI] Failed to fetch wallet data:', error);
          this.state.walletData = { balance: 0 };
        }
      }

      const balance = this.state.walletData?.data?.totalFiatBalance || this.state.walletData?.totalFiatBalance || 0;

      // Top actions bar
      const actionsBar = el('div', { className: 'cel-actions cel-actions--top' }, [
        el('button', { className: 'cel-button cel-button--ghost', onclick: () => this.openReceiveModal(solanaAddress) }, ['📥 Receive']),
        el('button', { className: 'cel-button cel-button--primary', onclick: () => this.openSendModal(solanaAddress) }, ['📤 Send']),
        el('button', { className: 'cel-button cel-button--outline', onclick: () => this.openSwapModal() }, ['🔁 Swap']),
        el('button', { className: 'cel-button cel-button--outline', onclick: () => this.openBuyModal(solanaAddress) }, ['💳 Buy'])
      ]);

      // Token list (simple fallback if holdings missing)
      const holdings = this.state.walletData?.data?.holdings || this.state.walletData?.holdings || [
        { symbol: 'SOL', name: 'Solana', amount: 0, fiatValue: 0, icon: '◎' },
        { symbol: 'USDC', name: 'USD Coin', amount: 0, fiatValue: 0, icon: '💵' }
      ];

      const holdingRows = el('div', { className: 'cel-list cel-list--tokens' }, holdings.map(h =>
        el('div', { className: 'cel-list__item cel-list__item--token' }, [
          el('div', { className: 'cel-token-icon' }, [h.icon || (h.symbol === 'SOL' ? '◎' : h.symbol === 'USDC' ? '💵' : h.symbol === 'ETH' ? 'Ξ' : h.symbol === 'BTC' ? '₿' : '🪙')]),
          el('div', { className: 'cel-list__content' }, [
            el('div', { className: 'cel-list__title' }, [h.name || h.symbol]),
            el('div', { className: 'cel-list__subtitle' }, [`${(h.amount || 0).toFixed(4)} ${h.symbol}`])
          ]),
          el('div', { className: 'cel-list__meta cel-list__meta--values' }, [
            el('div', { className: 'cel-fiat-value' }, [`$${(h.fiatValue || 0).toFixed(2)}`])
          ])
        ])
      ));

      return el('div', { className: 'cel-tab-content' }, [
        el('div', { className: 'cel-card cel-card--balance' }, [
          el('div', { className: 'cel-eyebrow' }, ['TOTAL BALANCE']),
          el('div', { className: 'cel-balance' }, [`$${balance.toFixed(2)}`]),
          el('div', { className: 'cel-caption' }, ['USD equivalent'])
        ]),
        actionsBar,
        el('div', { className: 'cel-card' }, [
          el('div', { className: 'cel-card__header' }, [el('span', { className: 'cel-eyebrow' }, ['RECEIVE ADDRESS'])]),
          el('div', { className: 'cel-address' }, [
            el('code', null, [solanaAddress.slice(0, 6) + '...' + solanaAddress.slice(-4)])
          ]),
          el('div', { className: 'cel-caption' }, [solanaAddress])
        ]),
        el('div', { className: 'cel-card' }, [
          el('div', { className: 'cel-card__header' }, [el('span', { className: 'cel-eyebrow' }, ['TOKENS'])]),
          holdingRows
        ])
      ]);
    },

    async openSendModal(fromAddress) {
      try {
        // Recipient input
        const to = await this.showInputModal({ title: '📤 Send SOL', placeholder: 'Recipient Solana address' });
        if (!to) return;

        // Amount input
        const amountStr = await this.showInputModal({ title: 'Amount (SOL)', placeholder: 'e.g. 0.25' });
        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          await this.showModal({ title: '❌ Invalid amount', content: 'Please enter a valid amount.', confirmText: 'OK', cancelText: null });
          return;
        }

        // Password
        const password = await this.showInputModal({ title: '🔒 Wallet Password', placeholder: 'Enter password' });
        if (!password) return;

        const network = await WalletStore.loadNetwork();

        const result = await SolanaSign.signTransfer({
          password,
          toAddress: to,
          amount,
          network
        });

        const signature = await SolanaSign.sendSignedTransaction(result.signedTransaction, network);

        await this.showModal({
          title: '✅ Transaction Sent',
          content: `Signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
          confirmText: 'Done',
          cancelText: null
        });

        this.state.walletData = null;
        await this.switchTab('wallet');
      } catch (err) {
        if (err?.message !== 'cancelled') {
          await this.showModal({ title: '❌ Error', content: err.message || 'Failed to send', confirmText: 'OK', cancelText: null });
        }
      }
    },

    async openReceiveModal(address) {
      // Build Solana URI (amount/memo optional via inline inputs)
      const amountInput = el('input', { className: 'cel-input', type: 'text', placeholder: 'Amount (optional)', style: { width: '100%', marginTop: '8px' } });
      const memoInput = el('input', { className: 'cel-input', type: 'text', placeholder: 'Memo (optional)', style: { width: '100%', marginTop: '8px' } });

      const canvas = el('canvas', { width: '240', height: '240', style: { background: '#fff', borderRadius: '12px' } });
      const qrContainer = el('div', { className: 'modern-card', style: { padding: '16px', display: 'flex', justifyContent: 'center' } }, [canvas]);

      const renderQR = async () => {
        let uri = `solana:${address}`;
        const params = new URLSearchParams();
        const amt = amountInput.value.trim();
        const memo = memoInput.value.trim();
        if (amt) params.append('amount', amt);
        if (memo) params.append('memo', memo);
        const qs = params.toString();
        if (qs) uri += `?${qs}`;

        try {
          // Minimal QR generation via qrcode library if available; else fallback simple
          if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
            await window.QRCode.toCanvas(canvas, uri, { width: 240, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } });
          } else {
            // Fallback text if QR lib not loaded
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000';
            ctx.font = '12px monospace';
            ctx.fillText('Scan:', 12, 24);
            ctx.fillText(uri.length > 28 ? uri.slice(0, 28) + '...' : uri, 12, 40);
          }
        } catch (e) {
          console.error('QR render failed:', e);
        }
      };

      amountInput.addEventListener('input', renderQR);
      memoInput.addEventListener('input', renderQR);

      await this.showModal({
        title: '📥 Receive SOL',
        content: el('div', null, [
          el('div', { className: 'cel-address', style: { marginBottom: '8px' } }, [
            el('code', null, [address.slice(0, 6) + '...' + address.slice(-4)])
          ]),
          qrContainer,
          amountInput,
          memoInput
        ]),
        confirmText: 'Done',
        cancelText: null
      });

      await renderQR();
    },

    async openSwapModal() {
      const address = await WalletStore.getAddress();
      if (!address) {
        this.showModal({ title: '🔁 Swap', content: 'No wallet found. Create or import a wallet first.', confirmText: 'OK', cancelText: null });
        return;
      }

      const form = el('div', { class: 'swap-form' }, [
        el('label', null, ['From Token:']),
        el('select', { id: 'swap-from-token', class: 'cel-select' }, [
          el('option', { value: 'So11111111111111111111111111111111111111112' }, ['SOL']),
          el('option', { value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, ['USDC']),
          el('option', { value: 'Es9vMFrzaCERZzW1Yw4qF9hQxNxqzqH7h1gW4P3AfkG' }, ['USDT']),
        ]),
        el('br'),
        el('label', null, ['To Token:']),
        el('select', { id: 'swap-to-token', class: 'cel-select' }, [
          el('option', { value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, ['USDC']),
          el('option', { value: 'So11111111111111111111111111111111111111112' }, ['SOL']),
          el('option', { value: 'Es9vMFrzaCERZzW1Yw4qF9hQxNxqzqH7h1gW4P3AfkG' }, ['USDT']),
        ]),
        el('br'),
        el('label', null, ['Amount:']),
        el('input', { type: 'number', id: 'swap-amount', class: 'cel-input', placeholder: '0.0', step: '0.01' }),
        el('br'),
        el('div', { id: 'swap-quote', style: 'margin-top: 12px; padding: 10px; background: rgba(10, 245, 211, 0.1); border-radius: 8px; display: none;' }),
      ]);

      const modal = await this.showModal({
        title: '🔁 Token Swap',
        content: form,
        confirmText: 'Get Quote',
        cancelText: 'Cancel',
      });

      if (modal) {
        const fromToken = document.getElementById('swap-from-token').value;
        const toToken = document.getElementById('swap-to-token').value;
        const amount = document.getElementById('swap-amount').value;

        if (!amount || parseFloat(amount) <= 0) {
          this.showModal({ title: 'Error', content: 'Please enter a valid amount.', confirmText: 'OK', cancelText: null });
          return;
        }

        // Get quote
        try {
          this.showModal({ title: '🔁 Fetching Quote...', content: el('div', { class: 'cel-loading' }, [
            el('div', { class: 'cel-loading__spinner' }),
            el('div', { class: 'cel-loading__label' }, ['Please wait'])
          ]), confirmText: null, cancelText: null });

          const fromDecimals = fromToken === 'So11111111111111111111111111111111111111112' ? 9 : 6;
          const amountLamports = Math.floor(parseFloat(amount) * Math.pow(10, fromDecimals));

          const quote = await JupiterSwap.getQuote(fromToken, toToken, amountLamports);
          
          const toDecimals = toToken === 'So11111111111111111111111111111111111111112' ? 9 : 6;
          const outputAmount = JupiterSwap.formatAmount(quote.outAmount, toDecimals);

          const quoteConfirm = await this.showModal({
            title: '📊 Swap Quote',
            content: el('div', null, [
              el('p', null, [`You will receive approximately ${outputAmount} tokens`]),
              el('p', { style: 'font-size: 11px; color: var(--color-text-muted);' }, [`Price impact: ${(quote.priceImpactPct || 0).toFixed(2)}%`]),
              el('br'),
              el('label', null, ['Enter password to confirm:']),
              el('input', { type: 'password', id: 'swap-password', class: 'cel-input', placeholder: 'Wallet password' }),
            ]),
            confirmText: 'Execute Swap',
            cancelText: 'Cancel',
          });

          if (quoteConfirm) {
            const password = document.getElementById('swap-password').value;
            
            this.showModal({ title: '🔁 Executing Swap...', content: el('div', { class: 'cel-loading' }, [
              el('div', { class: 'cel-loading__spinner' }),
              el('div', { class: 'cel-loading__label' }, ['Signing transaction'])
            ]), confirmText: null, cancelText: null });

            // Execute swap
            const result = await JupiterSwap.executeSwap(quote, address, async (txBuffer) => {
              const encData = await WalletStore.getEncryptedData();
              const keys = await walletSigningModule.recoverKeysFromStorage(password, encData);
              return await walletSigningModule.signTransaction(txBuffer, keys.secretKey);
            });

            this.showModal({
              title: '✅ Swap Successful',
              content: el('p', null, [`Transaction: ${result.signature.slice(0, 8)}...${result.signature.slice(-8)}`]),
              confirmText: 'OK',
              cancelText: null,
            });

            // Refresh balance
            this.renderWalletTab();
          }
        } catch (error) {
          console.error('Swap failed:', error);
          this.showModal({ title: 'Swap Failed', content: error.message || 'An error occurred', confirmText: 'OK', cancelText: null });
        }
      }
    },

    openBuyModal(address) {
      try {
        const base = 'https://buy.moonpay.com';
        const params = new URLSearchParams({ walletAddress: address, defaultCryptoCurrency: 'sol' });
        const url = `${base}?${params.toString()}`;
        this.showModal({ title: '💳 Buy Crypto', content: el('p', null, ['We will open MoonPay in a new tab.']), confirmText: 'Open', cancelText: 'Cancel' })
          .then(() => {
            try { chrome.tabs.create({ url }); } catch { window.open(url, '_blank'); }
          });
      } catch (e) {
        console.error('Buy flow failed:', e);
      }
    },

    async renderCardsTab() {
      if (!this.state.cardsData) {
        this.state.cardsData = await CeloraAPI.getCards();
      }

      const cards = this.state.cardsData?.data?.cards || this.state.cardsData?.cards || [];

      if (cards.length === 0) {
        return el('div', { className: 'cel-tab-content' }, [
          el('div', { className: 'cel-empty' }, [
            el('div', { className: 'cel-empty__icon' }, ['💳']),
            el('div', { className: 'cel-empty__text' }, ['No cards yet']),
            el('div', { className: 'cel-empty__subtitle' }, ['Create a virtual card to start spending your crypto']),
            el('button', { 
              className: 'cel-button cel-button--primary',
              onclick: () => alert('Card creation coming soon!')
            }, ['Create Virtual Card'])
          ])
        ]);
      }

      return el('div', { className: 'cel-tab-content' }, [
        el('button', { 
          className: 'cel-button cel-button--primary',
          style: { width: '100%', marginBottom: '16px' },
          onclick: () => alert('Card creation coming soon!')
        }, ['+ Create Virtual Card']),
        el('div', { className: 'cel-list' }, cards.map(card => {
          const spent = card.monthlySpent || 0;
          const limit = card.monthlyLimit || card.spendingLimit || 1000;
          const percentage = Math.min((spent / limit) * 100, 100);
          
          return el('div', { className: 'cel-card cel-card--interactive' }, [
            el('div', { className: 'cel-card__header' }, [
              el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                el('div', { className: 'cel-list__icon', style: { margin: 0 } }, ['💳']),
                el('div', null, [
                  el('div', { className: 'cel-list__title' }, [card.nickname || 'Virtual Card']),
                  el('div', { className: 'cel-list__subtitle' }, [
                    `${card.brand || 'VISA'} •••• ${card.lastFourDigits || card.last4 || '0000'}`
                  ])
                ])
              ]),
              el('span', { className: `cel-badge cel-badge--${card.status || 'active'}` }, [card.status || 'active'])
            ]),
            el('div', { style: { marginTop: '12px' } }, [
              el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' } }, [
                el('span', { style: { color: 'rgba(148, 163, 184, 0.7)' } }, ['Monthly Spending']),
                el('span', { style: { fontWeight: '600' } }, [`$${spent.toFixed(2)} / $${limit.toFixed(0)}`])
              ]),
              el('div', { className: 'cel-progress-bar' }, [
                el('div', { className: 'cel-progress-bar__fill', style: { width: `${percentage}%` } })
              ])
            ])
          ]);
        }))
      ]);
    },

    async renderDeFiTab() {
      if (!this.state.stakingData) {
        this.state.stakingData = await CeloraAPI.getStakingPositions();
      }

      const positions = this.state.stakingData?.data?.positions || this.state.stakingData?.positions || [];

      return el('div', { className: 'cel-tab-content' }, [
        el('div', { className: 'cel-card' }, [
          el('div', { className: 'cel-card__header' }, [
            el('span', { className: 'cel-eyebrow' }, ['STAKING POSITIONS']),
            el('button', { 
              className: 'cel-button cel-button--primary cel-button--small',
              onclick: () => alert('Staking coming soon!')
            }, ['+ Stake'])
          ])
        ]),
        positions.length === 0 ? el('div', { className: 'cel-empty' }, [
          el('div', { className: 'cel-empty__icon' }, ['🏦']),
          el('div', { className: 'cel-empty__text' }, ['No staking positions']),
          el('div', { className: 'cel-empty__subtitle' }, ['Stake your crypto to earn rewards']),
          el('button', { 
            className: 'cel-button cel-button--primary',
            onclick: () => alert('Staking coming soon!')
          }, ['Start Staking'])
        ]) : el('div', { className: 'cel-list' }, positions.map(pos => {
          const apy = pos.currentApy || pos.apr || 0;
          const rewards = parseFloat(pos.rewards || pos.rewardsEarned || 0);
          const amount = parseFloat(pos.stakedAmount || pos.amount || 0);
          
          return el('div', { className: 'cel-card cel-card--interactive' }, [
            el('div', { className: 'cel-card__header' }, [
              el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                el('div', { className: 'cel-list__icon', style: { margin: 0 } }, ['🏦']),
                el('div', null, [
                  el('div', { className: 'cel-list__title' }, [pos.blockchain?.toUpperCase() || 'Staking']),
                  el('div', { className: 'cel-list__subtitle' }, [
                    pos.validatorAddress ? `${pos.validatorAddress.slice(0, 6)}...${pos.validatorAddress.slice(-4)}` : 'Native Staking'
                  ])
                ])
              ]),
              el('span', { className: `cel-badge cel-badge--${pos.status || 'active'}` }, [pos.status || 'active'])
            ]),
            el('div', { className: 'cel-holdings', style: { marginTop: '12px' } }, [
              el('div', { className: 'cel-holding-row' }, [
                el('span', { className: 'cel-holding-row__caption' }, ['Staked Amount']),
                el('span', { style: { fontWeight: '600' } }, [`${amount.toFixed(4)} ${pos.blockchain?.toUpperCase() || ''}`])
              ]),
              el('div', { className: 'cel-holding-row' }, [
                el('span', { className: 'cel-holding-row__caption' }, ['APY']),
                el('span', { style: { fontWeight: '600', color: '#4ade80' } }, [`${apy.toFixed(2)}%`])
              ]),
              el('div', { className: 'cel-holding-row' }, [
                el('span', { className: 'cel-holding-row__caption' }, ['Rewards Earned']),
                el('span', { style: { fontWeight: '600', color: '#0af5d3' } }, [`${rewards.toFixed(4)} ${pos.blockchain?.toUpperCase() || ''}`])
              ])
            ]),
            el('div', { className: 'cel-actions', style: { marginTop: '12px' } }, [
              el('button', { 
                className: 'cel-button cel-button--outline',
                onclick: () => alert('Claim rewards coming soon!')
              }, ['Claim Rewards']),
              el('button', { 
                className: 'cel-button cel-button--ghost',
                onclick: () => alert('Unstake coming soon!')
              }, ['Unstake'])
            ])
          ]);
        }))
      ]);
    },

    async renderTransactionsTab() {
      if (!this.state.transactionsData) {
        this.state.transactionsData = await CeloraAPI.getTransactions({ limit: 10 });
      }

      const transactions = this.state.transactionsData?.data?.transactions || this.state.transactionsData?.transactions || [];

      if (transactions.length === 0) {
        return el('div', { className: 'cel-tab-content' }, [
          el('div', { className: 'cel-empty' }, [
            el('div', { className: 'cel-empty__icon' }, ['📊']),
            el('div', { className: 'cel-empty__text' }, ['No transactions yet'])
          ])
        ]);
      }

      return el('div', { className: 'cel-tab-content' }, [
        el('div', { className: 'cel-list' }, transactions.map(tx =>
          el('div', { className: 'cel-list__item' }, [
            el('div', { className: 'cel-list__icon' }, [tx.type === 'credit' ? '↓' : '↑']),
            el('div', { className: 'cel-list__content' }, [
              el('div', { className: 'cel-list__title' }, [tx.description || 'Transaction']),
              el('div', { className: 'cel-list__subtitle' }, [new Date(tx.timestamp).toLocaleDateString()])
            ]),
            el('div', { className: 'cel-list__meta' }, [
              el('span', { className: `cel-amount cel-amount--${tx.type}` }, [
                `${tx.type === 'credit' ? '+' : '-'}$${tx.amount.toFixed(2)}`
              ])
            ])
          ])
        ))
      ]);
    },

    async renderSettingsTab() {
      if (!this.state.settingsData) {
        try {
          this.state.settingsData = await CeloraAPI.getSettings();
        } catch (error) {
          console.error('[CeloraUI] Failed to fetch settings:', error);
          this.state.settingsData = {};
        }
      }

      const settings = this.state.settingsData || {};
      const currentNetwork = await WalletStore.loadNetwork();

      return el('div', { className: 'cel-tab-content' }, [
        el('div', { className: 'cel-card' }, [
          el('div', { className: 'cel-card__header' }, [el('span', { className: 'cel-eyebrow' }, ['NETWORK'])]),
          el('div', { className: 'cel-list cel-list--settings' }, [
            el('div', { className: 'cel-list__item' }, [
              el('div', { className: 'cel-list__content' }, [
                el('div', { className: 'cel-list__title' }, ['Solana Network']),
                el('div', { className: 'cel-list__subtitle' }, ['Switch between devnet and mainnet'])
              ]),
              el('select', {
                className: 'cel-select',
                value: currentNetwork,
                onchange: async (e) => {
                  await WalletStore.saveNetwork(e.target.value);
                  alert(`Network switched to ${e.target.value}`);
                }
              }, [
                el('option', { value: 'devnet', selected: currentNetwork === 'devnet' ? 'true' : null }, ['Devnet (Testing)']),
                el('option', { value: 'mainnet', selected: currentNetwork === 'mainnet' ? 'true' : null }, ['Mainnet (Live)'])
              ])
            ])
          ])
        ]),
        el('div', { className: 'cel-card' }, [
          el('div', { className: 'cel-card__header' }, [el('span', { className: 'cel-eyebrow' }, ['PREFERENCES'])]),
          el('div', { className: 'cel-list cel-list--settings' }, [
            el('div', { className: 'cel-list__item' }, [
              el('div', { className: 'cel-list__content' }, [
                el('div', { className: 'cel-list__title' }, ['Notifications']),
                el('div', { className: 'cel-list__subtitle' }, ['Get alerts for transactions'])
              ]),
              el('label', { className: 'cel-toggle' }, [
                el('input', { type: 'checkbox', checked: settings.notifications ? 'true' : null }),
                el('span', { className: 'cel-toggle__slider' })
              ])
            ]),
            el('div', { className: 'cel-list__item' }, [
              el('div', { className: 'cel-list__content' }, [
                el('div', { className: 'cel-list__title' }, ['Currency']),
                el('div', { className: 'cel-list__subtitle' }, ['Display currency'])
              ]),
              el('select', { className: 'cel-select' }, [
                el('option', { value: 'USD' }, ['USD ($)']),
                el('option', { value: 'EUR' }, ['EUR (€)'])
              ])
            ])
          ])
        ]),
        el('div', { className: 'cel-card' }, [
          el('div', { className: 'cel-card__header' }, [el('span', { className: 'cel-eyebrow' }, ['WALLET MANAGEMENT'])]),
          el('div', { className: 'cel-list cel-list--settings' }, [
            el('button', { 
              className: 'cel-list__item cel-list__item--button',
              onclick: () => this.showRecoveryPhrase()
            }, [
              el('div', { className: 'cel-list__content' }, [
                el('div', { className: 'cel-list__title' }, ['Show Recovery Phrase']),
                el('div', { className: 'cel-list__subtitle' }, ['View your backup words'])
              ]),
              el('span', null, ['→'])
            ]),
            el('button', { 
              className: 'cel-list__item cel-list__item--button',
              onclick: () => this.resetWallet(),
              style: { color: '#e53e3e' }
            }, [
              el('div', { className: 'cel-list__content' }, [
                el('div', { className: 'cel-list__title' }, ['Reset Wallet']),
                el('div', { className: 'cel-list__subtitle' }, ['Delete wallet and create new one'])
              ]),
              el('span', null, ['⚠️'])
            ])
          ])
        ])
      ]);
    },

    async showRecoveryPhrase() {
      const password = prompt('Enter wallet password to view recovery phrase:');
      if (!password) return;

      try {
        const encryptedSeed = await WalletStore.loadEncryptedSeed();
        if (!encryptedSeed) {
          alert('No wallet found');
          return;
        }

        const mnemonic = await WalletCrypto.decryptSeed(encryptedSeed, password);
        
        alert(`🔐 RECOVERY PHRASE (NEVER SHARE)\n\n${mnemonic}\n\nWrite this down and store it safely!`);
      } catch (error) {
        alert('Failed to decrypt: ' + error.message);
      }
    },

    async resetWallet() {
      const confirmed = confirm(
        '⚠️ WARNING: Reset Wallet?\n\n' +
        'This will DELETE your current wallet permanently!\n\n' +
        'Make sure you have saved your recovery phrase.\n\n' +
        'After reset, you can create a new wallet or import an existing one.\n\n' +
        'Continue?'
      );

      if (!confirmed) return;

      const doubleCheck = confirm(
        '🚨 FINAL WARNING!\n\n' +
        'Your wallet will be PERMANENTLY DELETED.\n\n' +
        'Have you saved your recovery phrase?\n\n' +
        'Click OK to proceed with deletion.'
      );

      if (!doubleCheck) return;

      try {
        // Delete wallet from storage
        await WalletStore.deleteWallet();
        
        alert('✅ Wallet deleted. You can now create a new wallet.');
        
        // Show wallet setup screen
        this.showWalletSetup();
      } catch (error) {
        alert('Failed to reset wallet: ' + error.message);
      }
    },

    openApp() {
      const appUrl = window.__CELORA_APP_URL__;
      try {
        chrome.tabs.create({ url: appUrl });
      } catch {
        window.open(appUrl, '_blank');
      }
    },

    // Modal helpers
    showModal({ title, content, confirmText = 'OK', cancelText = 'Cancel' }) {
      return new Promise((resolve, reject) => {
        const modal = el('div', { 
          className: 'cel-modal-overlay',
          style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }
        }, [
          el('div', {
            className: 'cel-modal',
            style: {
              background: '#1a202c',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '90%',
              width: '280px',
              border: '1px solid #2d3748'
            }
          }, [
            el('h3', { style: { marginBottom: '16px', fontSize: '18px' } }, [title]),
            typeof content === 'string' ? el('p', null, [content]) : content,
            el('div', { style: { marginTop: '20px', display: 'flex', gap: '10px' } }, [
              confirmText ? el('button', {
                className: 'cel-button cel-button--primary',
                style: { flex: 1 },
                onclick: () => {
                  document.body.removeChild(modal);
                  resolve(true);
                }
              }, [confirmText]) : null,
              cancelText ? el('button', {
                className: 'cel-button cel-button--outline',
                style: { flex: 1 },
                onclick: () => {
                  document.body.removeChild(modal);
                  reject(new Error('cancelled'));
                }
              }, [cancelText]) : null
            ].filter(Boolean))
          ])
        ]);
        document.body.appendChild(modal);
      });
    },

    showInputModal({ title, placeholder, multiline = false }) {
      return new Promise((resolve, reject) => {
        const inputEl = multiline 
          ? el('textarea', { 
              className: 'cel-input',
              placeholder,
              rows: 4,
              style: { width: '100%', resize: 'vertical', fontFamily: 'monospace' }
            })
          : el('input', { 
              className: 'cel-input',
              type: 'text',
              placeholder,
              style: { width: '100%' }
            });

        const modal = el('div', { 
          className: 'cel-modal-overlay',
          style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }
        }, [
          el('div', {
            className: 'cel-modal',
            style: {
              background: '#1a202c',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '90%',
              width: '280px',
              border: '1px solid #2d3748'
            }
          }, [
            el('h3', { style: { marginBottom: '16px', fontSize: '18px' } }, [title]),
            inputEl,
            el('div', { style: { marginTop: '20px', display: 'flex', gap: '10px' } }, [
              el('button', {
                className: 'cel-button cel-button--primary',
                style: { flex: 1 },
                onclick: () => {
                  const value = inputEl.value.trim();
                  if (value) {
                    document.body.removeChild(modal);
                    resolve(value);
                  }
                }
              }, ['Continue']),
              el('button', {
                className: 'cel-button cel-button--outline',
                style: { flex: 1 },
                onclick: () => {
                  document.body.removeChild(modal);
                  reject(new Error('cancelled'));
                }
              }, ['Cancel'])
            ])
          ])
        ]);
        document.body.appendChild(modal);
        setTimeout(() => inputEl.focus(), 100);
      });
    },

    showPasswordModal({ title, placeholder, confirmPlaceholder }) {
      return new Promise((resolve, reject) => {
        const passInput = el('input', { 
          className: 'cel-input',
          type: 'password',
          placeholder,
          style: { width: '100%', marginBottom: '10px' }
        });

        const confirmInput = el('input', { 
          className: 'cel-input',
          type: 'password',
          placeholder: confirmPlaceholder,
          style: { width: '100%' }
        });

        const errorEl = el('p', { 
          style: { color: '#e53e3e', fontSize: '12px', marginTop: '8px', display: 'none' } 
        });

        const modal = el('div', { 
          className: 'cel-modal-overlay',
          style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }
        }, [
          el('div', {
            className: 'cel-modal',
            style: {
              background: '#1a202c',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '90%',
              width: '280px',
              border: '1px solid #2d3748'
            }
          }, [
            el('h3', { style: { marginBottom: '16px', fontSize: '18px' } }, [title]),
            passInput,
            confirmInput,
            errorEl,
            el('div', { style: { marginTop: '20px', display: 'flex', gap: '10px' } }, [
              el('button', {
                className: 'cel-button cel-button--primary',
                style: { flex: 1 },
                onclick: () => {
                  const pass = passInput.value;
                  const confirm = confirmInput.value;
                  
                  if (!pass || pass.length < 8) {
                    errorEl.textContent = 'Password must be at least 8 characters';
                    errorEl.style.display = 'block';
                    return;
                  }
                  
                  if (pass !== confirm) {
                    errorEl.textContent = 'Passwords do not match';
                    errorEl.style.display = 'block';
                    return;
                  }
                  
                  document.body.removeChild(modal);
                  resolve(pass);
                }
              }, ['Continue']),
              el('button', {
                className: 'cel-button cel-button--outline',
                style: { flex: 1 },
                onclick: () => {
                  document.body.removeChild(modal);
                  reject(new Error('cancelled'));
                }
              }, ['Cancel'])
            ])
          ])
        ]);
        document.body.appendChild(modal);
        setTimeout(() => passInput.focus(), 100);
      });
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CeloraUI.init());
  } else {
    CeloraUI.init();
  }

  // Export to global scope
  window.CeloraUI = CeloraUI;
})();
