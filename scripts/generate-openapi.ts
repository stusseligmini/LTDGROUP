/**
 * OpenAPI Specification Generator
 * 
 * Generates OpenAPI 3.0 spec from Zod schemas.
 * Run: npm run generate:openapi
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import * as schemas from '../src/lib/validation/schemas';
import { z } from 'zod';

/**
 * Convert Zod schema to OpenAPI schema
 */
function zodToOpenApi(schema: z.ZodTypeAny): any {
  if (schema instanceof z.ZodString) {
    const result: any = { type: 'string' };
    if (schema._def.checks) {
      for (const check of schema._def.checks) {
        if (check.kind === 'min') result.minLength = check.value;
        if (check.kind === 'max') result.maxLength = check.value;
        if (check.kind === 'email') result.format = 'email';
        if (check.kind === 'uuid') result.format = 'uuid';
        if (check.kind === 'datetime') result.format = 'date-time';
        if (check.kind === 'regex') result.pattern = check.regex.source;
      }
    }
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: any = { type: 'number' };
    if (schema._def.checks) {
      for (const check of schema._def.checks) {
        if (check.kind === 'min') result.minimum = check.value;
        if (check.kind === 'max') result.maximum = check.value;
        if (check.kind === 'int') result.type = 'integer';
      }
    }
    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema._def.values };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToOpenApi(schema._def.type),
    };
  }

  if (schema instanceof z.ZodObject) {
    const properties: any = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(schema._def.shape())) {
      const fieldSchema = value as z.ZodTypeAny;
      properties[key] = zodToOpenApi(fieldSchema);
      
      // Check if field is optional
      if (!(fieldSchema instanceof z.ZodOptional) && !(fieldSchema instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    const result: any = { type: 'object', properties };
    if (required.length > 0) {
      result.required = required;
    }
    return result;
  }

  if (schema instanceof z.ZodOptional) {
    return zodToOpenApi(schema._def.innerType);
  }

  if (schema instanceof z.ZodDefault) {
    return zodToOpenApi(schema._def.innerType);
  }

  if (schema instanceof z.ZodNullable) {
    const inner = zodToOpenApi(schema._def.innerType);
    return { ...inner, nullable: true };
  }

  // Fallback
  return { type: 'object' };
}

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Celora API',
    description: 'Production-ready PWA + MV3 Extension API with secure auth, wallet management, and notifications',
    version: '1.0.0',
    contact: {
      name: 'Celora Team',
      email: 'support@celora.io',
    },
  },
  servers: [
    {
      url: 'https://celora.io/api',
      description: 'Production',
    },
    {
      url: 'https://staging.celora.io/api',
      description: 'Staging',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication and session management' },
    { name: 'Wallet', description: 'Multi-chain wallet operations' },
    { name: 'Transactions', description: 'Transaction history and management' },
    { name: 'Notifications', description: 'Push and in-app notifications' },
    { name: 'Cards', description: 'Virtual card management' },
    { name: 'Swap', description: 'Token swap operations' },
    { name: 'Staking', description: 'Staking operations' },
    { name: 'Budget', description: 'Budget and spending limits' },
    { name: 'Diagnostics', description: 'Health checks and system status' },
  ],
  paths: {
    '/auth/session': {
      post: {
        tags: ['Auth'],
        summary: 'Create session',
        description: 'Creates a new session using Firebase ID token exchange',
        operationId: 'createSession',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SessionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Session created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
              },
            },
          },
        },
      },
    },
    '/wallet/list': {
      get: {
        tags: ['Wallet'],
        summary: 'List wallets',
        description: 'Returns paginated list of wallets',
        operationId: 'listWallets',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'blockchain', in: 'query', schema: { type: 'string', enum: ['celo', 'ethereum', 'bitcoin', 'solana'] } },
        ],
        responses: {
          '200': {
            description: 'Wallets retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WalletListResponse' },
              },
            },
          },
        },
      },
    },
    '/wallet/summary': {
      get: {
        tags: ['Wallet'],
        summary: 'Get wallet summary',
        description: 'Returns total balance and recent transactions across all wallets',
        operationId: 'getWalletSummary',
        responses: {
          '200': {
            description: 'Wallet summary retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WalletSummaryResponse' },
              },
            },
          },
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List notifications',
        description: 'Returns paginated list of notifications with optional filters',
        operationId: 'listNotifications',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'sent', 'delivered', 'failed', 'read'] } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['transaction', 'security', 'system', 'promotion'] } },
        ],
        responses: {
          '200': {
            description: 'Notifications retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notifications: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/NotificationResponse' },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Notifications'],
        summary: 'Mark notifications as read',
        description: 'Marks multiple notifications as read',
        operationId: 'markNotificationsAsRead',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NotificationMarkAsReadRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Notifications updated successfully',
          },
        },
      },
    },
    '/cards': {
      get: {
        tags: ['Cards'],
        summary: 'List cards',
        description: 'Returns paginated list of virtual cards',
        operationId: 'listCards',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'walletId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'frozen', 'cancelled'] } },
        ],
        responses: {
          '200': {
            description: 'Cards retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cards: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CardResponse' },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cards'],
        summary: 'Create card',
        description: 'Creates a new virtual card',
        operationId: 'createCard',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CardCreateRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Card created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CardDetailsResponse' },
              },
            },
          },
        },
      },
    },
    '/swap/quote': {
      post: {
        tags: ['Swap'],
        summary: 'Get swap quote',
        description: 'Returns a quote for token swap',
        operationId: 'getSwapQuote',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SwapQuoteRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Quote retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SwapQuoteResponse' },
              },
            },
          },
        },
      },
    },
    '/swap': {
      post: {
        tags: ['Swap'],
        summary: 'Execute swap',
        description: 'Executes a token swap',
        operationId: 'executeSwap',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SwapExecuteRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Swap executed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SwapExecuteResponse' },
              },
            },
          },
        },
      },
    },
    '/staking': {
      get: {
        tags: ['Staking'],
        summary: 'Get staking positions',
        description: 'Returns all staking positions for user',
        operationId: 'getStakingPositions',
        responses: {
          '200': {
            description: 'Staking positions retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StakingPositionsResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Staking'],
        summary: 'Stake tokens',
        description: 'Stakes tokens on supported blockchains',
        operationId: 'stakeTokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StakeRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Staking successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StakeResponse' },
              },
            },
          },
        },
      },
    },
    '/budget': {
      get: {
        tags: ['Budget'],
        summary: 'Get budget summary',
        description: 'Returns spending summary and limits',
        operationId: 'getBudgetSummary',
        responses: {
          '200': {
            description: 'Budget summary retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BudgetSummaryResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Budget'],
        summary: 'Create spending limit',
        description: 'Creates a new spending limit',
        operationId: 'createSpendingLimit',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSpendingLimitRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Spending limit created successfully',
          },
        },
      },
    },
    '/diagnostics/health': {
      get: {
        tags: ['Diagnostics'],
        summary: 'Health check',
        description: 'Returns system health status',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheckResponse' },
              },
            },
          },
          '503': {
            description: 'System is unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheckResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID token (bearer)',
      },
    },
    schemas: {
      // Auth
      SessionRequest: zodToOpenApi(schemas.SessionRequestSchema),
      SessionResponse: zodToOpenApi(schemas.SessionResponseSchema),
      
      // Wallet
      WalletListResponse: zodToOpenApi(schemas.WalletListResponseSchema),
      WalletSummaryResponse: zodToOpenApi(schemas.WalletSummaryResponseSchema),
      WalletCreateRequest: zodToOpenApi(schemas.WalletCreateRequestSchema),
      WalletCreateResponse: zodToOpenApi(schemas.WalletCreateResponseSchema),
      
      // Cards
      CardCreateRequest: zodToOpenApi(schemas.CardCreateRequestSchema),
      CardUpdateRequest: zodToOpenApi(schemas.CardUpdateRequestSchema),
      CardResponse: zodToOpenApi(schemas.CardResponseSchema),
      CardDetailsResponse: zodToOpenApi(schemas.CardDetailsResponseSchema),
      
      // Swap
      SwapQuoteRequest: zodToOpenApi(schemas.SwapQuoteRequestSchema),
      SwapQuoteResponse: zodToOpenApi(schemas.SwapQuoteResponseSchema),
      SwapExecuteRequest: zodToOpenApi(schemas.SwapExecuteRequestSchema),
      SwapExecuteResponse: zodToOpenApi(schemas.SwapExecuteResponseSchema),
      
      // Staking
      StakingPositionsResponse: zodToOpenApi(schemas.StakingPositionsResponseSchema),
      StakeRequest: zodToOpenApi(schemas.StakeRequestSchema),
      StakeResponse: zodToOpenApi(schemas.StakeResponseSchema),
      
      // Budget
      BudgetSummaryResponse: zodToOpenApi(schemas.BudgetSummaryResponseSchema),
      CreateSpendingLimitRequest: zodToOpenApi(schemas.CreateSpendingLimitRequestSchema),
      
      // Notifications
      NotificationResponse: zodToOpenApi(schemas.NotificationResponseSchema),
      NotificationMarkAsReadRequest: zodToOpenApi(schemas.NotificationMarkAsReadRequestSchema),
      
      // Diagnostics
      HealthCheckResponse: zodToOpenApi(schemas.HealthCheckResponseSchema),
      EnvDiagnosticsResponse: zodToOpenApi(schemas.EnvDiagnosticsResponseSchema),
      
      // Errors
      Error: zodToOpenApi(schemas.ErrorResponseSchema),
      ValidationError: zodToOpenApi(schemas.ValidationErrorResponseSchema),
    },
  },
};

// Write to file
const outputPath = join(process.cwd(), 'docs', 'openapi.json');
writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf8');
console.log(`✅ OpenAPI spec generated: ${outputPath}`);
