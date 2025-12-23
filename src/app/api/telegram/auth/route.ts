/**
 * Telegram Firebase Auth Endpoint
 * Generates custom Firebase tokens for Telegram users
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { validateTelegramWebAppData } from '@/lib/telegram/validateWebApp';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export const runtime = 'nodejs';

// Common headers to ensure Telegram WebApp embedding works
const TELEGRAM_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "frame-ancestors https://*.telegram.org https://web.telegram.org https://*.t.me",
  'X-Frame-Options': 'ALLOWALL'
};

export async function GET() {
  // Simple health probe for Telegram container
  try {
    return NextResponse.json(
      { ok: true, message: 'telegram auth alive' },
      { headers: TELEGRAM_HEADERS }
    );
  } catch (_e) {
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: TELEGRAM_HEADERS }
    );
  }
}

/**
 * POST /api/telegram/auth
 * Generate custom Firebase token for Telegram user
 * NOW WITH SIGNATURE VALIDATION
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/telegram/auth', method: 'POST' });
  const { requestId } = log;
  
  // Ensure admin initialized
  getFirebaseAdmin();
  
  try {
    console.log('[Telegram Auth] Request received', { requestId, method: request.method });
    // Log a shallow header preview
    const previewHeaders: Record<string, string | null> = {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
    };
    console.log('[Telegram Auth] Headers preview', { requestId, headers: previewHeaders });
    // Add permissive frame headers for Telegram embed
    const _baseHeaders: Record<string, string> = {
      'Content-Security-Policy': "frame-ancestors https://*.telegram.org https://web.telegram.org https://*.t.me",
      'X-Frame-Options': 'ALLOWALL'
    };
    
    const body = await request.json();
    console.log('[Telegram Auth] Request body parsed', { requestId, keys: Object.keys(body) });
    
    const { telegramId, initData } = body;
    
    if (!telegramId) {
      console.log('[Telegram Auth] Missing telegramId', { requestId });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'telegramId is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR), headers: TELEGRAM_HEADERS }
      );
    }

    // Require Telegram initData and validate HMAC signature
    if (!initData || typeof initData !== 'string') {
      console.warn('[Telegram Auth] Missing or invalid initData', { requestId, telegramId });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'initData is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR), headers: TELEGRAM_HEADERS }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[Telegram Auth] Missing TELEGRAM_BOT_TOKEN env');
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfiguration', requestId),
        { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR), headers: TELEGRAM_HEADERS }
      );
    }

    // Enforce signature validation; reject when invalid
    try {
      const validation = validateTelegramWebAppData(initData, botToken);
      if (!validation.valid) {
        console.warn('[Telegram Auth] Signature invalid, rejecting', { requestId, telegramId });
        return NextResponse.json(
          createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Invalid Telegram signature', requestId),
          { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED), headers: TELEGRAM_HEADERS }
        );
      }
    } catch (error) {
      console.error('[Telegram Auth] Signature validation error', { requestId, error });
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Signature validation error', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR), headers: TELEGRAM_HEADERS }
      );
    }
    
    console.log('[Telegram Auth] Proceeding with token creation', { requestId, telegramId });
    
    // Create custom UID from Telegram ID
    const uid = `telegram_${telegramId}`;
    
    // Generate custom token
    const auth = getAuth();
    const customToken = await auth.createCustomToken(uid, {
      telegramId: telegramId.toString(),
      provider: 'telegram',
    });
    
    console.log('[Telegram Auth] Token created successfully', { requestId, uid });
    
    return NextResponse.json(
      createSuccessEnvelope({
        token: customToken,
        uid,
        userId: uid,
      }, requestId),
      { headers: TELEGRAM_HEADERS }
    );
    
  } catch (error) {
    console.error('[Telegram Auth] Error:', error);
    console.error('[Telegram Auth] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Telegram Auth] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    logger.error('Error generating custom token', { error, requestId });
    
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : 'Failed to generate token',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR), headers: TELEGRAM_HEADERS }
    );
  }
}

