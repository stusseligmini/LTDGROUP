/**
 * Verify Telegram Account Linking
 * POST /api/telegram/link/verify
 * 
 * Called from Telegram bot when user enters verification code
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

interface VerifyRequest {
  verificationCode: string;
  telegramId: string;
  chatId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/telegram/link/verify', method: 'POST' });
  const { requestId } = log;
  try {
    const body: VerifyRequest = await request.json();
    
    if (!body.verificationCode || !body.telegramId || !body.chatId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Missing required fields', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    // Find pending verification
    const pending = await prisma.telegramUser.findFirst({
      where: {
        verificationCode: body.verificationCode,
        isActive: false,
        verificationExpiresAt: {
          gte: new Date(),
        },
      },
    });
    
    if (!pending) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid or expired verification code', requestId),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }
    
    // Update telegram user with real data
    await prisma.telegramUser.update({
      where: { id: pending.id },
      data: {
        telegramId: BigInt(body.telegramId),
        chatId: body.chatId,
        username: body.username,
        firstName: body.firstName,
        lastName: body.lastName,
        isActive: true,
        linkedAt: new Date(),
        verificationCode: null,
        verificationExpiresAt: null,
      },
    });
    
    // Update user record
    await prisma.user.update({
      where: { id: pending.userId },
      data: {
        telegramId: body.telegramId, // User.telegramId is String
        telegramUsername: body.username,
        telegramLinkedAt: new Date(),
        telegramNotificationsEnabled: true,
      },
    });
    
    // Log the linking
    await prisma.auditLog.create({
      data: {
        userId: pending.userId,
        action: 'telegram_linked',
        resource: 'telegram',
        resourceId: body.telegramId,
        platform: 'telegram',
        status: 'success',
        metadata: {
          telegramId: body.telegramId,
          username: body.username,
        },
      },
    });
    
    return NextResponse.json(
      createSuccessEnvelope({
        linked: true,
        userId: pending.userId,
      }, requestId),
      { status: 200 }
    );
    
  } catch (error) {
    const telegramId = (error as any).telegramId;
    logger.error('Error verifying link', error, { telegramId });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to verify linking', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}




