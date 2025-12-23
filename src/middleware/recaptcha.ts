/**
 * reCAPTCHA Enterprise Middleware
 * Validates reCAPTCHA tokens for sensitive operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/recaptcha/assessmentClient';
import { logger } from '@/lib/logger';

export interface RecaptchaValidationOptions {
  action: string;
  minScore?: number; // 0.0 to 1.0, default 0.5
  required?: boolean; // If false, missing token is allowed (for backward compatibility)
}

/**
 * Validate reCAPTCHA token from request body
 */
export async function validateRecaptcha(
  request: NextRequest,
  options: RecaptchaValidationOptions
): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    const body = await request.json();
    const { recaptchaToken } = body;

    // If token not provided
    if (!recaptchaToken) {
      if (options.required === false) {
        logger.warn('reCAPTCHA token missing but not required', { action: options.action });
        return { success: true };
      }
      
      return {
        success: false,
        error: 'reCAPTCHA token is required',
      };
    }

    // Verify token
    const minScore = options.minScore ?? 0.5;
    const result = await verifyToken(recaptchaToken, options.action, {
      minScore,
    });

    if (!result.verified) {
      logger.warn('reCAPTCHA verification failed', {
        action: options.action,
        score: result.score,
        reasons: result.reasons,
      });
      
      return {
        success: false,
        score: result.score,
        error: `reCAPTCHA verification failed (score: ${result.score})`,
      };
    }

    logger.info('reCAPTCHA validation successful', {
      action: options.action,
      score: result.score,
    });

    return {
      success: true,
      score: result.score,
    };
  } catch (error) {
    logger.error('reCAPTCHA validation error', error);
    
    return {
      success: false,
      error: 'Failed to validate reCAPTCHA',
    };
  }
}

/**
 * Create a middleware function that validates reCAPTCHA before proceeding
 */
export function withRecaptcha(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RecaptchaValidationOptions
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Validate reCAPTCHA
    const validation = await validateRecaptcha(req, options);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error || 'reCAPTCHA validation failed',
          success: false,
        },
        { status: 403 }
      );
    }

    // Proceed to handler
    return handler(req);
  };
}

/**
 * Helper to create reCAPTCHA-protected API response
 */
export function recaptchaError(message: string, score?: number): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
      recaptcha: {
        required: true,
        score,
      },
    },
    { status: 403 }
  );
}
