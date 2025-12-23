/**
 * Auth Verification Endpoint
 * 
 * Debug endpoint to verify Firebase token validation
 * Returns decoded token info if valid, 401 if invalid
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/serverAuth';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export const runtime = 'nodejs';

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-user-id',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * GET - Verify authentication token
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/auth/verify', method: 'GET'});
  const {requestId} = log;
  
  try {
    // Extract user from request (verifies token)
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.UNAUTHORIZED,
          'No valid authentication token found',
          requestId
        ),
        { 
          status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED),
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Return decoded token info
    return NextResponse.json(
      createSuccessEnvelope({
        authenticated: true,
        userId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: user.roles || [],
        authTime: user.authTime,
        currentTime: Math.floor(Date.now() / 1000)
      }, requestId),
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error) {
    logger.error('[Auth Verify] Error', { error, requestId });
    const log = createRequestLogger({endpoint: '/api/auth/verify', method: 'GET'});
    const {requestId: newRequestId} = log;
    
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.UNAUTHORIZED,
        'Token verification failed',
        newRequestId
      ),
      { 
        status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED),
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

