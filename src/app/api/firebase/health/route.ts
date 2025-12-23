/**
 * Firebase Health Endpoint
 * Provides status of client/admin configuration for diagnostics.
 */

import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { requireAuth } from '@/lib/auth/requireAuth';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export const runtime = 'nodejs';

function getClientConfigStatus() {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];
  const missing = required.filter(k => !process.env[k]);
  return { missing, ok: missing.length === 0 };
}

function getAdminConfigStatus() {
  const decomposed = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const present = decomposed.every(k => !!process.env[k]);
  const serviceJson = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  return {
    usingServiceAccountJson: serviceJson,
    usingDecomposed: present && !serviceJson,
    ok: serviceJson || present,
  };
}

export async function GET(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/firebase/health', method: 'GET'});
  const {requestId} = log;
  
  // Wrap request as NextRequest-like for cookie/header access
  // Next.js route handlers pass a native Request; minimal shim for requireAuth
  const { user, error: authError } = await requireAuth(request as any);
  if (authError || !user) {
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.UNAUTHORIZED,
        'Authentication required',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
    );
  }
  const clientStatus = getClientConfigStatus();
  let adminStatus;
  let adminInit = null;
  try {
    const { app } = getFirebaseAdmin();
    adminStatus = getAdminConfigStatus();
    adminInit = {
      name: app.name,
      optionsProjectId: app.options.projectId,
    };
  } catch (e: any) {
    adminStatus = { ok: false, error: e?.message || 'admin init failed' };
  }

  return NextResponse.json(
    createSuccessEnvelope({
      timestamp: new Date().toISOString(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
      client: clientStatus,
      admin: adminStatus,
      adminInit,
      auth: { uid: user.uid, email: user.email || null },
    }, requestId),
    { status: 200 }
  );
}

