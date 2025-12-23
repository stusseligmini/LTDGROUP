"use client";
import React, { useState } from 'react';

interface Props { onLinked?: () => void }

export function TelegramLinkButton({ onLinked }: Props) {
  const [error, setError] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);

  async function handleTelegram() {
    setError(undefined); setLoading(true);
    try {
      // Placeholder: open Telegram login widget or custom page
      const res = await fetch('/api/auth/link/telegram', { method: 'POST' });
      if (!res.ok) throw new Error('Telegram link failed');
      onLinked?.();
    } catch (e: any) {
      setError(e.message || 'Telegram link error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={handleTelegram} disabled={loading} className="w-full border rounded py-2">
        {loading ? 'Linking…' : 'Link Telegram'}
      </button>
      {error && <div className="text-red-600 text-xs">{error}</div>}
    </div>
  );
}
