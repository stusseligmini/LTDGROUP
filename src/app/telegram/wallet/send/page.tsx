/**
 * Telegram Mini App - Send Crypto
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showBackButton, showMainButton, hideMainButton, haptic } from '@/lib/telegram/webapp';
import { useWalletSummary } from '@/hooks/useWalletSummary';

export default function TelegramSendPage() {
  const router = useRouter();
  const { summary, loading } = useWalletSummary();
  const safeHoldings = Array.isArray(summary?.holdings) ? summary.holdings : [];
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    if (!to || !amount || Number(amount) <= 0) {
      setError('Angi mottaker og beløp');
      return;
    }
    if (!safeHoldings[0]?.id) {
      setError('Ingen wallet funnet');
      return;
    }
    setError(null);
    setStatus(null);
    setSending(true);
    haptic('impact', 'medium');
    try {
      const res = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: safeHoldings[0].id,
          to,
          amount,
          token: safeHoldings[0].currency || 'SOL',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Kunne ikke sende');
      setStatus('Sendt! Tx: ' + (data.txHash || 'ok'));
      haptic('notification', 'success');
    } catch (e: any) {
      setError(e.message || 'Feil ved sending');
      haptic('notification', 'error');
    } finally {
      setSending(false);
    }
  }, [to, amount, safeHoldings]);

  useEffect(() => {
    showBackButton(() => router.push('/telegram/wallet'));
    showMainButton('Send', () => handleSend());
    return () => hideMainButton();
  }, [router, handleSend]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Send</h1>
        <button
          onClick={handleSend}
          disabled={sending}
          className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-lg text-sm disabled:opacity-60"
        >
          {sending ? 'Sender...' : 'Send'}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400">Laster balanse...</div>
      ) : (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="text-sm text-gray-400">Fra</div>
          <div className="text-lg font-semibold">{summary?.holdings?.[0]?.label || 'Wallet'}</div>
          <div className="text-sm text-gray-500">{summary?.holdings?.[0]?.address || ''}</div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-300">Mottaker (@username eller adresse)</label>
          <input
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            placeholder="@bruker eller adresse"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-300">Beløp</label>
          <input
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            placeholder="0.0"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 p-3 rounded-lg">{error}</div>}
      {status && <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/40 p-3 rounded-lg">{status}</div>}
    </div>
  );
}
