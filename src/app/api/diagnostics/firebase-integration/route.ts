/**
 * Firebase Integration Diagnostics
 * 
 * Comprehensive health check for Firebase integration with:
 * - Firestore (wallets, transactions, settings)
 * - Firebase Auth (user identification)
 * - Admin SDK (server-side operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getUserIdFromRequest } from '@/lib/auth/serverAuth';
import { PrismaClient } from '@prisma/client';
import { createRequestLogger } from '@/lib/logging/requestLogger';
import { ErrorCodes, getStatusForErrorCode } from '@/lib/errors/codes';
import { createErrorEnvelope, createSuccessEnvelope } from '@/lib/errors/envelope';
import { 
  getUserSettings, 
  getUserWallets, 
  getWalletTransactions 
} from '@/lib/firebase/firestore';
import { getFirebaseAdmin } from '@/lib/firebase/admin';

const prisma = new PrismaClient();

export const runtime = 'nodejs';

interface DiagnosticResult {
  timestamp: string;
  userId: string | null;
  checks: {
    auth: { passed: boolean; message: string };
    firebaseAdmin: { passed: boolean; message: string };
    firestore: { passed: boolean; message: string };
    postgres: { passed: boolean; message: string };
    firebaseSync: { passed: boolean; message: string };
  };
  summary: {
    allPassed: boolean;
    passedCount: number;
    totalChecks: number;
  };
}

export async function GET(request: NextRequest) {
  const log = createRequestLogger({ endpoint: '/api/diagnostics/firebase-integration', method: 'GET' });
  const { requestId } = log;
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    userId: null,
    checks: {
      auth: { passed: false, message: 'Not checked' },
      firebaseAdmin: { passed: false, message: 'Not checked' },
      firestore: { passed: false, message: 'Not checked' },
      postgres: { passed: false, message: 'Not checked' },
      firebaseSync: { passed: false, message: 'Not checked' },
    },
    summary: {
      allPassed: false,
      passedCount: 0,
      totalChecks: 5,
    },
  };

  try {
    // 1. Check authentication
    try {
      const userId = await getUserIdFromRequest(request);
      result.userId = userId;
      if (userId) {
        result.checks.auth = { 
          passed: true, 
          message: `✅ Authenticated as user: ${userId}` 
        };
      } else {
        result.checks.auth = { 
          passed: false, 
          message: 'User not authenticated (no token found)' 
        };
      }
    } catch (error) {
      result.checks.auth = { 
        passed: false, 
        message: `Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }

    // 2. Check Firebase Admin SDK
    try {
      const { app, auth } = getFirebaseAdmin();
      if (app && auth) {
        result.checks.firebaseAdmin = {
          passed: true,
          message: `✅ Firebase Admin initialized (Project: ${app.options.projectId})`,
        };
      } else {
        result.checks.firebaseAdmin = {
          passed: false,
          message: 'Firebase Admin SDK not properly initialized',
        };
      }
    } catch (error) {
      result.checks.firebaseAdmin = {
        passed: false,
        message: `Firebase Admin check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // 3. Check Firestore if authenticated
    if (result.userId) {
      try {
        const settings = await getUserSettings(result.userId);
        const wallets = await getUserWallets(result.userId);
        
        result.checks.firestore = {
          passed: true,
          message: `✅ Firestore connected (Settings: ${settings ? 'found' : 'not found'}, Wallets: ${wallets.length})`,
        };
      } catch (error) {
        result.checks.firestore = {
          passed: false,
          message: `Firestore check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else {
      result.checks.firestore = {
        passed: false,
        message: 'Skipped (user not authenticated)',
      };
    }

    // 4. Check PostgreSQL
    try {
      const userCount = await prisma.user.count();
      const walletCount = await prisma.wallet.count();
      const transactionCount = await prisma.transaction.count();
      
      result.checks.postgres = {
        passed: true,
        message: `✅ PostgreSQL connected (Users: ${userCount}, Wallets: ${walletCount}, Transactions: ${transactionCount})`,
      };
    } catch (error) {
      result.checks.postgres = {
        passed: false,
        message: `PostgreSQL check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // 5. Check sync between systems
    if (result.userId && result.checks.firestore.passed && result.checks.postgres.passed) {
      try {
        const pgWallets = await prisma.wallet.findMany({ 
          where: { userId: result.userId },
          select: { id: true, address: true },
        });
        
        const syncIssues: string[] = [];
        
        for (const wallet of pgWallets) {
          try {
            const txs = await getWalletTransactions(result.userId, wallet.id);
            // Check if transactions are synced
            const pgTxs = await prisma.transaction.findMany({
              where: { walletId: wallet.id },
            });
            
            if (pgTxs.length > 0 && txs.length === 0) {
              syncIssues.push(`Wallet ${wallet.id}: Transactions in Postgres but missing in Firestore`);
            }
          } catch {
            // Ignore individual wallet sync errors
          }
        }
        
        result.checks.firebaseSync = {
          passed: syncIssues.length === 0,
          message: syncIssues.length === 0 
            ? `✅ Sync appears healthy (${pgWallets.length} wallets)` 
            : `⚠️ Sync issues detected: ${syncIssues.join('; ')}`,
        };
      } catch (error) {
        result.checks.firebaseSync = {
          passed: false,
          message: `Sync check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else {
      result.checks.firebaseSync = {
        passed: false,
        message: 'Skipped (prerequisites not met)',
      };
    }

    // Calculate summary
    result.summary.passedCount = Object.values(result.checks).filter(c => c.passed).length;
    result.summary.allPassed = result.summary.passedCount === result.summary.totalChecks;

    logger.info('Firebase integration diagnostics completed', {
      requestId,
      userId: result.userId,
      allPassed: result.summary.allPassed,
      passedCount: result.summary.passedCount,
    });

    return NextResponse.json(
      createSuccessEnvelope(result, requestId),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Diagnostics error', error instanceof Error ? error : undefined, { requestId });
    return NextResponse.json(
      createErrorEnvelope(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Diagnostics check failed',
        requestId
      ),
      { status: getStatusForErrorCode(ErrorCodes.INTERNAL_SERVER_ERROR) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

