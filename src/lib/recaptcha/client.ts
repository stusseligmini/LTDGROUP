import { appFetch } from '@/lib/network/appFetch';
/**
 * Utility functions for client-side reCAPTCHA integration
 */

import { RecaptchaAction } from '@/config/recaptcha';

export interface VerifyRecaptchaOptions {
  action: RecaptchaAction | string;
  token: string;
  expectedAction?: string;
}

export interface RecaptchaVerificationResult {
  success: boolean;
  score: number;
  action: string;
  reasons: string[];
  assessmentName?: string;
}

/**
 * Verify a reCAPTCHA token via API
 * Called after executing reCAPTCHA on client
 */
export async function verifyRecaptchaToken(
  options: VerifyRecaptchaOptions
): Promise<RecaptchaVerificationResult> {
  try {
    const response = await appFetch('/api/recaptcha/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: options.token,
        action: options.action,
        expectedAction: options.expectedAction || options.action,
      }),
    });

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: false,
      score: 0,
      action: options.action,
      reasons: ['API_ERROR'],
    };
  }
}

export interface AnnotateRecaptchaOptions {
  assessmentName: string;
  annotation: 'LEGITIMATE' | 'FRAUDULENT' | 'PASSWORD_CORRECT' | 'PASSWORD_INCORRECT';
  reasons?: string[];
  hashedAccountId?: string;
  transactionEvent?: {
    eventType?: string;
    reason?: string;
    value?: number;
    currency?: string;
  };
}

/**
 * Annotate a previous assessment with outcome
 * Call this after determining if the event was legitimate
 */
export async function annotateRecaptcha(
  options: AnnotateRecaptchaOptions
): Promise<void> {
  try {
    await appFetch('/api/recaptcha/annotate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
  } catch (error) {
    console.error('reCAPTCHA annotation error:', error);
    // Non-critical, don't throw
  }
}

/**
 * Execute reCAPTCHA and verify in one call
 * Convenience function for common pattern
 */
export async function executeAndVerifyRecaptcha(
  executeRecaptcha: (action: string) => Promise<string | null>,
  action: RecaptchaAction | string
): Promise<RecaptchaVerificationResult> {
  const token = await executeRecaptcha(action);
  
  if (!token) {
    return {
      success: false,
      score: 0,
      action,
      reasons: ['TOKEN_GENERATION_FAILED'],
    };
  }

  return verifyRecaptchaToken({ token, action });
}
