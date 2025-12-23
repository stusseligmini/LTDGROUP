/**
 * Zod Validation Schemas
 * 
 * Centralized validation schemas for all API endpoints.
 * Auto-generates TypeScript types and enables OpenAPI spec generation.
 */

import { z } from 'zod';

// ============================================================================
// Common / Shared Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

export const BlockchainSchema = z.enum(['celo', 'ethereum', 'bitcoin', 'solana']);

export const TimestampRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// ============================================================================
// Auth API Schemas
// ============================================================================

export const SessionRequestSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  idToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
});

export const SessionResponseSchema = z.object({
  success: z.boolean(),
  sessionId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().nullable(),
  }),
});

export const TokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const TokenRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
});

// ============================================================================
// Wallet API Schemas
// ============================================================================

export const WalletCreateRequestSchema = z.object({
  blockchain: BlockchainSchema,
  address: z.string(), // Wallet address (derived client-side)
  publicKey: z.string().optional(), // Public key (derived client-side)
  // No mnemonic or hash persisted per roadmap
  label: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().default(false),
  derivationPath: z.string().optional(),
});

export const WalletCreateResponseSchema = z.object({
  id: z.string().uuid(),
  blockchain: BlockchainSchema,
  address: z.string(),
  publicKey: z.string().nullable(),
  label: z.string().nullable(),
  isDefault: z.boolean(),
  balanceCache: z.string().nullable(),
  balanceFiat: z.number().nullable(),
  fiatCurrency: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const WalletSummaryResponseSchema = z.object({
  totalBalance: z.number(),
  currency: z.string(),
  holdings: z.array(
    z.object({
      id: z.string().uuid(),
      blockchain: BlockchainSchema,
      address: z.string(),
      label: z.string().nullable(),
      balanceCache: z.string().nullable(),
      balanceFiat: z.number().nullable(),
      isDefault: z.boolean(),
      lastSyncedAt: z.string().datetime().nullable(),
    })
  ).default([]),
  lastUpdated: z.string().datetime(),
});

export const WalletUpdateRequestSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
});

export const WalletBalanceQuerySchema = z.object({
  walletId: z.string().uuid(),
  forceSync: z.coerce.boolean().default(false),
});

export const WalletBalanceResponseSchema = z.object({
  walletId: z.string().uuid(),
  blockchain: BlockchainSchema,
  address: z.string(),
  balance: z.string(),
  balanceFiat: z.number().nullable(),
  fiatCurrency: z.string(),
  lastSyncedAt: z.string().datetime(),
});

// ============================================================================
// Transaction API Schemas
// ============================================================================

export const TransactionListQuerySchema = PaginationSchema.extend({
  walletId: z.string().uuid().optional(),
  blockchain: BlockchainSchema.optional(),
  status: z.enum(['pending', 'confirmed', 'failed']).optional(),
  type: z.enum(['send', 'receive', 'swap', 'contract']).optional(),
}).merge(TimestampRangeSchema);

export const TransactionResponseSchema = z.object({
  id: z.string().uuid(),
  walletId: z.string().uuid(),
  txHash: z.string(),
  blockchain: BlockchainSchema,
  blockNumber: z.string().nullable(),
  fromAddress: z.string(),
  toAddress: z.string(),
  amount: z.string(),
  tokenSymbol: z.string().nullable(),
  tokenAddress: z.string().nullable(),
  gasFee: z.string().nullable(),
  gasPrice: z.string().nullable(),
  gasUsed: z.string().nullable(),
  status: z.string(),
  confirmations: z.number().int(),
  type: z.string().nullable(),
  memo: z.string().nullable(),
  timestamp: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const TransactionCreateRequestSchema = z.object({
  walletId: z.string().uuid(),
  toAddress: z.string().min(1).transform((value) => value.trim()),
  amount: z.string().regex(/^\d+$/),
  tokenAddress: z.string().optional(),
  gasPrice: z.string().optional(),
  gasLimit: z.string().optional(),
  memo: z.string().max(500).optional(),
});

// ============================================================================
// Notification API Schemas
// ============================================================================

export const NotificationListQuerySchema = PaginationSchema.extend({
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'read']).optional(),
  type: z.enum(['transaction', 'security', 'system', 'promotion']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

export const NotificationResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  channels: z.array(z.string()),
  status: z.string(),
  priority: z.string(),
  actionUrl: z.string().nullable(),
  actionLabel: z.string().nullable(),
  sentAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const NotificationCreateRequestSchema = z.object({
  type: z.enum(['transaction', 'security', 'system', 'promotion']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  channels: z.array(z.enum(['push', 'email', 'in-app'])).min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  actionUrl: z.string().url().optional(),
  actionLabel: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const NotificationUpdateRequestSchema = z.object({
  status: z.enum(['read', 'archived']).optional(),
});

export const NotificationMarkAsReadRequestSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1),
});

// ============================================================================
// Diagnostics API Schemas
// ============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.object({
    database: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      latency: z.number().nullable(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      latency: z.number().nullable(),
      error: z.string().optional(),
    }),
    appCheck: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      configured: z.boolean(),
    }),
    recaptcha: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      configured: z.boolean(),
    }),
  }),
});

export const EnvDiagnosticsResponseSchema = z.object({
  nodeEnv: z.string(),
  nextVersion: z.string(),
  databaseConfigured: z.boolean(),
  redisConfigured: z.boolean(),
  firebaseConfigured: z.boolean(),
  appCheckConfigured: z.boolean(),
  recaptchaConfigured: z.boolean(),
});

// ============================================================================
// Virtual Card API Schemas
// ============================================================================

export const CardCreateRequestSchema = z.object({
  walletId: z.string().uuid(),
  nickname: z.string().min(1).max(50).optional(),
  brand: z.enum(['VISA', 'MASTERCARD']).default('VISA'),
  type: z.enum(['virtual', 'physical']).default('virtual'),
  spendingLimit: z.number().positive().optional(),
  dailyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  provider: z.enum(['mock', 'gnosis', 'highnote', 'deserve']).optional(),
});

export const CardUpdateRequestSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  status: z.enum(['active', 'frozen', 'cancelled']).optional(),
  isOnline: z.boolean().optional(),
  isContactless: z.boolean().optional(),
  isATM: z.boolean().optional(),
  spendingLimit: z.number().positive().optional(),
  dailyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
});

export const CardResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
  nickname: z.string().nullable(),
  brand: z.enum(['VISA', 'MASTERCARD']),
  type: z.enum(['virtual', 'physical']),
  lastFourDigits: z.string(),
  cardholderName: z.string(),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int(),
  spendingLimit: z.number().nullable(),
  dailyLimit: z.number().nullable(),
  monthlyLimit: z.number().nullable(),
  totalSpent: z.number(),
  monthlySpent: z.number(),
  status: z.enum(['active', 'frozen', 'cancelled']),
  isOnline: z.boolean(),
  isContactless: z.boolean(),
  isATM: z.boolean(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  provider: z.enum(['mock', 'gnosis', 'highnote', 'deserve']),
  providerCardId: z.string().nullable(),
});

export const CardDetailsResponseSchema = CardResponseSchema.extend({
  cardNumber: z.string(),
  cvv: z.string(),
});

export const CardListQuerySchema = PaginationSchema.extend({
  walletId: z.string().uuid().optional(),
  status: z.enum(['active', 'frozen', 'cancelled']).optional(),
});

// ============================================================================
// Hidden Vault API Schemas
// ============================================================================

export const SetVaultPinRequestSchema = z.object({
  walletId: z.string().uuid(),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be 6 digits'),
  confirmPin: z.string(),
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs don't match",
  path: ['confirmPin'],
});

export const UnlockVaultRequestSchema = z.object({
  walletId: z.string().uuid(),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

export const UnlockVaultResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export const VaultStatusResponseSchema = z.object({
  isHidden: z.boolean(),
  vaultLevel: z.number().int().min(0).max(2),
  hasPinSet: z.boolean(),
  isUnlocked: z.boolean(),
});

export const UpdateVaultSettingsRequestSchema = z.object({
  isHidden: z.boolean().optional(),
  vaultLevel: z.number().int().min(0).max(2).optional(),
});

// ============================================================================
// Error Response Schemas
// ============================================================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().uuid().optional(),
  }),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.object({
    code: z.literal('VALIDATION_ERROR'),
    message: z.string(),
    fields: z.array(
      z.object({
        field: z.string(),
        message: z.string(),
      })
    ),
    timestamp: z.string().datetime(),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

// Auth
export type SessionRequest = z.infer<typeof SessionRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type TokenRefreshRequest = z.infer<typeof TokenRefreshRequestSchema>;
export type TokenRefreshResponse = z.infer<typeof TokenRefreshResponseSchema>;

// Wallet
export type WalletCreateRequest = z.infer<typeof WalletCreateRequestSchema>;
export type WalletCreateResponse = z.infer<typeof WalletCreateResponseSchema>;
export type WalletSummaryResponse = z.infer<typeof WalletSummaryResponseSchema>;
export type WalletUpdateRequest = z.infer<typeof WalletUpdateRequestSchema>;
export type WalletBalanceQuery = z.infer<typeof WalletBalanceQuerySchema>;
export type WalletBalanceResponse = z.infer<typeof WalletBalanceResponseSchema>;

// Transaction
export type TransactionListQuery = z.infer<typeof TransactionListQuerySchema>;
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
export type TransactionCreateRequest = z.infer<typeof TransactionCreateRequestSchema>;

// Notification
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
export type NotificationCreateRequest = z.infer<typeof NotificationCreateRequestSchema>;
export type NotificationUpdateRequest = z.infer<typeof NotificationUpdateRequestSchema>;
export type NotificationMarkAsReadRequest = z.infer<typeof NotificationMarkAsReadRequestSchema>;

// Diagnostics
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type EnvDiagnosticsResponse = z.infer<typeof EnvDiagnosticsResponseSchema>;

// Virtual Card
export type CardCreateRequest = z.infer<typeof CardCreateRequestSchema>;
export type CardUpdateRequest = z.infer<typeof CardUpdateRequestSchema>;
export type CardResponse = z.infer<typeof CardResponseSchema>;
export type CardDetailsResponse = z.infer<typeof CardDetailsResponseSchema>;
export type CardListQuery = z.infer<typeof CardListQuerySchema>;

// Hidden Vault
export type SetVaultPinRequest = z.infer<typeof SetVaultPinRequestSchema>;
export type UnlockVaultRequest = z.infer<typeof UnlockVaultRequestSchema>;
export type UnlockVaultResponse = z.infer<typeof UnlockVaultResponseSchema>;
export type VaultStatusResponse = z.infer<typeof VaultStatusResponseSchema>;
export type UpdateVaultSettingsRequest = z.infer<typeof UpdateVaultSettingsRequestSchema>;

// ============================================================================
// Swap API Schemas
// ============================================================================

export const SwapQuoteRequestSchema = z.object({
  blockchain: BlockchainSchema,
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
});

export const SwapExecuteRequestSchema = z.object({
  blockchain: BlockchainSchema,
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  walletId: z.string().uuid(),
  quoteResponse: z.any().optional(), // Jupiter quote response for Solana
  signedTransaction: z.string().min(1), // Signed transaction (hex for EVM, base64 for Solana)
});

export const SwapQuoteResponseSchema = z.object({
  fromToken: z.string(),
  toToken: z.string(),
  fromAmount: z.string(),
  toAmount: z.string(),
  estimatedGas: z.string().optional(),
  priceImpact: z.number().optional(),
  route: z.array(z.any()).optional(),
});

export const SwapExecuteResponseSchema = z.object({
  txHash: z.string(),
  blockchain: BlockchainSchema,
});

// ============================================================================
// Budget API Schemas
// ============================================================================

export const BudgetSummaryResponseSchema = z.object({
  summary: z.object({
    totalSpent: z.number(),
    totalLimit: z.number().nullable(),
    remaining: z.number().nullable(),
    period: z.string(),
  }),
  limits: z.array(
    z.object({
      id: z.string().uuid(),
      limitType: z.enum(['daily', 'weekly', 'monthly', 'category']),
      amount: z.number(),
      currentSpent: z.number(),
      walletId: z.string().uuid().nullable(),
      cardId: z.string().uuid().nullable(),
      category: z.string().nullable(),
    })
  ),
});

export const CreateSpendingLimitRequestSchema = z.object({
  limitType: z.enum(['daily', 'weekly', 'monthly', 'per_transaction']),
  amount: z.number().positive(),
  walletId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  category: z.string().optional(),
});

// ============================================================================
// Staking API Schemas
// ============================================================================

export const StakingPositionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
  blockchain: BlockchainSchema,
  amount: z.string(),
  validatorAddress: z.string().nullable(),
  apr: z.number().nullable(),
  rewards: z.string(),
  status: z.string(),
  protocol: z.string().nullable(),
  stakedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const StakingPositionsResponseSchema = z.object({
  positions: z.array(StakingPositionResponseSchema),
});

export const StakeRequestSchema = z.object({
  blockchain: BlockchainSchema,
  walletId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  validatorAddress: z.string().optional(),
  privateKey: z.string().min(1), // Encrypted private key
});

export const StakeResponseSchema = z.object({
  success: z.boolean(),
  txHash: z.string(),
});

// ============================================================================
// MultiSig API Schemas
// ============================================================================

export const CreateMultiSigWalletRequestSchema = z.object({
  blockchain: BlockchainSchema,
  requiredSignatures: z.number().int().positive(),
  signers: z.array(
    z.object({
      address: z.string().min(1),
      name: z.string().optional(),
      email: z.string().email().optional(),
    })
  ).min(2),
}).refine(
  (data) => data.requiredSignatures <= data.signers.length,
  {
    message: 'Required signatures cannot exceed total signers',
    path: ['requiredSignatures'],
  }
);

export const MultiSigWalletResponseSchema = z.object({
  id: z.string().uuid(),
  blockchain: BlockchainSchema,
  address: z.string(),
  requiredSignatures: z.number().int(),
  totalSigners: z.number().int(),
  signers: z.array(
    z.object({
      id: z.string().uuid(),
      address: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    })
  ),
  createdAt: z.string().datetime(),
});

// ============================================================================
// Payment Request API Schemas
// ============================================================================

export const PaymentRequestListQuerySchema = PaginationSchema.extend({
  status: z.enum(['pending', 'fulfilled', 'cancelled', 'expired']).optional(),
});

export const PaymentRequestResponseSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  amount: z.string(),
  blockchain: BlockchainSchema,
  tokenSymbol: z.string().nullable(),
  memo: z.string().nullable(),
  status: z.string(),
  txHash: z.string().nullable(),
  requestType: z.string().nullable(),
  splitBillId: z.string().uuid().nullable(),
  fulfilledTxHash: z.string().nullable(),
  fulfilledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const CreatePaymentRequestSchema = z.object({
  receiverId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  blockchain: BlockchainSchema,
  memo: z.string().max(500).optional(),
  tokenSymbol: z.string().optional(),
});

export const PaymentRequestsResponseSchema = z.object({
  requests: z.array(PaymentRequestResponseSchema),
});

// ============================================================================
// NFT API Schemas
// ============================================================================

export const NFTListQuerySchema = PaginationSchema.extend({
  walletId: z.string().uuid().optional(),
  blockchain: BlockchainSchema.optional(),
});

export const NFTResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
  blockchain: BlockchainSchema,
  contractAddress: z.string(),
  tokenId: z.string(),
  tokenStandard: z.string().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  animationUrl: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export const NFTsResponseSchema = z.object({
  nfts: z.array(NFTResponseSchema),
});

export const SyncNFTsRequestSchema = z.object({
  walletId: z.string().uuid(),
  blockchain: BlockchainSchema,
  address: z.string().min(1),
});

// ============================================================================
// Telegram API Schemas
// ============================================================================

export const TelegramWebhookUpdateSchema = z.object({
  update_id: z.number(),
  message: z.any().optional(),
  callback_query: z.any().optional(),
  edited_message: z.any().optional(),
  channel_post: z.any().optional(),
});

export const TelegramWebhookResponseSchema = z.object({
  ok: z.boolean(),
});

// ============================================================================
// Wallet List API Schemas
// ============================================================================

export const WalletListQuerySchema = PaginationSchema.extend({
  blockchain: BlockchainSchema.optional(),
  includeHidden: z.coerce.boolean().default(false),
});

export const WalletListResponseSchema = z.object({
  wallets: z.array(
    z.object({
      id: z.string().uuid(),
      blockchain: BlockchainSchema,
      address: z.string(),
      label: z.string().nullable(),
      isDefault: z.boolean(),
      isHidden: z.boolean(),
      balanceCache: z.string().nullable(),
      balanceFiat: z.number().nullable(),
      fiatCurrency: z.string().nullable(),
    })
  ),
});

// ============================================================================
// Card Controls API Schemas
// ============================================================================

export const CardControlsUpdateSchema = z.object({
  allowedMCC: z.array(z.string()).optional(),
  blockedMCC: z.array(z.string()).optional(),
  allowedCountries: z.array(z.string().length(2)).optional(),
  blockedCountries: z.array(z.string().length(2)).optional(),
  cashbackRate: z.number().min(0).max(0.2).optional(),
  isOnline: z.boolean().optional(),
  isContactless: z.boolean().optional(),
  isATM: z.boolean().optional(),
});

export const CardControlsMCCActionSchema = z.object({
  mccCodes: z.array(z.string()).min(1),
  action: z.enum(['block', 'allow']),
});

export const CardControlsResponseSchema = z.object({
  controls: z.object({
    allowedMCC: z.array(z.string()),
    blockedMCC: z.array(z.string()),
    allowedCountries: z.array(z.string()),
    blockedCountries: z.array(z.string()),
    cashbackRate: z.number(),
    isOnline: z.boolean(),
    isContactless: z.boolean(),
    isATM: z.boolean(),
    isDisposable: z.boolean().optional(),
    autoFreezeRules: z.any().optional(),
  }),
});

// ============================================================================
// Type Exports (continued)
// ============================================================================

// Swap
export type SwapQuoteRequest = z.infer<typeof SwapQuoteRequestSchema>;
export type SwapExecuteRequest = z.infer<typeof SwapExecuteRequestSchema>;
export type SwapQuoteResponse = z.infer<typeof SwapQuoteResponseSchema>;
export type SwapExecuteResponse = z.infer<typeof SwapExecuteResponseSchema>;

// Budget
export type BudgetSummaryResponse = z.infer<typeof BudgetSummaryResponseSchema>;
export type CreateSpendingLimitRequest = z.infer<typeof CreateSpendingLimitRequestSchema>;

// Staking
export type StakingPositionResponse = z.infer<typeof StakingPositionResponseSchema>;
export type StakingPositionsResponse = z.infer<typeof StakingPositionsResponseSchema>;
export type StakeRequest = z.infer<typeof StakeRequestSchema>;
export type StakeResponse = z.infer<typeof StakeResponseSchema>;

// MultiSig
export type CreateMultiSigWalletRequest = z.infer<typeof CreateMultiSigWalletRequestSchema>;
export type MultiSigWalletResponse = z.infer<typeof MultiSigWalletResponseSchema>;

// Payment Request
export type PaymentRequestListQuery = z.infer<typeof PaymentRequestListQuerySchema>;
export type PaymentRequestResponse = z.infer<typeof PaymentRequestResponseSchema>;
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type PaymentRequestsResponse = z.infer<typeof PaymentRequestsResponseSchema>;

// NFT
export type NFTListQuery = z.infer<typeof NFTListQuerySchema>;
export type NFTResponse = z.infer<typeof NFTResponseSchema>;
export type NFTsResponse = z.infer<typeof NFTsResponseSchema>;
export type SyncNFTsRequest = z.infer<typeof SyncNFTsRequestSchema>;

// Telegram
export type TelegramWebhookUpdate = z.infer<typeof TelegramWebhookUpdateSchema>;
export type TelegramWebhookResponse = z.infer<typeof TelegramWebhookResponseSchema>;

// Wallet List
export type WalletListQuery = z.infer<typeof WalletListQuerySchema>;
export type WalletListResponse = z.infer<typeof WalletListResponseSchema>;

// Card Controls
export type CardControlsUpdate = z.infer<typeof CardControlsUpdateSchema>;
export type CardControlsMCCAction = z.infer<typeof CardControlsMCCActionSchema>;
export type CardControlsResponse = z.infer<typeof CardControlsResponseSchema>;

// ============================================================================
// Contact Resolution API Schemas
// ============================================================================

export const ResolveContactRequestSchema = z.object({
  type: z.enum(['username', 'phone']),
  value: z.string().min(1),
});

export const ResolvedContactResponseSchema = z.object({
  userId: z.string().uuid(),
  address: z.string().optional(),
  blockchain: BlockchainSchema.optional(),
  displayName: z.string().optional(),
});

// ============================================================================
// Card Insights API Schemas
// ============================================================================

export const CardInsightsQuerySchema = PaginationSchema.extend({
  cardId: z.string().uuid().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
});

export const CardInsightResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  cardId: z.string().uuid().nullable(),
  type: z.string(),
  severity: z.string(),
  title: z.string(),
  description: z.string(),
  recommendation: z.string().nullable(),
  amount: z.number().nullable(),
  category: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  isRead: z.boolean(),
  isDismissed: z.boolean(),
  insightDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const CardInsightsResponseSchema = z.object({
  insights: z.array(CardInsightResponseSchema),
});

export const CreateCardInsightRequestSchema = z.object({
  cardId: z.string().uuid().optional(),
  type: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  recommendation: z.string().optional(),
  amount: z.number().optional(),
  category: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCardInsightRequestSchema = z.object({
  isRead: z.boolean().optional(),
  isDismissed: z.boolean().optional(),
});

// ============================================================================
// Card Authorization API Schemas
// ============================================================================

export const CardAuthorizationRequestSchema = z.object({
  cardId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchantName: z.string().min(1),
  merchantCity: z.string().optional(),
  merchantCountry: z.string().length(2),
  mcc: z.string().min(4).max(4), // Merchant Category Code
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const CardAuthorizationResponseSchema = z.object({
  approved: z.boolean(),
  transactionId: z.string().uuid().optional(),
  declineReason: z.string().optional(),
  message: z.string(),
  cashbackAmount: z.number().optional(),
});

// ============================================================================
// Type Exports (continued)
// ============================================================================

// Contact Resolution
export type ResolveContactRequest = z.infer<typeof ResolveContactRequestSchema>;
export type ResolvedContactResponse = z.infer<typeof ResolvedContactResponseSchema>;

// Card Insights
export type CardInsightsQuery = z.infer<typeof CardInsightsQuerySchema>;
export type CardInsightResponse = z.infer<typeof CardInsightResponseSchema>;
export type CardInsightsResponse = z.infer<typeof CardInsightsResponseSchema>;
export type CreateCardInsightRequest = z.infer<typeof CreateCardInsightRequestSchema>;
export type UpdateCardInsightRequest = z.infer<typeof UpdateCardInsightRequestSchema>;

// Card Authorization
export type CardAuthorizationRequest = z.infer<typeof CardAuthorizationRequestSchema>;
export type CardAuthorizationResponse = z.infer<typeof CardAuthorizationResponseSchema>;

// Errors
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
