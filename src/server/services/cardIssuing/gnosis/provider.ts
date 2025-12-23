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

interface GnosisPayConfig extends ProviderConfig {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret?: string;
  safeAddress: string;
  rpcUrl?: string;
}

type GnosisPayCardEnvelope = {
  card?: GnosisPayCardPayload;
  data?: GnosisPayCardPayload;
  details?: GnosisPayCardDetails;
  meta?: Record<string, any>;
};

type GnosisPayCardPayload = {
  id: string;
  userId?: string;
  walletId?: string;
  safeAddress?: string;
  cardholderName?: string;
  nickname?: string;
  brand?: 'VISA' | 'MASTERCARD';
  type?: 'virtual' | 'physical';
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  expiry?: { month: number; year: number };
  limits?: { spendingLimit?: number; dailyLimit?: number; monthlyLimit?: number };
  status?: 'active' | 'frozen' | 'cancelled';
  features?: { online?: boolean; contactless?: boolean; atm?: boolean };
  timestamps?: { createdAt?: string; updatedAt?: string; activatedAt?: string };
  stats?: { totalSpent?: number; monthlySpent?: number };
  providerStatus?: string;
  providerMetadata?: Record<string, any>;
};

type GnosisPayCardDetails = {
  cardNumber: string;
  cvv: string;
  pin?: string;
};

type GnosisPayTransactionPayload = {
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
  token?: string;
  activationData?: string;
  tokenReferenceId?: string;
};

export class GnosisPayProvider implements ICardIssuingProvider {
  readonly name = 'gnosis';
  private config: GnosisPayConfig | null = null;
  private initialized = false;

  async initialize(config: ProviderConfig & Partial<GnosisPayConfig>): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Gnosis Pay API key missing');
    }
    if (!config.safeAddress) {
      throw new Error('Gnosis Safe address missing');
    }

    const { appConfig } = await import('@/lib/config/app');

    this.config = {
      apiBaseUrl: (config as GnosisPayConfig).apiBaseUrl || appConfig.cardIssuers.gnosis.apiBaseUrl,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret || process.env.GNOSIS_PAY_API_SECRET,
      environment: config.environment,
      webhookSecret: config.webhookSecret || process.env.GNOSIS_PAY_WEBHOOK_SECRET,
      safeAddress: config.safeAddress,
      rpcUrl: (config as GnosisPayConfig).rpcUrl || process.env.GNOSIS_CHAIN_RPC_URL,
    };

    await this.healthCheck();
    this.initialized = true;
    logger.info('GnosisPayProvider initialized', {
      environment: this.config.environment,
      apiBaseUrl: this.config.apiBaseUrl,
    });
  }

  private ensureInitialized(): asserts this is this & { config: GnosisPayConfig } {
    if (!this.initialized || !this.config) {
      throw new Error('GnosisPayProvider not initialized');
    }
  }

  private async healthCheck(): Promise<void> {
    if (!this.config?.apiBaseUrl) return;
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/health`, {
        method: 'GET',
        headers: { 'X-API-KEY': this.config.apiKey },
      });
      if (!response.ok) {
        logger.warn('Gnosis Pay health check failed', { status: response.status });
      }
    } catch (error) {
      logger.warn('Gnosis Pay health check error', error instanceof Error ? { message: error.message } : {});
    }
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    this.ensureInitialized();
    const config = (this as any).config as GnosisPayConfig;
    const url = `${config.apiBaseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
      ...(config.apiSecret ? { 'X-API-SECRET': config.apiSecret } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const errorMessage = json?.error || json?.message || `Gnosis Pay API error (${response.status})`;
      throw new Error(errorMessage);
    }

    return json as T;
  }

  private mapCard(payload: GnosisPayCardPayload, fallbackUserId?: string, fallbackWalletId?: string): Card {
    const expiryMonth = payload.expiry?.month ?? payload.expiryMonth ?? new Date().getMonth() + 1;
    const expiryYear = payload.expiry?.year ?? payload.expiryYear ?? new Date().getFullYear() + 3;
    const createdAt = payload.timestamps?.createdAt ? new Date(payload.timestamps.createdAt) : new Date();
    const updatedAt = payload.timestamps?.updatedAt ? new Date(payload.timestamps.updatedAt) : createdAt;
    const activatedAt = payload.timestamps?.activatedAt ? new Date(payload.timestamps.activatedAt) : undefined;

    return {
      id: payload.id,
      userId: payload.userId ?? fallbackUserId ?? '',
      walletId: payload.walletId ?? payload.safeAddress ?? fallbackWalletId ?? '',
      provider: 'gnosis',
      providerId: payload.id,
      brand: payload.brand ?? 'VISA',
      type: payload.type ?? 'virtual',
      lastFourDigits: payload.last4 ?? '0000',
      cardholderName: payload.cardholderName ?? 'CARDHOLDER',
      expiryMonth,
      expiryYear,
      spendingLimit: payload.limits?.spendingLimit,
      dailyLimit: payload.limits?.dailyLimit,
      monthlyLimit: payload.limits?.monthlyLimit,
      totalSpent: payload.stats?.totalSpent ?? 0,
      monthlySpent: payload.stats?.monthlySpent ?? 0,
      status: payload.status ?? 'active',
      isOnline: payload.features?.online ?? true,
      isContactless: payload.features?.contactless ?? true,
      isATM: payload.features?.atm ?? true,
      nickname: payload.nickname,
      createdAt,
      updatedAt,
      activatedAt,
    };
  }

  private mapTransactions(items: GnosisPayTransactionPayload[]): CardTransaction[] {
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
        walletId: request.walletId,
        nickname: request.nickname,
        brand: request.brand ?? 'VISA',
        type: request.type ?? 'virtual',
        cardholderName: request.cardholderName,
        spendingLimit: request.spendingLimit,
        dailyLimit: request.dailyLimit,
        monthlyLimit: request.monthlyLimit,
      };

      const response = await this.request<GnosisPayCardEnvelope>('/cards', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
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
      logger.error('Gnosis Pay createCard failed', error instanceof Error ? error : undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create card with Gnosis Pay',
      };
    }
  }

  async getCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}`);
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
        providerData: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch card from Gnosis Pay',
      };
    }
  }

  async getCardDetails(cardId: string, userId: string): Promise<ProviderResponse<CardDetails>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}/details`);
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
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
        error: error instanceof Error ? error.message : 'Failed to fetch card details from Gnosis Pay',
      };
    }
  }

  async updateCard(cardId: string, userId: string, update: UpdateCardRequest): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
        providerData: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update card with Gnosis Pay',
      };
    }
  }

  async activateCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}/activate`, {
        method: 'POST',
      });
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate card on Gnosis Pay',
      };
    }
  }

  async freezeCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}/freeze`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to freeze card on Gnosis Pay',
      };
    }
  }

  async unfreezeCard(cardId: string, userId: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}/unfreeze`, {
        method: 'POST',
      });
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unfreeze card on Gnosis Pay',
      };
    }
  }

  async cancelCard(cardId: string, userId: string, reason?: string): Promise<ProviderResponse<Card>> {
    try {
      const response = await this.request<GnosisPayCardEnvelope>(`/cards/${cardId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const cardPayload = response.card || response.data || (response as unknown as GnosisPayCardPayload);
      return {
        success: true,
        data: this.mapCard(cardPayload, userId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel card on Gnosis Pay',
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
        error: error instanceof Error ? error.message : 'Failed to set PIN on Gnosis Pay',
      };
    }
  }

  async getTransactions(cardId: string, userId: string, limit = 10, offset = 0): Promise<ProviderResponse<CardTransaction[]>> {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const response = await this.request<{ data: GnosisPayTransactionPayload[] }>(`/cards/${cardId}/transactions?${params.toString()}`);
      return {
        success: true,
        data: this.mapTransactions(response.data || []),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transactions from Gnosis Pay',
      };
    }
  }

  async handleAuthorization(authorizationData: any): Promise<{ approved: boolean; reason?: string }> {
    const approved = authorizationData?.spendLimitRemaining !== 0;
    return { approved, reason: approved ? undefined : 'Insufficient funds' };
  }

  async handleSettlement(settlementData: any): Promise<void> {
    logger.info('Gnosis Pay settlement processed', { settlementId: settlementData?.id });
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
      logger.error('Gnosis Pay provisioning failed', error instanceof Error ? error : undefined, {
        cardId,
        walletType,
      });
      throw error;
    }
  }
}

export default GnosisPayProvider;





