/**
 * Link Telegram account to user
 * POST /api/telegram/link
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * POST /api/telegram/link - Link Telegram account to user
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/telegram/link', method: 'POST' });
  const { requestId } = log;
  
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.UNAUTHORIZED, 'User ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    const { telegramId, telegramUsername } = body;

    if (!telegramId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Telegram ID is required', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check if Telegram ID is already linked to another user
    const existingLink = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
    });

    if (existingLink && existingLink.id !== userId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.CONFLICT, 'This Telegram account is already linked to another user', requestId),
        { status: getStatusForErrorCode(ErrorCodes.CONFLICT) }
      );
    }

    // Link Telegram account
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: String(telegramId),
        telegramUsername: telegramUsername || null,
        telegramLinkedAt: new Date(),
      },
    });

    logger.info('Telegram account linked', {
      userId,
      telegramId: String(telegramId),
      telegramUsername,
      requestId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          telegramId: updatedUser.telegramId,
          telegramUsername: updatedUser.telegramUsername,
          linkedAt: updatedUser.telegramLinkedAt,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error linking Telegram account', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to link Telegram account', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}


