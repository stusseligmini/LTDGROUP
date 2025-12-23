import { z } from 'zod';
import { ErrorCode } from './codes';

/**
 * Standard error response envelope
 */
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string() as z.ZodType<ErrorCode>,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string(),
    timestamp: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/**
 * Standard success response envelope
 */
export const SuccessEnvelopeSchema = z.object({
  data: z.unknown(),
  requestId: z.string(),
  timestamp: z.string(),
});

export type SuccessEnvelope = z.infer<typeof SuccessEnvelopeSchema>;

/**
 * Create a standard error envelope
 */
export function createErrorEnvelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      details: details || undefined,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a standard success envelope
 */
export function createSuccessEnvelope(
  data: unknown,
  requestId: string
): SuccessEnvelope {
  return {
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
