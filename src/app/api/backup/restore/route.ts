import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import backupService from '@/server/services/backupService';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { BackupFile } from '@/types/backup';

const prisma = new PrismaClient();

/**
 * POST /api/backup/restore - Restore wallet from encrypted backup
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/backup/restore', method: 'POST' });
  const { requestId } = log;

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.UNAUTHORIZED,
          'User ID is required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    const { backup, password }: { backup: BackupFile; password: string } = body;

    if (!backup || !password) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'backup and password required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Validate backup structure
    if (!backup.metadata || !backup.encryptedData || !backup.salt || !backup.iv) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid backup file format',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Restore wallet from backup
    // Normalize createdAt to Date for service
    const normalizedBackup = {
      ...backup,
      metadata: {
        ...backup.metadata,
        createdAt: new Date(backup.metadata.createdAt),
      },
    } as BackupFile;

    const result = await backupService.restoreFromBackupFile(normalizedBackup as any, password);

    if (!result || !result.mnemonic) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Failed to restore wallet',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
      );
    }

    log.logSuccess({ walletAddress: backup.metadata.address });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          mnemonic: result.mnemonic,
          address: backup.metadata.address,
          blockchain: backup.metadata.blockchain,
          metadata: backup.metadata,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Backup restore error', error);
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to restore wallet',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}
