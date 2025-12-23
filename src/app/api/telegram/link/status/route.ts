/**
 * Check Telegram Link Status
 * GET /api/telegram/link/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/telegram/link/status', method: 'GET' });
  const { requestId } = log;
  let userId: string | null = null;
  try {
    userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
        telegramNotificationsEnabled: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.NOT_FOUND, 'User not found', requestId),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }
    
    return NextResponse.json(
      createSuccessEnvelope({
        linked: !!user.telegramId,
        telegramUsername: user.telegramUsername,
        linkedAt: user.telegramLinkedAt?.toISOString(),
        notificationsEnabled: user.telegramNotificationsEnabled,
      }, requestId),
      { status: 200 }
    );
    
  } catch (error) {
    logger.error('Error checking link status', error, { userId: userId ?? 'unknown' });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to check status', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}

/**
 * Unlink Telegram Account
 * DELETE /api/telegram/link/status
 */
export async function DELETE(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/telegram/link/status', method: 'DELETE' });
  const { requestId } = log;
  let userId: string | null = null;
  try {
    userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'Unauthorized', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }
    
    // Remove telegram link
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
        telegramNotificationsEnabled: false,
      },
    });
    
    // Deactivate telegram user entries
    await prisma.telegramUser.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    
    // Log the unlinking
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'telegram_unlinked',
        resource: 'telegram',
        platform: 'pwa',
        status: 'success',
      },
    });
    
    return NextResponse.json(
      createSuccessEnvelope({ unlinked: true }, requestId),
      { status: 200 }
    );
    
  } catch (error) {
    logger.error('Error unlinking', error, { userId: userId ?? 'unknown' });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to unlink', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}




