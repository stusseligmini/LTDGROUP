/**
 * Auth Status Endpoint
 * Returns decoded Firebase ID token claims if authorized.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const log = createRequestLogger({ endpoint: '/api/auth/status', method: 'GET' });
  const { requestId } = log;
  const nextReq = (request as any);
  const { user, error } = await requireAuth(nextReq);
  if (error || !user) {
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
      { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
    );
  }
  // Strip potentially large custom claims
  const { uid, email, name, picture, iss, aud, auth_time, iat, exp } = user as any;
  return NextResponse.json(
    createSuccessEnvelope({
      authorized: true,
      user: { uid, email: email || null, name: name || null, picture: picture || null },
      token: { iss, aud, auth_time, iat, exp },
    }, requestId),
    { status: 200 }
  );
}

