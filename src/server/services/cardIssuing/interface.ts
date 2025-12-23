/**
 * Common interface that all card issuing providers must implement
 */

import type {
  CreateCardRequest,
  Card,
  CardDetails,
  UpdateCardRequest,
  SetPinRequest,
  CardTransaction,
  ProviderConfig,
  ProviderResponse,
} from './types';

export interface ICardIssuingProvider {
  /**
   * Provider name
   */
  readonly name: string;
  
  /**
   * Initialize provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>;
  
  /**
   * Create a new card
   */
  createCard(request: CreateCardRequest): Promise<ProviderResponse<Card>>;
  
  /**
   * Get card by ID (masked details)
   */
  getCard(cardId: string, userId: string): Promise<ProviderResponse<Card>>;
  
  /**
   * Get full card details (sensitive information)
   */
  getCardDetails(cardId: string, userId: string): Promise<ProviderResponse<CardDetails>>;
  
  /**
   * Update card settings
   */
  updateCard(cardId: string, userId: string, update: UpdateCardRequest): Promise<ProviderResponse<Card>>;
  
  /**
   * Activate a card
   */
  activateCard(cardId: string, userId: string): Promise<ProviderResponse<Card>>;
  
  /**
   * Freeze a card temporarily
   */
  freezeCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>>;
  
  /**
   * Unfreeze a card
   */
  unfreezeCard(cardId: string, userId: string): Promise<ProviderResponse<Card>>;
  
  /**
   * Cancel a card permanently
   */
  cancelCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>>;
  
  /**
   * Set/update card PIN
   */
  setPin(cardId: string, userId: string, request: SetPinRequest): Promise<ProviderResponse<boolean>>;
  
  /**
   * Get card transactions
   */
  getTransactions(cardId: string, userId: string, limit?: number, offset?: number): Promise<ProviderResponse<CardTransaction[]>>;
  
  /**
   * Handle authorization request (for webhooks)
   */
  handleAuthorization?(authorizationData: any): Promise<{ approved: boolean; reason?: string }>;
  
  /**
   * Handle transaction settlement (for webhooks)
   */
  handleSettlement?(settlementData: any): Promise<void>;
  
  /**
   * Verify webhook signature
   */
  verifyWebhook?(payload: string, signature: string): boolean;

  /**
   * Provision wallet token (Apple/Google Pay)
   */
  provisionWalletToken?(
    cardId: string,
    userId: string,
    walletType: 'apple' | 'google',
    payload: Record<string, any>
  ): Promise<{ token?: string; activationData?: string; tokenReferenceId?: string }>;
}

