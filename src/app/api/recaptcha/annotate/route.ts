/**
 * API Route: POST /api/recaptcha/annotate
 * 
 * Annotates a previous assessment with outcome
 * Call this after determining if an event was legitimate or fraudulent
 */

import { NextRequest, NextResponse } from 'next/server';
import { annotateAssessment } from '@/lib/recaptcha/assessmentClient';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/recaptcha/annotate', method: 'POST'});
  const {requestId} = log;
  
  try {
    const body = await request.json();
    const { 
      assessmentName, 
      annotation, 
      reasons,
      hashedAccountId,
      transactionEvent,
    } = body;

    if (!assessmentName || !annotation) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Missing assessmentName or annotation',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Valid annotation values
    const validAnnotations = [
      'LEGITIMATE',
      'FRAUDULENT', 
      'PASSWORD_CORRECT',
      'PASSWORD_INCORRECT',
    ];

    if (!validAnnotations.includes(annotation)) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid annotation value',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    await annotateAssessment({
      assessmentName,
      annotation,
      reasons,
      hashedAccountId,
      transactionEvent,
    });

    return NextResponse.json(
      createSuccessEnvelope({ success: true }, requestId),
      { status: 200 }
    );
  } catch (error) {
    console.error('reCAPTCHA annotation error:', error);
    const log = createRequestLogger({endpoint: '/api/recaptcha/annotate', method: 'POST'});
    const {requestId} = log;
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Annotation failed',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

