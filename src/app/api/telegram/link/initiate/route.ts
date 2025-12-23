/**
 * Initiate Telegram Account Linking
 * POST /api/telegram/link/initiate
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { logger } from '@/lib/logger';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/telegram/link/initiate', method: 'POST' });
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
    
    // Check if already linked
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });
    
    if (existing?.telegramId) {
      return NextResponse.json(
        createErrorEnvelope(ErrorCodes.CONFLICT, 'Telegram account already linked', requestId),
        { status: getStatusForErrorCode(ErrorCodes.CONFLICT) }
      );
    }
    
    // Generate verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Create temporary telegram user entry
    await prisma.telegramUser.create({
      data: {
        userId,
        telegramId: BigInt(Date.now()), // Temporary placeholder, will be updated on verification
        chatId: '0', // Will be updated
        verificationCode,
        verificationExpiresAt: expiresAt,
        isActive: false,
      },
    });
    
    return NextResponse.json(
      createSuccessEnvelope({
        verificationCode,
        expiresAt: expiresAt.toISOString(),
        expiresIn: 600, // seconds
      }, requestId),
      { status: 200 }
    );
    
  } catch (error) {
    logger.error('Error initiating Telegram link', error, { userId: userId ?? 'unknown' });
    return NextResponse.json(
      createErrorEnvelope(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to initiate linking', requestId),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  }
}




