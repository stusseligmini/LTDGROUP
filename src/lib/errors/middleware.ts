import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorCodes, getStatusForErrorCode } from './codes';
import { createErrorEnvelope, createSuccessEnvelope } from './envelope';
import { logger } from '../logger';

export class ValidationError extends Error {
  constructor(
    public code: string = ErrorCodes.VALIDATION_ERROR,
    message: string = 'Validation failed',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Middleware wrapper for request validation and error handling
 * Usage: export const POST = withValidation(MySchema, handlePostRequest);
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T, request: NextRequest, requestId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();

    try {
      // Parse request body
      let body: unknown;
      try {
        body = await request.json();
      } catch (err) {
        return NextResponse.json(
          createErrorEnvelope(
            ErrorCodes.INVALID_REQUEST,
            'Request body must be valid JSON',
            requestId
          ),
          { status: 400 }
        );
      }

      // Validate against schema
      const validation = schema.safeParse(body);
      if (!validation.success) {
        const details: Record<string, unknown> = {};
        validation.error.errors.forEach((err) => {
          const path = err.path.join('.');
          details[path] = err.message;
        });

        logger.warn('Validation error', { requestId, endpoint: request.nextUrl.pathname, details });

        return NextResponse.json(
          createErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            'Request validation failed',
            requestId,
            details
          ),
          { status: 400 }
        );
      }

      // Call handler
      return await handler(validation.data, request, requestId);
    } catch (error) {
      logger.error('Unhandled error in withValidation', error, { requestId });

      const statusCode = error instanceof ValidationError ? 400 : 500;
      const code = error instanceof ValidationError ? error.code : ErrorCodes.INTERNAL_SERVER_ERROR;
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';

      return NextResponse.json(
        createErrorEnvelope(code as any, message, requestId),
        { status: statusCode }
      );
    }
  };
}

/**
 * Wrap a handler with standardized error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    const request = args[0] as NextRequest;
    const requestId = crypto.randomUUID();

    try {
      return await handler(...args);
    } catch (error) {
      logger.error('Unhandled error in handler', error, { requestId });

      const statusCode = error instanceof ValidationError ? 400 : 500;
      const code = error instanceof ValidationError ? error.code : ErrorCodes.INTERNAL_SERVER_ERROR;
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';

      return NextResponse.json(
        createErrorEnvelope(code as any, message, requestId),
        { status: statusCode }
      );
    }
  }) as T;
}

/**
 * Create an error response
 */
export function createApiErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode?: number,
  details?: Record<string, unknown>
): NextResponse {
  const status = statusCode || getStatusForErrorCode(code as any) || 500;
  return NextResponse.json(
    createErrorEnvelope(code as any, message, requestId, details),
    { status }
  );
}

/**
 * Create a success response
 */
export function createApiSuccessResponse(
  data: unknown,
  requestId: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    createSuccessEnvelope(data, requestId),
    { status: statusCode }
  );
}
