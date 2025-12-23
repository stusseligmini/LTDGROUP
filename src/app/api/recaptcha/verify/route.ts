/**
 * API Route: POST /api/recaptcha/verify
 * 
 * Verifies a reCAPTCHA token and returns assessment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAssessment } from '@/lib/recaptcha/assessmentClient';
import { recaptchaConfig } from '@/config/recaptcha';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/recaptcha/verify', method: 'POST'});
  const {requestId} = log;
  
  try {
    const body = await request.json();
    const { token, action, expectedAction } = body;

    if (!token || !action) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Missing token or action',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Get user info for enhanced detection
    const userAgent = request.headers.get('user-agent') || undefined;
    const userIpAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Create assessment
    const assessment = await createAssessment({
      token,
      action,
      expectedAction: expectedAction || action,
      userAgent,
      userIpAddress,
    });

    // Return assessment details
    return NextResponse.json(
      createSuccessEnvelope({
        success: assessment.success,
        score: assessment.score,
        action: assessment.action,
        reasons: assessment.reasons,
        // Include assessment name for future annotation
        assessmentName: assessment.tokenProperties?.hostname 
          ? `projects/${recaptchaConfig.projectId}/assessments/${Date.now()}`
          : undefined,
      }, requestId),
      { status: 200 }
    );
  } catch (error) {
    logger.error('reCAPTCHA verification error', { error, requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Verification failed',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

