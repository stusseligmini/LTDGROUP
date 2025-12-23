import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { SessionRequestSchema } from '@/lib/validation/schemas';
import {
  validateBody,
  ValidationError,
} from '@/lib/validation/validate';
import { logger } from '@/lib/logger';
import { withRecaptcha } from '@/middleware/recaptcha';
import { withRateLimit, RateLimitPresets } from '@/middleware/rateLimit';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const ID_TOKEN_COOKIE = 'firebase-id-token';
const AUTH_TOKEN_COOKIE = 'firebase-auth-token';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = /__session=([^;]+)/.exec(cookieHeader);
  if (!match) return NextResponse.json({ user: null });
  try {
    const decoded = await verifyIdToken(decodeURIComponent(match[1]));
    return NextResponse.json({ user: decoded });
  } catch {
    return NextResponse.json({ user: null });
  }
}

async function handleCreateSession(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/auth/session', method: 'POST'});
  const {requestId} = log;

  try {
    const body = await validateBody(request, SessionRequestSchema);

    const idToken = body.idToken || body.accessToken;
    if (!idToken) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'ID token is required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (_error: any) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.UNAUTHORIZED,
          'Failed to verify Firebase ID token',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const expiresAt = decodedToken.exp
      ? new Date(decodedToken.exp * 1000)
      : new Date(Date.now() + 3600 * 1000);

    const response = NextResponse.json(
      createSuccessEnvelope({
        sessionId: requestId,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: decodedToken.uid,
          email: decodedToken.email || null,
          displayName: decodedToken.name || null,
        },
      }, requestId),
      { status: 201 }
    );

    response.cookies.set(ID_TOKEN_COOKIE, idToken, {
      ...cookieOptions,
      expires: expiresAt,
    });

    response.cookies.set(AUTH_TOKEN_COOKIE, idToken, {
      ...cookieOptions,
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Validation error',
          requestId,
          { fields: error.fields }
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    logger.error('Session POST error', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create session',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

// Export POST with middleware protection
export const POST = withRateLimit(
  withRecaptcha(
    handleCreateSession,
    { action: 'auth_session', minScore: 0.5, required: true }
  ),
  RateLimitPresets.AUTH
);

export async function DELETE() {
  const log = createRequestLogger({endpoint: '/api/auth/session', method: 'DELETE'});
  const {requestId} = log;

  try {
    const response = NextResponse.json(
      createSuccessEnvelope(
        { message: 'Session cleared' },
        requestId
      ),
      { status: 200 }
    );

    response.cookies.set(ID_TOKEN_COOKIE, '', {
      ...cookieOptions,
      maxAge: 0,
    });
    response.cookies.set(AUTH_TOKEN_COOKIE, '', {
      ...cookieOptions,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    logger.error('Session DELETE error', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to clear session',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}
