/**
 * Mock Card Issuing Provider
 * 
 * Fully-featured simulator for development and testing
 * - No external dependencies
 * - No costs
 * - Full feature parity
 * - Realistic card numbers and behavior
 */

import type { ICardIssuingProvider } from '../interface';
import type {
  CreateCardRequest,
  Card,
  CardDetails,
  UpdateCardRequest,
  SetPinRequest,
  CardTransaction,
  ProviderConfig,
  ProviderResponse,
  CardStatus,
} from '../types';
import { generateCardNumber, generateCVV, getLastFourDigits } from '@/lib/security/encryption';
import { logger } from '@/lib/logger';

// In-memory storage for mock cards
const mockCards = new Map<string, CardDetails>();
const mockTransactions = new Map<string, CardTransaction[]>();
const mockPins = new Map<string, string>();

export class MockCardProvider implements ICardIssuingProvider {
  readonly name = 'mock';
  private initialized = false;
  
  async initialize(config: ProviderConfig): Promise<void> {
    logger.info('MockCardProvider initializing', { environment: config.environment });
    this.initialized = true;
  }
  
  async createCard(request: CreateCardRequest): Promise<ProviderResponse<Card>> {
    try {
      if (!this.initialized) {
        throw new Error('Provider not initialized');
      }
      
      // Generate card details
      const brand = request.brand || 'VISA';
      const cardNumber = generateCardNumber(brand);
      const cvv = generateCVV();
      const now = new Date();
      
      // Create card object
      const cardDetails: CardDetails = {
        id: `mock_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: request.userId,
        walletId: request.walletId,
        provider: 'mock',
        providerId: `mock_${Math.random().toString(36).substr(2, 9)}`,
        
        brand,
        type: request.type || 'virtual',
        lastFourDigits: getLastFourDigits(cardNumber),
        cardholderName: request.cardholderName,
        expiryMonth: (now.getMonth() + 1),
        expiryYear: now.getFullYear() + 3,
        
        spendingLimit: request.spendingLimit,
        dailyLimit: request.dailyLimit,
        monthlyLimit: request.monthlyLimit,
        totalSpent: 0,
        monthlySpent: 0,
        
        status: 'active',
        isOnline: true,
        isContactless: true,
        isATM: true,
        
        nickname: request.nickname,
        
        // Sensitive details
        cardNumber,
        cvv,
        pin: undefined,
        
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
      };
      
      // Store in memory
      mockCards.set(cardDetails.id, cardDetails);
      mockTransactions.set(cardDetails.id, []);
      
      // Return card without sensitive details
      const { cardNumber: _, cvv: __, pin: ___, ...card } = cardDetails;
      
      return {
        success: true,
        data: card as Card,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async getCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    const card = mockCards.get(cardId);
    
    if (!card) {
      return {
        success: false,
        error: 'Card not found',
      };
    }
    
    if (card.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }
    
    // Return without sensitive details
    const { cardNumber, cvv, pin, ...safeCard } = card;
    
    return {
      success: true,
      data: safeCard as Card,
    };
  }
  
  async getCardDetails(cardId: string, userId: string): Promise<ProviderResponse<CardDetails>> {
    const card = mockCards.get(cardId);
    
    if (!card) {
      return {
        success: false,
        error: 'Card not found',
      };
    }
    
    if (card.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }
    
    return {
      success: true,
      data: card,
    };
  }
  
  async updateCard(cardId: string, userId: string, update: UpdateCardRequest): Promise<ProviderResponse<Card>> {
    const card = mockCards.get(cardId);
    
    if (!card) {
      return {
        success: false,
        error: 'Card not found',
      };
    }
    
    if (card.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }
    
    // Apply updates
    if (update.nickname !== undefined) card.nickname = update.nickname;
    if (update.status !== undefined) card.status = update.status;
    if (update.isOnline !== undefined) card.isOnline = update.isOnline;
    if (update.isContactless !== undefined) card.isContactless = update.isContactless;
    if (update.isATM !== undefined) card.isATM = update.isATM;
    if (update.spendingLimit !== undefined) card.spendingLimit = update.spendingLimit;
    if (update.dailyLimit !== undefined) card.dailyLimit = update.dailyLimit;
    if (update.monthlyLimit !== undefined) card.monthlyLimit = update.monthlyLimit;
    card.updatedAt = new Date();
    
    // Return without sensitive details
    const { cardNumber, cvv, pin, ...safeCard } = card;
    
    return {
      success: true,
      data: safeCard as Card,
    };
  }
  
  async activateCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    return this.updateCard(cardId, userId, { status: 'active' });
  }
  
  async freezeCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>> {
    return this.updateCard(cardId, userId, { status: 'frozen' });
  }
  
  async unfreezeCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    return this.updateCard(cardId, userId, { status: 'active' });
  }
  
  async cancelCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>> {
    return this.updateCard(cardId, userId, { status: 'cancelled' });
  }
  
  async setPin(cardId: string, userId: string, request: SetPinRequest): Promise<ProviderResponse<boolean>> {
    const card = mockCards.get(cardId);
    
    if (!card) {
      return {
        success: false,
        error: 'Card not found',
      };
    }
    
    if (card.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }
    
    if (request.pin !== request.confirmPin) {
      return {
        success: false,
        error: 'PIN confirmation does not match',
      };
    }
    
    if (!/^\d{4,6}$/.test(request.pin)) {
      return {
        success: false,
        error: 'PIN must be 4-6 digits',
      };
    }
    
    // Store PIN (in real implementation, this would be encrypted)
    card.pin = request.pin;
    mockPins.set(cardId, request.pin);
    
    return {
      success: true,
      data: true,
    };
  }
  
  async getTransactions(cardId: string, userId: string, limit = 10, offset = 0): Promise<ProviderResponse<CardTransaction[]>> {
    const card = mockCards.get(cardId);
    
    if (!card) {
      return {
        success: false,
        error: 'Card not found',
      };
    }
    
    if (card.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }
    
    const transactions = mockTransactions.get(cardId) || [];
    const paginatedTransactions = transactions.slice(offset, offset + limit);
    
    return {
      success: true,
      data: paginatedTransactions,
    };
  }
  
  async handleAuthorization(authorizationData: any): Promise<{ approved: boolean; reason?: string }> {
    // Mock authorization always approves
    return {
      approved: true,
    };
  }
  
  async handleSettlement(settlementData: any): Promise<void> {
    // Mock settlement processing
    logger.info('MockCardProvider settlement processed', { settlementData });
  }
  
  verifyWebhook(payload: string, signature: string): boolean {
    // Mock webhook verification always succeeds
    return true;
  }
  
  /**
   * Utility method for testing: Create a mock transaction
   */
  async createMockTransaction(cardId: string, transaction: Partial<CardTransaction>): Promise<void> {
    const card = mockCards.get(cardId);
    if (!card) {
      throw new Error('Card not found');
    }
    
    const transactions = mockTransactions.get(cardId) || [];
    
    const mockTransaction: CardTransaction = {
      id: `mock_tx_${Date.now()}`,
      cardId,
      amount: transaction.amount || 10.00,
      currency: transaction.currency || 'USD',
      merchantName: transaction.merchantName || 'Mock Merchant',
      merchantCity: transaction.merchantCity,
      merchantCountry: transaction.merchantCountry || 'US',
      mcc: transaction.mcc || '5411', // Grocery stores
      status: transaction.status || 'approved',
      declineReason: transaction.declineReason,
      transactionDate: transaction.transactionDate || new Date(),
      settledDate: transaction.settledDate,
    };
    
    transactions.push(mockTransaction);
    mockTransactions.set(cardId, transactions);
    
    // Update card spending
    if (mockTransaction.status === 'approved') {
      card.totalSpent += mockTransaction.amount;
      card.monthlySpent += mockTransaction.amount;
      card.lastUsedAt = mockTransaction.transactionDate;
    }
  }
  
  /**
   * Utility method for testing: Clear all mock data
   */
  clearAllMockData(): void {
    mockCards.clear();
    mockTransactions.clear();
    mockPins.clear();
  }
}

