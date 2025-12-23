/**
 * User Settings API
 * GET: Fetch user settings
 * POST: Update user settings
 * 
 * Integrates with:
 * - Firestore (real-time sync for extension/telegram)
 * - PostgreSQL (persistent storage)
 * - Firebase Auth (user identification)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '@/lib/validation/validate';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { updateUserSettings, getUserSettings } from '@/lib/firebase/firestore';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

export const runtime = 'nodejs';

/**
 * GET /api/settings
 * Fetch current user settings
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/settings', method: 'GET' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User authentication required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Try to fetch from Firestore first (for real-time sync)
    let settings = await getUserSettings(userId);

    // If not in Firestore, create defaults
    if (!settings) {
      const defaultSettings = {
        defaultCurrency: 'USD',
        language: 'en',
        notifications: {
          telegram: true,
          push: true,
        },
      };
      
      // Store in Firestore
      await updateUserSettings(userId, defaultSettings);
      settings = { userId, ...defaultSettings, updatedAt: new Date() } as any;
    }

    logger.info('Fetched user settings', { userId, requestId });
    return NextResponse.json(
      createSuccessEnvelope({ settings }, requestId),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, error.message, requestId, { fields: error.fields }),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    logger.error('Error fetching settings', error instanceof Error ? error : undefined, { requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch settings', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/settings
 * Update user settings
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/settings', method: 'POST' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User authentication required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    
    // Validate update payload
    const allowedFields = ['defaultCurrency', 'language', 'notifications'];
    const updates: any = {};
    
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'No valid fields to update', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Update in Firestore
    await updateUserSettings(userId, updates);

    // Also update in PostgreSQL if needed for audit/backup
    try {
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (existingUser) {
        // Store preferred currency in user profile if needed
        // Can extend user schema to include preferences
      }
    } catch (dbError) {
      logger.warn('Could not update PostgreSQL user settings', { userId, requestId });
      // Continue anyway - Firestore is the primary store
    }

    logger.info('Updated user settings', { userId, fields: Object.keys(updates), requestId });
    
    const updatedSettings = await getUserSettings(userId);
    return NextResponse.json(
      createSuccessEnvelope({ settings: updatedSettings }, requestId),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid JSON in request body', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    logger.error('Error updating settings', error instanceof Error ? error : undefined, { requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update settings', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

