/**
 * Admin-only test endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/auth/roles';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/auth/admin', method: 'GET'});
  const {requestId} = log;
  
  const nextReq = (request as any);
  const { user, error } = await requireAuth(nextReq);
  if (error || !user) {
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.UNAUTHORIZED,
        'Authentication required',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
    );
  }
  try {
    requireRole(user as any, 'admin');
  } catch (_e: any) {
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.FORBIDDEN,
        'Admin role required',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.FORBIDDEN) }
    );
  }
  return NextResponse.json(
    createSuccessEnvelope({ message: 'Admin access granted', uid: user.uid }, requestId),
    { status: 200 }
  );
}

