import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLID, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLEnumType, GraphQLInputObjectType, GraphQLScalarType, Kind } from 'graphql';
import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';
import {
  createInsertMutation,
  createInsertManyMutation,
  createUpsertMutation,
  createUpdateMutation,
  createDeleteMutation,
  createUpdateManyMutation,
  createDeleteManyMutation,
  createUpsertManyMutation,
} from './firebase-operations';

// Enums
const BlockchainEnum = new GraphQLEnumType({
  name: 'Blockchain',
  values: {
    SOLANA: { value: 'solana' },
    ETHEREUM: { value: 'ethereum' },
    BITCOIN: { value: 'bitcoin' },
    CELO: { value: 'celo' },
    POLYGON: { value: 'polygon' },
    ARBITRUM: { value: 'arbitrum' },
    OPTIMISM: { value: 'optimism' },
  },
});

const TransactionStatusEnum = new GraphQLEnumType({
  name: 'TransactionStatus',
  values: {
    PENDING: { value: 'pending' },
    CONFIRMED: { value: 'confirmed' },
    FAILED: { value: 'failed' },
  },
});

const WalletTypeEnum = new GraphQLEnumType({
  name: 'WalletType',
  values: {
    STANDARD: { value: 'standard' },
    MULTISIG: { value: 'multisig' },
    HARDWARE: { value: 'hardware' },
  },
});

// Types
const UserType: GraphQLObjectType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    email: { type: GraphQLString },
    displayName: { type: GraphQLString },
    username: { type: GraphQLString },
    createdAt: { type: GraphQLDateTime },
    // Standard relation field
    wallets: {
      type: new GraphQLList(WalletType_Type),
      resolve: async (parent, args, context) => {
        return context.prisma.wallet.findMany({
          where: { userId: parent.id },
        });
      },
    },
    // Firebase-style relation field name
    wallets_on_user: {
      type: new GraphQLList(WalletType_Type),
      resolve: async (parent, args, context) => {
        return context.prisma.wallet.findMany({
          where: { userId: parent.id },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'desc' },
          ],
        });
      },
    },
  }),
});

const WalletType_Type: GraphQLObjectType = new GraphQLObjectType({
  name: 'Wallet',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    userId: { type: new GraphQLNonNull(GraphQLID) },
    blockchain: { type: new GraphQLNonNull(BlockchainEnum) },
    address: { type: new GraphQLNonNull(GraphQLString) },
    publicKey: { type: GraphQLString },
    label: { type: GraphQLString },
    isDefault: { type: GraphQLBoolean },
    isHidden: { type: GraphQLBoolean },
    walletType: { type: WalletTypeEnum },
    balanceCache: { type: GraphQLString },
    balanceFiat: { type: GraphQLFloat },
    fiatCurrency: { type: GraphQLString },
    createdAt: { type: GraphQLDateTime },
    updatedAt: { type: GraphQLDateTime },
    // Relation back to user
    user: {
      type: UserType,
      resolve: async (parent, args, context) => {
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    },
    transactions: {
      type: new GraphQLList(TransactionType),
      args: {
        limit: { type: GraphQLInt, defaultValue: 20 },
      },
      resolve: async (parent, args, context) => {
        return context.prisma.transaction.findMany({
          where: { walletId: parent.id },
          take: args.limit,
          orderBy: { timestamp: 'desc' },
        });
      },
    },
  }),
});

const TransactionType = new GraphQLObjectType({
  name: 'Transaction',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    walletId: { type: new GraphQLNonNull(GraphQLID) },
    txHash: { type: new GraphQLNonNull(GraphQLString) },
    blockchain: { type: new GraphQLNonNull(BlockchainEnum) },
    blockNumber: { type: GraphQLString },
    fromAddress: { type: new GraphQLNonNull(GraphQLString) },
    toAddress: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: new GraphQLNonNull(GraphQLString) },
    tokenSymbol: { type: GraphQLString },
    tokenAddress: { type: GraphQLString },
    gasFee: { type: GraphQLString },
    status: { type: new GraphQLNonNull(TransactionStatusEnum) },
    confirmations: { type: GraphQLInt },
    memo: { type: GraphQLString },
    timestamp: { type: GraphQLDateTime },
    createdAt: { type: GraphQLDateTime },
  }),
});

// Input Types
const CreateWalletInput = new GraphQLInputObjectType({
  name: 'CreateWalletInput',
  fields: () => ({
    blockchain: { type: BlockchainEnum }, // Made optional - defaults to SOLANA if not provided
    label: { type: GraphQLString },
    isDefault: { type: GraphQLBoolean },
    address: { type: GraphQLString }, // Optional - can provide if already generated client-side
    publicKey: { type: GraphQLString }, // Optional
  }),
});

const SendTransactionInput = new GraphQLInputObjectType({
  name: 'SendTransactionInput',
  fields: () => ({
    walletId: { type: new GraphQLNonNull(GraphQLID) },
    toAddress: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: new GraphQLNonNull(GraphQLString) },
    blockchain: { type: new GraphQLNonNull(BlockchainEnum) },
    tokenSymbol: { type: GraphQLString },
    memo: { type: GraphQLString },
  }),
});

// Input Types for Firebase-style queries
const UserKeyInput = new GraphQLInputObjectType({
  name: 'UserKeyInput',
  fields: () => ({
    id_expr: { type: GraphQLString },
    id: { type: GraphQLID },
  }),
});

// Generic Key Input for entities
const GenericKeyInput = new GraphQLInputObjectType({
  name: 'GenericKeyInput',
  fields: () => ({
    id_expr: { type: GraphQLString },
    id: { type: GraphQLID },
  }),
});

// Generic Entity Input (for insert/update operations)
// Note: GraphQL doesn't support dynamic fields, so we use specific input types per entity

// Root Query
const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    me: {
      type: UserType,
      resolve: async (parent, args, context) => {
        if (!context.userId) {
          throw new Error('Not authenticated');
        }
        return context.prisma.user.findUnique({
          where: { id: context.userId },
        });
      },
    },
    // Firebase-style user query with key argument
    user: {
      type: UserType,
      args: {
        key: { type: UserKeyInput },
        id: { type: GraphQLID },
      },
      resolve: async (parent, args, context) => {
        try {
          // Check authentication first
          if (!context.userId && !context.authUid) {
            throw new Error('Not authenticated. Please log in first.');
          }
          
          const authenticatedUserId = context.userId || context.authUid;
          
          if (!authenticatedUserId) {
            throw new Error('User ID not found in authentication context');
          }
          
          // Handle Firebase-style key argument - map "auth.uid" to our authenticated user ID
          // This catches Firebase GraphQL queries that use key: {id_expr: "auth.uid"}
          if (args.key?.id_expr) {
            const idExpr = String(args.key.id_expr);
            // If id_expr is "auth.uid" or similar, use authenticated user's ID
            // We don't evaluate CEL expressions - we just map auth.uid to our userId
            if (idExpr.includes('auth.uid') || idExpr === 'auth.uid' || idExpr === '"auth.uid"') {
              return context.prisma.user.findUnique({
                where: { id: authenticatedUserId },
              });
            }
          }
          
          // Handle explicit ID in key object
          if (args.key?.id) {
            const userId = String(args.key.id);
            // Only allow users to query their own data
            if (userId !== authenticatedUserId) {
              throw new Error('Not authorized to access this user');
            }
            return context.prisma.user.findUnique({
              where: { id: userId },
            });
          }
          
          // Handle direct id argument
          if (args.id) {
            const userId = String(args.id);
            if (userId !== authenticatedUserId) {
              throw new Error('Not authorized to access this user');
            }
            return context.prisma.user.findUnique({
              where: { id: userId },
            });
          }
          
          // Default: return authenticated user (when key: {id_expr: "auth.uid"} is used without explicit ID)
          return context.prisma.user.findUnique({
            where: { id: authenticatedUserId },
          });
        } catch (error) {
          // Provide clearer error messages
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Failed to fetch user');
        }
      },
    },
    wallets: {
      type: new GraphQLList(WalletType_Type),
      args: {
        blockchain: { type: BlockchainEnum },
      },
      resolve: async (parent, args, context) => {
        if (!context.userId) {
          throw new Error('Not authenticated');
        }
        const where: any = { userId: context.userId };
        if (args.blockchain) {
          where.blockchain = args.blockchain;
        }
        return context.prisma.wallet.findMany({ where });
      },
    },
    wallet: {
      type: WalletType_Type,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: async (parent, args, context) => {
        if (!context.userId) {
          throw new Error('Not authenticated');
        }
        const wallet = await context.prisma.wallet.findUnique({
          where: { id: args.id },
        });
        if (!wallet || wallet.userId !== context.userId) {
          throw new Error('Wallet not found');
        }
        return wallet;
      },
    },
    transactions: {
      type: new GraphQLList(TransactionType),
      args: {
        walletId: { type: GraphQLID },
        blockchain: { type: BlockchainEnum },
        limit: { type: GraphQLInt, defaultValue: 20 },
        status: { type: TransactionStatusEnum },
      },
      resolve: async (parent, args, context) => {
        if (!context.userId) {
          throw new Error('Not authenticated');
        }
        const where: any = {};
        if (args.walletId) {
          const wallet = await context.prisma.wallet.findUnique({
            where: { id: args.walletId },
          });
          if (!wallet || wallet.userId !== context.userId) {
            throw new Error('Wallet not found');
          }
          where.walletId = args.walletId;
        } else {
          // Get all wallets for user and filter transactions
          const wallets = await context.prisma.wallet.findMany({
            where: { userId: context.userId },
            select: { id: true },
          });
          where.walletId = { in: wallets.map((w: { id: string }) => w.id) };
        }
        if (args.blockchain) {
          where.blockchain = args.blockchain;
        }
        if (args.status) {
          where.status = args.status;
        }
        return context.prisma.transaction.findMany({
          where,
          take: args.limit || 20,
          orderBy: { timestamp: 'desc' },
        });
      },
    },
  }),
});

// Input Type for Firebase-style wallet_insert
const WalletInsertInput = new GraphQLInputObjectType({
  name: 'WalletInsertInput',
  fields: () => ({
    blockchain: { type: BlockchainEnum },
    label: { type: GraphQLString },
    isDefault: { type: GraphQLBoolean },
    isHardware: { type: GraphQLBoolean },
    isHidden: { type: GraphQLBoolean },
    userId_expr: { type: GraphQLString },
    address: { type: GraphQLString },
    publicKey: { type: GraphQLString },
    walletType: { type: WalletTypeEnum },
    balanceCache: { type: GraphQLString },
    balanceFiat: { type: GraphQLFloat },
    fiatCurrency: { type: GraphQLString },
    vaultLevel: { type: GraphQLInt },
    // No mnemonic or hashes are exposed/stored
    pinHash: { type: GraphQLString },
    derivationPath: { type: GraphQLString },
    createdAt: { type: GraphQLDateTime }, // Allow client to provide, but will auto-set if not provided
    updatedAt: { type: GraphQLDateTime }, // Allow client to provide, but will auto-set if not provided
  }),
});

// Input Types for Card entity
const CardInsertInput = new GraphQLInputObjectType({
  name: 'CardInsertInput',
  fields: () => ({
    userId_expr: { type: GraphQLString },
    walletId: { type: GraphQLID },
    encryptedNumber: { type: GraphQLString },
    cardholderName: { type: GraphQLString },
    expiryMonth: { type: GraphQLInt },
    expiryYear: { type: GraphQLInt },
    nickname: { type: GraphQLString },
    brand: { type: GraphQLString },
    type: { type: GraphQLString },
    spendingLimit: { type: GraphQLFloat },
    dailyLimit: { type: GraphQLFloat },
    monthlyLimit: { type: GraphQLFloat },
    status: { type: GraphQLString },
    isOnline: { type: GraphQLBoolean },
    isContactless: { type: GraphQLBoolean },
    isATM: { type: GraphQLBoolean },
    isDisposable: { type: GraphQLBoolean },
    allowedMCC: { type: new GraphQLList(GraphQLString) },
    blockedMCC: { type: new GraphQLList(GraphQLString) },
    allowedCountries: { type: new GraphQLList(GraphQLString) },
    blockedCountries: { type: new GraphQLList(GraphQLString) },
    cashbackRate: { type: GraphQLFloat },
  }),
});

// Input Types for Notification entity
const NotificationInsertInput = new GraphQLInputObjectType({
  name: 'NotificationInsertInput',
  fields: () => ({
    userId_expr: { type: GraphQLString },
    type: { type: GraphQLString },
    title: { type: GraphQLString },
    body: { type: GraphQLString },
    channels: { type: new GraphQLList(GraphQLString) },
    status: { type: GraphQLString },
    priority: { type: GraphQLString },
    actionUrl: { type: GraphQLString },
    actionLabel: { type: GraphQLString },
    metadata: { type: GraphQLJSON },
    sentAt: { type: GraphQLDateTime },
    deliveredAt: { type: GraphQLDateTime },
    readAt: { type: GraphQLDateTime },
    expiresAt: { type: GraphQLDateTime },
  }),
});

// Input Types for Transaction entity
const TransactionInsertInput = new GraphQLInputObjectType({
  name: 'TransactionInsertInput',
  fields: () => ({
    walletId: { type: GraphQLID },
    txHash: { type: GraphQLString },
    blockchain: { type: BlockchainEnum },
    blockNumber: { type: GraphQLString },
    fromAddress: { type: GraphQLString },
    toAddress: { type: GraphQLString },
    amount: { type: GraphQLString },
    tokenSymbol: { type: GraphQLString },
    tokenAddress: { type: GraphQLString },
    gasFee: { type: GraphQLString },
    gasPrice: { type: GraphQLString },
    gasUsed: { type: GraphQLString },
    status: { type: TransactionStatusEnum },
    confirmations: { type: GraphQLInt },
    type: { type: GraphQLString },
    memo: { type: GraphQLString },
    timestamp: { type: GraphQLDateTime },
  }),
});

// Input Types for User entity
const UserInsertInput = new GraphQLInputObjectType({
  name: 'UserInsertInput',
  fields: () => ({
    id: { type: GraphQLID },
    email: { type: GraphQLString },
    emailVerified: { type: GraphQLBoolean },
    displayName: { type: GraphQLString },
    username: { type: GraphQLString },
    phoneNumber: { type: GraphQLString },
    twoFactorEnabled: { type: GraphQLBoolean },
    twoFactorSecret: { type: GraphQLString },
    preferredCardProvider: { type: GraphQLString },
    cardType: { type: GraphQLString },
    telegramId: { type: GraphQLString },
    telegramUsername: { type: GraphQLString },
    telegramLinkedAt: { type: GraphQLDateTime },
    telegramNotificationsEnabled: { type: GraphQLBoolean },
    lastLoginAt: { type: GraphQLDateTime },
  }),
});

// Root Mutation
const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: () => ({
    createWallet: {
      type: WalletType_Type,
      args: {
        input: { type: CreateWalletInput }, // Made optional
      },
      resolve: async (parent, args, context) => {
        if (!context.userId) {
          throw new Error('Not authenticated');
        }
        
        const input = args.input || {};
        
        // Default values
        const blockchain = input.blockchain || 'solana';
        const label = input.label || null;
        const isDefault = input.isDefault || false;
        const address = input.address || null; // Allow client to provide address
        const publicKey = input.publicKey || null;
        
        // Validate blockchain if provided
        if (input.blockchain && !['solana', 'ethereum', 'bitcoin', 'celo', 'polygon', 'arbitrum', 'optimism'].includes(blockchain)) {
          throw new Error(`Invalid blockchain: ${blockchain}`);
        }
        
        // If address is provided, check if wallet already exists
        if (address) {
          const existingWallet = await context.prisma.wallet.findFirst({
            where: {
              userId: context.userId,
              blockchain,
              address,
            },
          });
          
          if (existingWallet) {
            throw new Error('Wallet with this address already exists');
          }
        }
        
        // If this is set as default, unset other defaults
        if (isDefault) {
          await context.prisma.wallet.updateMany({
            where: { userId: context.userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        
        // Create wallet
        return context.prisma.wallet.create({
          data: {
            userId: context.userId,
            blockchain,
            address: address || '', // Use provided address or empty (client generates)
            publicKey,
            label,
            isDefault,
            walletType: 'standard',
            fiatCurrency: 'USD',
            balanceCache: '0',
            balanceFiat: 0,
          },
        });
      },
    },
    // Note: wallet_insert is now generated via createInsertMutation below
    sendTransaction: {
      type: TransactionType,
      args: {
        input: { type: new GraphQLNonNull(SendTransactionInput) },
      },
      resolve: async (parent, args, context) => {
        if (!context.userId) {
          throw new Error('Not authenticated');
        }
        // This is a simplified version - you'll need to integrate with actual transaction sending logic
        throw new Error('Transaction sending not yet implemented in GraphQL - use REST API for now');
      },
    },
    
    // ========================================
    // WALLET Operations
    // ========================================
    wallet_insert: createInsertMutation('Wallet', WalletInsertInput),
    wallet_insertMany: createInsertManyMutation('Wallet', WalletInsertInput),
    wallet_upsert: createUpsertMutation('Wallet', WalletInsertInput),
    wallet_update: createUpdateMutation('Wallet', WalletInsertInput),
    wallet_updateMany: createUpdateManyMutation('Wallet', WalletInsertInput),
    wallet_delete: createDeleteMutation('Wallet'),
    wallet_deleteMany: createDeleteManyMutation('Wallet', WalletInsertInput),
    
    // ========================================
    // CARD Operations
    // ========================================
    card_insert: createInsertMutation('Card', CardInsertInput),
    card_insertMany: createInsertManyMutation('Card', CardInsertInput),
    card_upsert: createUpsertMutation('Card', CardInsertInput),
    card_update: createUpdateMutation('Card', CardInsertInput),
    card_updateMany: createUpdateManyMutation('Card', CardInsertInput),
    card_delete: createDeleteMutation('Card'),
    card_deleteMany: createDeleteManyMutation('Card', CardInsertInput),
    
    // ========================================
    // NOTIFICATION Operations
    // ========================================
    notification_insert: createInsertMutation('Notification', NotificationInsertInput),
    notification_insertMany: createInsertManyMutation('Notification', NotificationInsertInput),
    notification_upsert: createUpsertMutation('Notification', NotificationInsertInput),
    notification_update: createUpdateMutation('Notification', NotificationInsertInput),
    notification_updateMany: createUpdateManyMutation('Notification', NotificationInsertInput),
    notification_delete: createDeleteMutation('Notification'),
    notification_deleteMany: createDeleteManyMutation('Notification', NotificationInsertInput),
    
    // ========================================
    // TRANSACTION Operations
    // ========================================
    transaction_insert: createInsertMutation('Transaction', TransactionInsertInput),
    transaction_insertMany: createInsertManyMutation('Transaction', TransactionInsertInput),
    transaction_upsert: createUpsertMutation('Transaction', TransactionInsertInput),
    transaction_update: createUpdateMutation('Transaction', TransactionInsertInput),
    transaction_updateMany: createUpdateManyMutation('Transaction', TransactionInsertInput),
    transaction_delete: createDeleteMutation('Transaction'),
    transaction_deleteMany: createDeleteManyMutation('Transaction', TransactionInsertInput),
    
    // ========================================
    // USER Operations
    // ========================================
    user_insert: createInsertMutation('User', UserInsertInput),
    user_insertMany: createInsertManyMutation('User', UserInsertInput),
    user_upsert: createUpsertMutation('User', UserInsertInput),
    user_update: createUpdateMutation('User', UserInsertInput),
    user_updateMany: createUpdateManyMutation('User', UserInsertInput),
    user_delete: createDeleteMutation('User'),
    user_deleteMany: createDeleteManyMutation('User', UserInsertInput),
  }),
});

// Create Schema
export const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
});

