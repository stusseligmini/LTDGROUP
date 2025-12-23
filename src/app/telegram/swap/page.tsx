/**
 * Telegram Mini App - Swap Interface
 * Mobile-optimized swap flow with multi-step process
 */

import { Suspense } from 'react';
import { TelegramSwapClient } from '@/components/telegram/TelegramSwapClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function TelegramSwap() {
  // Get walletId from URL params or use default
  const defaultWalletId = 'default-solana';

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading swap...</p>
        </div>
      </div>
    }>
      <TelegramSwapClient walletId={defaultWalletId} />
    </Suspense>
  );
}
