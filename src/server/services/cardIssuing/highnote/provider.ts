import { createHmac } from 'crypto';
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
} from '../types';
import { logger } from '@/lib/logger';

interface HighnoteConfig extends ProviderConfig {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  programId?: string;
}

type HighnoteCardEnvelope = {
  card?: HighnoteCardPayload;
  data?: HighnoteCardPayload;
  details?: HighnoteCardDetails;
  meta?: Record<string, any>;
};

type HighnoteCardPayload = {
  id: string;
  externalUserId?: string;
  externalWalletId?: string;
  cardholderName?: string;
  nickname?: string;
  brand?: 'VISA' | 'MASTERCARD';
  type?: 'virtual' | 'physical';
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  status?: 'active' | 'frozen' | 'cancelled';
  controls?: { ecommerce?: boolean; contactless?: boolean; atm?: boolean };
  limits?: { spendingLimit?: number; dailyLimit?: number; monthlyLimit?: number };
  stats?: { totalSpent?: number; monthlySpent?: number };
  timestamps?: { createdAt?: string; updatedAt?: string; activatedAt?: string };
  metadata?: Record<string, any>;
};

type HighnoteCardDetails = {
  cardNumber: string;
  cvv: string;
  pin?: string;
};

type HighnoteTransactionPayload = {
  id: string;
  amount: number;
  currency: string;
  merchantName: string;
  merchantCity?: string;
  merchantCountry?: string;
  mcc?: string;
  status: 'pending' | 'approved' | 'declined' | 'reversed';
  declineReason?: string;
  transactionDate: string;
  settledDate?: string;
};

type ProvisioningResponse = {
  tokenReferenceId?: string;
  activationData?: string;
  token?: string;
};

export class HighnoteProvider implements ICardIssuingProvider {
  readonly name = 'highnote';
  private config: HighnoteConfig | null = null;
  private initialized = false;

  async initialize(config: ProviderConfig & Partial<HighnoteConfig>): Promise<void> {
    const { getSecret } = await import('@/lib/config/secrets');
    
    // Fetch secrets from Key Vault or environment
    let apiKey = config.apiKey;
    let apiSecret = config.apiSecret;
    let webhookSecret = config.webhookSecret;
    
    if (!apiKey) {
      try {
        apiKey = await getSecret('highnote-api-key', 'HIGHNOTE_API_KEY');
      } catch {
        apiKey = process.env.HIGHNOTE_API_KEY;
      }
    }
    
    if (!apiSecret) {
      try {
        apiSecret = await getSecret('highnote-api-secret', 'HIGHNOTE_API_SECRET');
      } catch {
        apiSecret = process.env.HIGHNOTE_API_SECRET;
      }
    }
    
    if (!webhookSecret) {
      try {
        webhookSecret = await getSecret('highnote-webhook-secret', 'HIGHNOTE_WEBHOOK_SECRET');
      } catch {
        webhookSecret = process.env.HIGHNOTE_WEBHOOK_SECRET;
      }
    }

    if (!apiKey || !apiSecret) {
      throw new Error('Highnote API credentials missing from Key Vault and environment');
    }

    const { appConfig } = await import('@/lib/config/app');

    this.config = {
      apiBaseUrl: (config as HighnoteConfig).apiBaseUrl || appConfig.cardIssuers.highnote.apiBaseUrl,
      apiKey,
      apiSecret,
      webhookSecret,
      programId: (config as HighnoteConfig).programId || process.env.HIGHNOTE_PROGRAM_ID,
      environment: config.environment,
    };

    await this.healthCheck();
    this.initialized = true;
    logger.info('HighnoteProvider initialized', {
      environment: this.config.environment,
      apiBaseUrl: this.config.apiBaseUrl,
    });
  }

  private ensureInitialized(): asserts this is this & { config: HighnoteConfig } {
    if (!this.initialized || !this.config) {
      throw new Error('HighnoteProvider not initialized');
    }
  }

  private async healthCheck(): Promise<void> {
    if (!this.config?.apiBaseUrl) return;
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/health`, {
        headers: this.buildHeaders(),
      });
      if (!response.ok) {
        logger.warn('Highnote health check failed', { status: response.status });
      }
    } catch (error) {
      logger.warn('Highnote health check error', error instanceof Error ? { message: error.message } : {});
    }
  }

  private buildHeaders(additional: HeadersInit = {}): HeadersInit {
    this.ensureInitialized();
    const config = (this as any).config as HighnoteConfig;
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
      'X-API-SECRET': config.apiSecret,
      ...(additional || {}),
    };
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    this.ensureInitialized();
    const config = (this as any).config as HighnoteConfig;
    const url = `${config.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: (this as any).buildHeaders(options.headers || {}),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const errorMessage = json?.error || json?.message || `Highnote API error (${response.status})`;
      throw new Error(errorMessage);
    }

    return json as T;
  }

  private mapCard(payload: HighnoteCardPayload, fallbackUserId?: string, fallbackWalletId?: string): Card {
    const createdAt = payload.timestamps?.createdAt ? new Date(payload.timestamps.createdAt) : new Date();
    const updatedAt = payload.timestamps?.updatedAt ? new Date(payload.timestamps.updatedAt) : createdAt;
    const activatedAt = payload.timestamps?.activatedAt ? new Date(payload.timestamps.activatedAt) : undefined;

    return {
      id: payload.id,
      userId: payload.externalUserId ?? fallbackUserId ?? '',
      walletId: payload.externalWalletId ?? fallbackWalletId ?? '',
      provider: 'highnote',
      providerId: payload.id,
      brand: payload.brand ?? 'VISA',
      type: payload.type ?? 'virtual',
      lastFourDigits: payload.last4 ?? '0000',
      cardholderName: payload.cardholderName ?? 'CARDHOLDER',
      expiryMonth: payload.expiryMonth ?? new Date().getMonth() + 1,
      expiryYear: payload.expiryYear ?? new Date().getFullYear() + 3,
      spendingLimit: payload.limits?.spendingLimit,
      dailyLimit: payload.limits?.dailyLimit,
      monthlyLimit: payload.limits?.monthlyLimit,
      totalSpent: payload.stats?.totalSpent ?? 0,
      monthlySpent: payload.stats?.monthlySpent ?? 0,
      status: payload.status ?? 'active',
      isOnline: payload.controls?.ecommerce ?? true,
      isContactless: payload.controls?.contactless ?? true,
      isATM: payload.controls?.atm ?? false,
      nickname: payload.nickname,
      createdAt,
      updatedAt,
      activatedAt,
    };
  }

  private mapTransactions(items: HighnoteTransactionPayload[]): CardTransaction[] {
    return items.map(tx => ({
      id: tx.id,
      cardId: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      merchantName: tx.merchantName,
      merchantCity: tx.merchantCity,
      merchantCountry: tx.merchantCountry || 'US',
      mcc: tx.mcc || '0000',
      status: tx.status,
      declineReason: tx.declineReason,
      transactionDate: new Date(tx.transactionDate),
      settledDate: tx.settledDate ? new Date(tx.settledDate) : undefined,
    }));
  }

  async createCard(request: CreateCardRequest): Promise<ProviderResponse<Card>> {
    try {
      const payload = {
        programId: this.config?.programId,
        externalUserId: request.userId,
        externalWalletId: request.walletId,
        nickname: request.nickname,
        brand: request.brand ?? 'VISA',
        type: request.type ?? 'virtual',
        cardholderName: request.cardholderName,
        limits: {
          spendingLimit: request.spendingLimit,
          dailyLimit: request.dailyLimit,
          monthlyLimit: request.monthlyLimit,
        },
      };

      const response = await this.request<HighnoteCardEnvelope>('/cards', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      const card = this.mapCard(cardPayload, request.userId, request.walletId);

      return {
        success: true,
        data: card,
        providerData: {
          providerCardId: cardPayload.id,
          raw: response,
          cardDetails: response.details,
        },
      };
    } catch (error) {
      logger.error('Highnote createCard failed', error instanceof Error ? error : undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create card with Highnote',
      };
    }
  }

  async getCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}`);
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
        providerData: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch card from Highnote',
      };
    }
  }

  async getCardDetails(cardId: string, userId: string): Promise<ProviderResponse<CardDetails>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}/details`);
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      const details: CardDetails = {
        ...this.mapCard(cardPayload, userId),
        cardNumber: response.details?.cardNumber || '',
        cvv: response.details?.cvv || '',
        pin: response.details?.pin,
      };
      return {
        success: true,
        data: details,
        providerData: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch card details from Highnote',
      };
    }
  }

  async updateCard(cardId: string, userId: string, update: UpdateCardRequest): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
        providerData: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update card with Highnote',
      };
    }
  }

  async activateCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}/activate`, {
        method: 'POST',
      });
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate card on Highnote',
      };
    }
  }

  async freezeCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}/freeze`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to freeze card on Highnote',
      };
    }
  }

  async unfreezeCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}/unfreeze`, {
        method: 'POST',
      });
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unfreeze card on Highnote',
      };
    }
  }

  async cancelCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<HighnoteCardEnvelope>(`/cards/${cardId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const cardPayload = response.card || response.data || (response as unknown as HighnoteCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel card on Highnote',
      };
    }
  }

  async setPin(cardId: string, userId: string, request: SetPinRequest): Promise<ProviderResponse<boolean>> {
    try {
      await this.request(`/cards/${cardId}/pin`, {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set PIN on Highnote',
      };
    }
  }

  async getTransactions(cardId: string, userId: string, limit = 10, offset = 0): Promise<ProviderResponse<CardTransaction[]>> {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const response = await this.request<{ data: HighnoteTransactionPayload[] }>(`/cards/${cardId}/transactions?${params.toString()}`);
      return {
        success: true,
        data: this.mapTransactions(response.data || []),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transactions from Highnote',
      };
    }
  }

  async handleAuthorization(authorizationData: any): Promise<{ approved: boolean; reason?: string }> {
    const approved = authorizationData?.state !== 'declined';
    return { approved, reason: approved ? undefined : authorizationData?.reason };
  }

  async handleSettlement(settlementData: any): Promise<void> {
    logger.info('Highnote settlement processed', { settlementId: settlementData?.id });
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.config?.webhookSecret) {
      return false;
    }

    const hmac = createHmac('sha256', this.config.webhookSecret).update(payload).digest('hex');
    return hmac === signature;
  }

  async provisionWalletToken(
    cardId: string,
    userId: string,
    walletType: 'apple' | 'google',
    payload: Record<string, any>
  ): Promise<ProvisioningResponse> {
    try {
      const response = await this.request<{ data: ProvisioningResponse }>(
        `/cards/${cardId}/provisioning/${walletType}`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      return response.data || {};
    } catch (error) {
      logger.error('Highnote provisioning failed', error instanceof Error ? error : undefined, {
        cardId,
        walletType,
      });
      throw error;
    }
  }
}

export default HighnoteProvider;





