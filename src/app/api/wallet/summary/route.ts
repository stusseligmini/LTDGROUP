import { NextRequest, NextResponse } from 'next/server';
import { getWalletSummary } from '@/server/services/walletService';
import { setRlsUser } from '@/server/db/rls';
import { prisma } from '@/server/db/client';
import { WalletSummaryResponseSchema } from '@/lib/validation/schemas';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const allowedOrigins = new Set(
  [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_EXTENSION_ORIGIN]
    .filter((value): value is string => Boolean(value))
);

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return process.env.NEXT_PUBLIC_APP_URL ?? '*';
  }

  if (allowedOrigins.size === 0) {
    return origin;
  }

  if (allowedOrigins.has(origin)) {
    return origin;
  }

  return null;
}

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = resolveAllowedOrigin(request);

  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Headers', 'authorization, content-type, x-user-id');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

  return response;
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, request);
}

export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/wallet/summary', method: 'GET' });
  const { requestId } = log;
  let userId: string | null = null;
  
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    const userIdHeader = request.headers.get('x-user-id');
    userId = userIdHeader && userIdHeader !== 'undefined' ? userIdHeader : null;

    if (!userId) {
      const response = NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
      return withCors(response, request);
    }

    log.logStart({ userId });

    // Set RLS context for this user; subsequent Prisma queries will be filtered by user_id
    await setRlsUser(prisma, userId);

    const summary = await getWalletSummary(userId, token);

    // Return in the shape expected by clients
    const payload = {
      totalBalance: summary.totalBalance ?? 0,
      currency: summary.currency ?? 'USD',
      holdings: Array.isArray(summary.holdings) ? summary.holdings : [],
      lastUpdated: summary.lastUpdated ?? new Date().toISOString(),
    };

    // Validate response against schema
    const validatedSummary = WalletSummaryResponseSchema.parse(payload);

    const response = NextResponse.json(
      createSuccessEnvelope(validatedSummary, requestId),
      { status: 200 }
    );
    log.logSuccess({ userId, totalBalance: payload.totalBalance, holdingsCount: payload.holdings.length });
    return withCors(response, request);
  } catch (error) {
    log.logError(error, { userId });
    const response = NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch wallet summary', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
    return withCors(response, request);
  }
}


