import { Core } from '@walletconnect/core';
import { Web3Wallet } from '@walletconnect/web3wallet';

export interface WalletConnectConfig {
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

export class WalletConnectClient {
  private wallet: InstanceType<typeof Web3Wallet> | null = null;
  private initialized = false;

  constructor(private config: WalletConnectConfig) {}

  /**
   * Initialize WalletConnect client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const core = new Core({
        projectId: this.config.projectId,
      });

      this.wallet = await Web3Wallet.init({
        core,
        metadata: this.config.metadata,
      });

      // Set up event listeners
      this.setupEventListeners();

      this.initialized = true;
      console.log('WalletConnect initialized');
    } catch (error) {
      console.error('Failed to initialize WalletConnect:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for WalletConnect
   */
  private setupEventListeners(): void {
    if (!this.wallet) return;

    // Session proposal event
    this.wallet.on('session_proposal', async (proposal: any) => {
      console.log('Session proposal received:', proposal);
      // This will be handled by the UI
    });

    // Session request event
    this.wallet.on('session_request', async (request: any) => {
      console.log('Session request received:', request);
      // This will be handled by the UI
    });

    // Session delete event
    this.wallet.on('session_delete', (session: any) => {
      console.log('Session deleted:', session);
    });
  }

  /**
   * Pair with a dApp using URI
   */
  async pair(uri: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await this.wallet.core.pairing.pair({ uri });
      console.log('Paired with dApp');
    } catch (error) {
      console.error('Failed to pair:', error);
      throw error;
    }
  }

  /**
   * Approve session proposal
   */
  async approveSession(
    proposal: any,
    accounts: string[]
  ): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      const { id, params } = proposal;
      const { requiredNamespaces } = params;

      // Build namespaces with approved accounts
      const namespaces: Record<string, any> = {};
      
      Object.keys(requiredNamespaces).forEach((key) => {
        const namespace = requiredNamespaces[key];
        namespaces[key] = {
          accounts: accounts.map(account => `${key}:1:${account}`), // Format: namespace:chainId:address
          methods: namespace.methods,
          events: namespace.events,
        };
      });

      await this.wallet.approveSession({
        id,
        namespaces,
      });

      console.log('Session approved');
    } catch (error) {
      console.error('Failed to approve session:', error);
      throw error;
    }
  }

  /**
   * Reject session proposal
   */
  async rejectSession(
    proposal: any,
    reason?: string
  ): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await this.wallet.rejectSession({
        id: proposal.id,
        reason: {
          code: 5000,
          message: reason || 'User rejected',
        },
      });

      console.log('Session rejected');
    } catch (error) {
      console.error('Failed to reject session:', error);
      throw error;
    }
  }

  /**
   * Approve a session request (e.g., transaction signing)
   */
  async approveRequest(
    topic: string,
    id: number,
    result: any
  ): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await this.wallet.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          result,
        },
      });

      console.log('Request approved');
    } catch (error) {
      console.error('Failed to approve request:', error);
      throw error;
    }
  }

  /**
   * Reject a session request
   */
  async rejectRequest(
    topic: string,
    id: number,
    error: string
  ): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await this.wallet.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: {
            code: 5000,
            message: error,
          },
        },
      });

      console.log('Request rejected');
    } catch (error) {
      console.error('Failed to reject request:', error);
      throw error;
    }
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(topic: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await this.wallet.disconnectSession({
        topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });

      console.log('Session disconnected');
    } catch (error) {
      console.error('Failed to disconnect session:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Record<string, any> {
    if (!this.wallet) {
      return {};
    }

    return this.wallet.getActiveSessions();
  }

  /**
   * Get pending session proposals
   */
  getPendingProposals(): Record<string, any> {
    if (!this.wallet) {
      return {};
    }

    return this.wallet.getPendingSessionProposals();
  }

  /**
   * Get pending session requests
   */
  getPendingRequests(): Record<string, any> {
    if (!this.wallet) {
      return {};
    }

    return this.wallet.getPendingSessionRequests();
  }

  /**
   * Subscribe to session proposals
   */
  onSessionProposal(callback: (proposal: any) => void): void {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    this.wallet.on('session_proposal', callback);
  }

  /**
   * Subscribe to session requests
   */
  onSessionRequest(callback: (request: any) => void): void {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    this.wallet.on('session_request', callback);
  }

  /**
   * Subscribe to session deletes
   */
  onSessionDelete(callback: (session: any) => void): void {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized');
    }

    this.wallet.on('session_delete', callback);
  }
}

// Singleton instance
let walletConnectClient: WalletConnectClient | null = null;

export async function getWalletConnectClient(): Promise<WalletConnectClient> {
  if (!walletConnectClient) {
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || process.env.WALLETCONNECT_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('WalletConnect Project ID not configured');
    }

    const { appConfig } = await import('@/lib/config/app');

    walletConnectClient = new WalletConnectClient({
      projectId,
      metadata: {
        name: 'Celora',
        description: 'Multi-platform crypto wallet',
        url: appConfig.app.url,
        icons: [`${appConfig.app.url}/icon.png`],
      },
    });
  }

  return walletConnectClient as WalletConnectClient;
}

