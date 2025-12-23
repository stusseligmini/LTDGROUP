/**
 * Shared types for card issuing across all providers
 */

export type CardBrand = 'VISA' | 'MASTERCARD';
export type CardType = 'virtual' | 'physical';
export type CardStatus = 'active' | 'frozen' | 'cancelled';
export type CardProvider = 'mock' | 'gnosis' | 'highnote' | 'deserve';

export interface CreateCardRequest {
  userId: string;
  walletId: string;
  nickname?: string;
  brand?: CardBrand;
  type?: CardType;
  spendingLimit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  cardholderName: string;
}

export interface Card {
  id: string;
  userId: string;
  walletId: string;
  provider: CardProvider;
  providerId: string; // ID from the provider's system
  
  // Card details
  brand: CardBrand;
  type: CardType;
  lastFourDigits: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  
  // Limits
  spendingLimit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  totalSpent: number;
  monthlySpent: number;
  
  // Status
  status: CardStatus;
  isOnline: boolean;
  isContactless: boolean;
  isATM: boolean;
  
  // Nickname
  nickname?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  lastUsedAt?: Date;
}

export interface CardDetails extends Card {
  // Full sensitive details (only returned when explicitly requested)
  cardNumber: string;
  cvv: string;
  pin?: string;
}

export interface UpdateCardRequest {
  nickname?: string;
  status?: CardStatus;
  isOnline?: boolean;
  isContactless?: boolean;
  isATM?: boolean;
  spendingLimit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface SetPinRequest {
  pin: string;
  confirmPin: string;
}

export interface CardTransaction {
  id: string;
  cardId: string;
  amount: number;
  currency: string;
  merchantName: string;
  merchantCity?: string;
  merchantCountry: string;
  mcc: string;
  status: 'pending' | 'approved' | 'declined' | 'reversed';
  declineReason?: string;
  transactionDate: Date;
  settledDate?: Date;
}

export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
  [key: string]: any;
}

export interface ProviderResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  providerData?: any; // Raw response from provider
}

