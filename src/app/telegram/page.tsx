/**
 * Telegram Mini App - Main Dashboard
 */

import { Suspense } from 'react';
import { TelegramDashboardClient } from '@/components/telegram/TelegramDashboardClient';

// Force dynamic rendering on Cloud Functions
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Deploy bump to refresh nextServer build
export default function TelegramDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <TelegramDashboardClient />
    </Suspense>
  );
}

















