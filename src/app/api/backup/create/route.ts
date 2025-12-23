import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import backupService from '@/server/services/backupService';
import { loadEncryptedMnemonic, decryptMnemonic } from '@/lib/clientKeyManagement';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';

const prisma = new PrismaClient();

/**
 * POST /api/backup/create - Create encrypted backup
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger({endpoint: '/api/backup/create', method: 'POST'});
  const {requestId} = log;
  
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
    const { walletId, walletName, password } = body;

    if (!walletId || !password) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.VALIDATION_ERROR,
          'walletId and password required',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.NOT_FOUND,
          'Wallet not found',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Load encrypted mnemonic
    const encrypted = loadEncryptedMnemonic(walletId);
    if (!encrypted) {
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.NOT_FOUND,
          'Wallet encrypted data not found',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Decrypt mnemonic (this requires the user's local password, which they should provide)
    // For this implementation, we're using the backup password as the encryption key
    let mnemonic = '';
    try {
      mnemonic = await decryptMnemonic(
        encrypted.encryptedMnemonic || (encrypted as any).encrypted,
        password, // Using backup password for now
        encrypted.salt,
        encrypted.iv
      );
    } catch (_e) {
      // If decryption fails, return error
      return NextResponse.json(
        createErrorEnvelope(
          ErrorCodes.UNAUTHORIZED,
          'Invalid password or corrupted wallet data',
          requestId
        ),
        { status: getStatusForErrorCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Create backup file
    const backup = await backupService.createBackupFile(
      walletId,
      walletName || 'My Wallet',
      wallet.blockchain,
      wallet.address,
      mnemonic,
      password
    );

    // Clear mnemonic from memory
    mnemonic = '';

    // Store backup metadata in database
    try {
      const walletBackupModel = (prisma as any).walletBackup;
      if (walletBackupModel?.create) {
        await walletBackupModel.create({
        data: {
          walletId,
          userId,
          backupId: backup.metadata.walletId,
          checksumHash: backup.checksum,
          createdAt: new Date(),
          backupType: 'encrypted_file',
        },
        });
      }
    } catch (dbError) {
      logger.error('Failed to store backup metadata', dbError);
      // Don't fail the request if DB write fails
    }

    return NextResponse.json(
      createSuccessEnvelope(
        {
          backup,
          message: 'Backup created successfully. Download and store securely.',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error creating backup', error, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create backup',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

