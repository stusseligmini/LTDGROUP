/**
 * Firebase-style GraphQL Operations Generator
 * 
 * Generates all CRUD operations (insert, insertMany, upsert, update, updateMany, delete, deleteMany)
 * for all entities in the schema, matching Firebase GraphQL API patterns.
 */

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLEnumType,
} from 'graphql';
import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';
import { prisma } from '@/server/db/client';

/**
 * Helper to get authenticated user ID from context
 */
function getUserId(context: any): string | null {
  return context.userId || context.authUid || null;
}

/**
 * Cache for key output types to prevent duplicate type definitions
 */
const keyOutputCache = new Map<string, GraphQLObjectType>();

/**
 * Create a key output type for Firebase mutations (cached)
 */
function createKeyOutput(entityName: string): GraphQLObjectType {
  const cached = keyOutputCache.get(entityName);
  if (cached) {
    return cached;
  }
  
  const keyOutput = new GraphQLObjectType({
    name: `${entityName}_KeyOutput`,
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
    },
  });
  
  keyOutputCache.set(entityName, keyOutput);
  return keyOutput;
}

/**
 * Cached key input type
 */
let cachedKeyInput: GraphQLInputObjectType | null = null;

/**
 * Create a generic key input type (cached)
 */
function createKeyInput(): GraphQLInputObjectType {
  if (cachedKeyInput) {
    return cachedKeyInput;
  }
  
  cachedKeyInput = new GraphQLInputObjectType({
    name: 'KeyInput',
    fields: {
      id_expr: { type: GraphQLString },
      id: { type: GraphQLID },
    },
  });
  
  return cachedKeyInput;
}

/**
 * Transform data to handle userId_expr and other Firebase expressions
 */
function transformEntityData(data: any, userId: string, entityName?: string): any {
  const transformed = { ...data };
  
  // Handle userId_expr: "auth.uid"
  if (transformed.userId_expr === 'auth.uid' || transformed.userId_expr?.includes('auth.uid')) {
    transformed.userId = userId;
  }
  delete transformed.userId_expr;
  
  // Special handling for Wallet entity - add ALL required default values
  if (entityName?.toLowerCase() === 'wallet') {
    console.log('[DEBUG] TransformEntityData - Processing Wallet, userId:', userId);
    console.log('[DEBUG] TransformEntityData - Input data:', JSON.stringify(transformed, null, 2));
    
    // Always set userId FIRST
    if (!transformed.userId) {
      transformed.userId = userId;
    }
    
    // Required fields with defaults
    if (!transformed.blockchain) {
      transformed.blockchain = 'solana';
    }
    if (!transformed.address) {
      transformed.address = '';
    }
    if (!transformed.fiatCurrency) {
      transformed.fiatCurrency = 'USD';
    }
    if (!transformed.walletType) {
      transformed.walletType = 'standard';
    }
    
    // Boolean fields with defaults
    if (transformed.isDefault === undefined || transformed.isDefault === null) {
      transformed.isDefault = false;
    }
    if (transformed.isHardware === undefined || transformed.isHardware === null) {
      transformed.isHardware = false;
    }
    if (transformed.isHidden === undefined || transformed.isHidden === null) {
      transformed.isHidden = false;
    }
    
    // Numeric fields with defaults - convert strings to numbers
    if (transformed.vaultLevel === undefined || transformed.vaultLevel === null) {
      transformed.vaultLevel = 0;
    } else if (typeof transformed.vaultLevel === 'string') {
      transformed.vaultLevel = parseInt(transformed.vaultLevel, 10) || 0;
    }
    if (!transformed.balanceCache) {
      transformed.balanceCache = '0';
    }
    if (transformed.balanceFiat === undefined || transformed.balanceFiat === null) {
      transformed.balanceFiat = 0;
    }
    
    // Optional string fields - set to null if not provided
    if (transformed.label === undefined) {
      transformed.label = null;
    }
    // No mnemonic hash persisted per policy; remove field normalization
    if (transformed.pinHash === undefined) {
      transformed.pinHash = null;
    }
    if (transformed.publicKey === undefined) {
      transformed.publicKey = null;
    }
    if (transformed.derivationPath === undefined) {
      transformed.derivationPath = null;
    }
    
    // CRITICAL: ALWAYS set createdAt - Prisma requires it explicitly
    // Force set it no matter what
    const now = new Date();
    transformed.createdAt = now;
    transformed.updatedAt = now;
    
    console.log('[DEBUG] TransformEntityData - Final data with createdAt:', JSON.stringify({
      ...transformed,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    }, null, 2));
  }
  
  return transformed;
}

/**
 * Create insert mutation for an entity
 */
export function createInsertMutation(entityName: string, inputType: GraphQLInputObjectType) {
  const keyOutput = createKeyOutput(entityName);
  
  return {
    type: keyOutput,
    args: {
      data: { type: inputType },
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const data = args.data || {};
      const transformedData = transformEntityData(data, userId, entityName);
      
      // Debug logging for Wallet entity
      if (entityName?.toLowerCase() === 'wallet') {
        console.log('[DEBUG] Wallet Insert - Original data:', JSON.stringify(data, null, 2));
        console.log('[DEBUG] Wallet Insert - Transformed data:', JSON.stringify(transformedData, null, 2));
        console.log('[DEBUG] Wallet Insert - createdAt exists?', 'createdAt' in transformedData, transformedData.createdAt);
        console.log('[DEBUG] Wallet Insert - userId:', transformedData.userId);
      }
      
      const modelName = entityName.toLowerCase();
      
      // Final check - ensure createdAt is set for Wallet
      if (entityName?.toLowerCase() === 'wallet' && !transformedData.createdAt) {
        console.log('[DEBUG] Wallet Insert - createdAt was missing, setting now');
        transformedData.createdAt = new Date();
      }
      
      const result = await (prisma as any)[modelName].create({
        data: transformedData,
      });

      return { id: result.id };
    },
  };
}

/**
 * Create insertMany mutation for an entity
 */
export function createInsertManyMutation(entityName: string, inputType: GraphQLInputObjectType) {
  const keyOutput = createKeyOutput(entityName);
  
  return {
    type: new GraphQLList(keyOutput),
    args: {
      data: { type: new GraphQLList(inputType) },
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const dataArray = args.data || [];
      const modelName = entityName.toLowerCase();

      const transformedData = dataArray.map((data: any) => transformEntityData(data, userId, entityName));

      const results = await Promise.all(
        transformedData.map((data: any) => (prisma as any)[modelName].create({ data }))
      );

      return results.map((r: any) => ({ id: r.id }));
    },
  };
}

/**
 * Create upsert mutation for an entity
 */
export function createUpsertMutation(entityName: string, inputType: GraphQLInputObjectType) {
  const keyOutput = createKeyOutput(entityName);
  const keyInput = createKeyInput();
  
  return {
    type: keyOutput,
    args: {
      key: { type: keyInput },
      data: { type: inputType },
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const key = args.key || {};
      const data = args.data || {};
      
      // Handle id_expr in key
      if (key.id_expr === 'auth.uid' || key.id_expr?.includes('auth.uid')) {
        key.id = userId;
      }
      
      const transformedData = transformEntityData(data, userId, entityName);
      
      const modelName = entityName.toLowerCase();
      const where = key.id ? { id: key.id } : { userId, ...key };
      
      // Verify ownership if id provided
      if (key.id) {
        const existing = await (prisma as any)[modelName].findUnique({ where: { id: key.id } });
        if (existing && existing.userId && existing.userId !== userId) {
          throw new Error(`${entityName} not found or not authorized`);
        }
      }
      
      const result = await (prisma as any)[modelName].upsert({
        where,
        update: transformedData,
        create: transformedData,
      });

      return { id: result.id };
    },
  };
}

/**
 * Create update mutation for an entity
 */
export function createUpdateMutation(entityName: string, inputType: GraphQLInputObjectType) {
  const keyOutput = createKeyOutput(entityName);
  const keyInput = createKeyInput();
  
  return {
    type: keyOutput,
    args: {
      key: { type: keyInput },
      data: { type: inputType },
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const key = args.key || {};
      const data = args.data || {};
      
      if (key.id_expr === 'auth.uid' || key.id_expr?.includes('auth.uid')) {
        key.id = userId;
      }
      
      const transformedData = transformEntityData(data, userId, entityName);
      const modelName = entityName.toLowerCase();
      const where = key.id ? { id: key.id } : { userId, ...key };
      
      // Verify ownership
      if (key.id) {
        const existing = await (prisma as any)[modelName].findUnique({ where: { id: key.id } });
        if (!existing || (existing.userId && existing.userId !== userId)) {
          throw new Error(`${entityName} not found or not authorized`);
        }
      }
      
      const result = await (prisma as any)[modelName].update({
        where,
        data: transformedData,
      });

      return { id: result.id };
    },
  };
}

/**
 * Create delete mutation for an entity
 */
export function createDeleteMutation(entityName: string) {
  const keyOutput = createKeyOutput(entityName);
  const keyInput = createKeyInput();
  
  return {
    type: keyOutput,
    args: {
      key: { type: keyInput },
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const key = args.key || {};
      
      if (key.id_expr === 'auth.uid' || key.id_expr?.includes('auth.uid')) {
        key.id = userId;
      }

      const modelName = entityName.toLowerCase();
      const where = key.id ? { id: key.id } : { userId, ...key };
      
      // Verify ownership
      const existing = await (prisma as any)[modelName].findUnique({ 
        where: key.id ? { id: key.id } : where 
      });
      
      if (!existing || (existing.userId && existing.userId !== userId)) {
        throw new Error(`${entityName} not found or not authorized`);
      }
      
      const result = await (prisma as any)[modelName].delete({
        where: key.id ? { id: key.id } : where,
      });

      return { id: result.id };
    },
  };
}

/**
 * Create updateMany mutation for an entity
 */
export function createUpdateManyMutation(entityName: string, inputType: GraphQLInputObjectType) {
  return {
    type: GraphQLInt, // Returns count
    args: {
      where: { type: inputType }, // Filter
      data: { type: inputType }, // Update data
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const where = args.where || {};
      const data = args.data || {};
      
      // Always filter by userId for security
      const finalWhere: any = { userId, ...where };
      delete finalWhere.userId_expr;
      
      const modelName = entityName.toLowerCase();
      const transformedData = transformEntityData(data, userId, entityName);

      const result = await (prisma as any)[modelName].updateMany({
        where: finalWhere,
        data: transformedData,
      });

      return result.count;
    },
  };
}

/**
 * Create deleteMany mutation for an entity
 */
export function createDeleteManyMutation(entityName: string, inputType: GraphQLInputObjectType) {
  return {
    type: GraphQLInt, // Returns count
    args: {
      where: { type: inputType }, // Filter
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const where = args.where || {};
      const finalWhere: any = { userId, ...where };
      delete finalWhere.userId_expr;

      const modelName = entityName.toLowerCase();

      const result = await (prisma as any)[modelName].deleteMany({
        where: finalWhere,
      });

      return result.count;
    },
  };
}

/**
 * Create upsertMany mutation for an entity
 */
export function createUpsertManyMutation(entityName: string, inputType: GraphQLInputObjectType) {
  const keyOutput = createKeyOutput(entityName);
  
  return {
    type: new GraphQLList(keyOutput),
    args: {
      data: { type: new GraphQLList(inputType) },
    },
    resolve: async (parent: any, args: any, context: any) => {
      const userId = getUserId(context);
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const dataArray = args.data || [];
      const modelName = entityName.toLowerCase();

      const results = await Promise.all(
        dataArray.map(async (data: any) => {
          const transformedData = transformEntityData(data, userId, entityName);
          const key = transformedData.id || transformedData;
          
          if (key) {
            return (prisma as any)[modelName].upsert({
              where: { id: key },
              update: transformedData,
              create: transformedData,
            });
          } else {
            return (prisma as any)[modelName].create({ data: transformedData });
          }
        })
      );

      return results.map((r: any) => ({ id: r.id }));
    },
  };
}

