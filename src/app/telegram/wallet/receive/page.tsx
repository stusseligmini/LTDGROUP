/**
 * Telegram Mini App - Receive Crypto
 */

'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showBackButton, hideMainButton, haptic } from '@/lib/telegram/webapp';
import { useWalletSummary } from '@/hooks/useWalletSummary';
import { QRCodeSVG } from 'qrcode.react';

export default function TelegramReceivePage() {
  const router = useRouter();
  const { summary, loading } = useWalletSummary();
  const safeHoldings = Array.isArray(summary?.holdings) ? summary.holdings : [];

  useEffect(() => {
    showBackButton(() => router.push('/telegram/wallet'));
    hideMainButton();
  }, [router]);

  const address = safeHoldings[0]?.address || '';

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Receive</h1>
        <button
          onClick={() => {
            if (address) {
              navigator.clipboard.writeText(address);
              haptic('notification', 'success');
            }
          }}
          className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm border border-slate-700"
        >
          Kopier
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400">Laster adresse...</div>
      ) : address ? (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center space-y-4">
          <div className="flex justify-center">
            <QRCodeSVG value={address} size={180} bgColor="#0f172a" fgColor="#e2e8f0" />
          </div>
          <div className="text-sm text-gray-300 break-all">{address}</div>
          <div className="text-xs text-gray-500">Send kun støttede tokens til denne adressen.</div>
        </div>
      ) : (
        <div className="text-center text-gray-400">Ingen wallet funnet</div>
      )}
    </div>
  );
}
