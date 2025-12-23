/**
 * reCAPTCHA Enterprise Assessment Client (Server-Side Only)
 * 
 * Creates and verifies reCAPTCHA assessments using Google Cloud API
 */

import { recaptchaConfig } from '@/config/recaptcha';

export interface AssessmentRequest {
  token: string;
  action: string;
  userAgent?: string;
  userIpAddress?: string;
  expectedAction?: string;
}

export interface AssessmentResponse {
  success: boolean;
  score: number;
  reasons: string[];
  action: string;
  tokenProperties?: {
    valid: boolean;
    invalidReason?: string;
    hostname?: string;
    action?: string;
    createTime?: string;
  };
  riskAnalysis?: {
    score: number;
    reasons: string[];
    extendedVerdictReasons?: string[];
  };
  fraudPreventionAssessment?: {
    transactionRisk: number;
    stolenInstrumentVerdict?: {
      risk: number;
    };
    cardTestingVerdict?: {
      risk: number;
    };
  };
  accountDefenderAssessment?: {
    labels: string[];
  };
}

export interface AnnotationRequest {
  assessmentName: string;
  annotation: 'LEGITIMATE' | 'FRAUDULENT' | 'PASSWORD_CORRECT' | 'PASSWORD_INCORRECT';
  reasons?: string[];
  hashedAccountId?: string;
  transactionEvent?: {
    eventType?: 'MERCHANT_APPROVE' | 'MERCHANT_DENY' | 'MANUAL_REVIEW' | 'AUTHORIZATION' | 'AUTHORIZATION_DECLINE' | 'PAYMENT_CAPTURE' | 'PAYMENT_CAPTURE_DECLINE' | 'CANCEL' | 'CHARGEBACK_INQUIRY' | 'CHARGEBACK_ALERT' | 'FRAUD_NOTIFICATION' | 'CHARGEBACK' | 'CHARGEBACK_REPRESENTMENT' | 'CHARGEBACK_REVERSE' | 'REFUND_REQUEST' | 'REFUND_DECLINE' | 'REFUND' | 'REFUND_REVERSE';
    reason?: string;
    value?: number;
    currency?: string;
  };
}

/**
 * Create a reCAPTCHA Enterprise assessment
 * MUST be called server-side only (API routes/functions)
 */
export async function createAssessment(
  request: AssessmentRequest
): Promise<AssessmentResponse> {
  const { projectId, secretKey, apiEndpoint } = recaptchaConfig;

  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured');
  }

  const url = `${apiEndpoint}/projects/${projectId}/assessments?key=${secretKey}`;

  const payload = {
    event: {
      token: request.token,
      expectedAction: request.expectedAction || request.action,
      siteKey: recaptchaConfig.v3.siteKey,
      userAgent: request.userAgent,
      userIpAddress: request.userIpAddress,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('reCAPTCHA API error:', error);
      throw new Error(`reCAPTCHA API failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract risk analysis
    const score = data.riskAnalysis?.score ?? 0;
    const reasons = data.riskAnalysis?.reasons || [];
    const tokenValid = data.tokenProperties?.valid ?? false;
    const actionMatch = data.tokenProperties?.action === request.action;

    return {
      success: tokenValid && actionMatch && score >= recaptchaConfig.v3.scoreThreshold,
      score,
      reasons,
      action: data.tokenProperties?.action || request.action,
      tokenProperties: data.tokenProperties,
      riskAnalysis: data.riskAnalysis,
      fraudPreventionAssessment: data.fraudPreventionAssessment,
      accountDefenderAssessment: data.accountDefenderAssessment,
    };
  } catch (error) {
    console.error('Failed to create assessment:', error);
    throw error;
  }
}

/**
 * Annotate a previous assessment with outcome (for ML improvement)
 * Call this after you know if the event was legitimate or fraudulent
 */
export async function annotateAssessment(
  request: AnnotationRequest
): Promise<void> {
  const { projectId, secretKey, apiEndpoint } = recaptchaConfig;

  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured');
  }

  const url = `${apiEndpoint}/${request.assessmentName}:annotate?key=${secretKey}`;

  const payload = {
    annotation: request.annotation,
    reasons: request.reasons || [],
    hashedAccountId: request.hashedAccountId,
    transactionEvent: request.transactionEvent,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('reCAPTCHA annotation error:', error);
      throw new Error(`Annotation failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to annotate assessment:', error);
    // Don't throw - annotation is non-critical
  }
}

/**
 * Verify a reCAPTCHA token and return score
 * Helper function for common verification pattern
 */
export async function verifyToken(
  token: string,
  action: string,
  options?: {
    userAgent?: string;
    userIpAddress?: string;
    minScore?: number;
  }
): Promise<{ verified: boolean; score: number; reasons: string[] }> {
  const assessment = await createAssessment({
    token,
    action,
    userAgent: options?.userAgent,
    userIpAddress: options?.userIpAddress,
    expectedAction: action,
  });

  const minScore = options?.minScore ?? recaptchaConfig.v3.scoreThreshold;
  const verified = assessment.success && assessment.score >= minScore;

  return {
    verified,
    score: assessment.score,
    reasons: assessment.reasons,
  };
}
