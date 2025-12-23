/**
 * Health Check API
 * 
 * Returns system health status for monitoring and observability.
 */

import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/server/db/client';
import { HealthCheckResponseSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

export async function GET() {
  const log = createRequestLogger({ endpoint: '/api/diagnostics/health', method: 'GET' });
  const { requestId } = log;

  try {
    // Check database health
    const dbHealth = await checkDatabaseHealth();

    // Check Redis health (placeholder)
    const redisHealth = {
      status: 'healthy' as const,
      latency: null,
    };

    // Check App Check / reCAPTCHA configuration
    const appCheckConfigured = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY);
    const recaptchaConfigured = Boolean(process.env.RECAPTCHA_SECRET_KEY);

    // Determine overall status
    const isHealthy = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';
    const overallStatus = isHealthy ? 'healthy' : 'unhealthy';

    const healthCheck = HealthCheckResponseSchema.parse({
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.status,
          latency: dbHealth.latency || null,
          error: dbHealth.error,
        },
        redis: {
          status: redisHealth.status,
          latency: redisHealth.latency,
        },
        appCheck: {
          status: appCheckConfigured ? 'healthy' : 'unhealthy',
          configured: appCheckConfigured,
        },
        recaptcha: {
          status: recaptchaConfigured ? 'healthy' : 'unhealthy',
          configured: recaptchaConfigured,
        },
      },
    });

    return NextResponse.json(
      createSuccessEnvelope(healthCheck, requestId),
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error) {
    logger.error('Health check error', error, { requestId });

    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Health check failed',
        requestId
      ),
      { status: 503 }
    );
  }
}

