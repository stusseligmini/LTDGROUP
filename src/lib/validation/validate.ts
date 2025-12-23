/**
 * Validation Utilities for API Routes
 * 
 * Provides type-safe validation helpers that integrate with Next.js App Router.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { ValidationErrorResponseSchema } from './schemas';

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    public fields: Array<{ field: string; message: string }>,
    message = 'Validation failed'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate request body against Zod schema
 */
export async function validateBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new ValidationError(fields);
    }
    throw error;
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    return schema.parse(searchParams);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new ValidationError(fields);
    }
    throw error;
  }
}

/**
 * Validate route parameters against Zod schema
 */
export function validateParams<T extends z.ZodType>(
  params: unknown,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new ValidationError(fields);
    }
    throw error;
  }
}

/**
 * Format validation error response
 */
export function validationErrorResponse(
  error: ValidationError,
  requestId?: string
): NextResponse {
  const response = ValidationErrorResponseSchema.parse({
    error: {
      code: 'VALIDATION_ERROR',
      message: error.message,
      fields: error.fields,
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json(response, {
    status: 400,
    headers: requestId ? { 'X-Request-ID': requestId } : {},
  });
}

/**
 * Format generic error response
 */
export function errorResponse(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
  requestId?: string
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        requestId,
      },
    },
    {
      status,
      headers: requestId ? { 'X-Request-ID': requestId } : {},
    }
  );
}

/**
 * Wrap API handler with error handling and validation
 */
export function withValidation<T extends z.ZodType>(
  handler: (data: z.infer<T>, request: NextRequest) => Promise<NextResponse>,
  schema: T,
  validationType: 'body' | 'query' | 'params' = 'body'
) {
  return async (request: NextRequest, context?: { params?: unknown }) => {
    const requestId = crypto.randomUUID();

    try {
      let validatedData: z.infer<T>;

      switch (validationType) {
        case 'body':
          validatedData = await validateBody(request, schema);
          break;
        case 'query':
          validatedData = validateQuery(request, schema);
          break;
        case 'params':
          validatedData = validateParams(context?.params, schema);
          break;
      }

      return await handler(validatedData, request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return validationErrorResponse(error, requestId);
      }

      console.error('[API Error]', error);
      
      return errorResponse(
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
        500,
        process.env.NODE_ENV === 'development' ? error : undefined,
        requestId
      );
    }
  };
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  status = 200,
  requestId?: string
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: requestId ? { 'X-Request-ID': requestId } : {},
  });
}
