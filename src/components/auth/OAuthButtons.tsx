"use client";
import React, { useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

interface Props { onAuth?: () => void }

export function OAuthButtons({ onAuth }: Props) {
  const [error, setError] = useState<string|undefined>();
  const [loading, setLoading] = useState<string|undefined>();

  async function handle(provider: 'google' | 'apple') {
    setError(undefined);
    setLoading(provider);
    try {
      const prov = provider === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
      await signInWithPopup(auth, prov);
      onAuth?.();
    } catch (e: any) {
      setError(e.message || 'OAuth failed');
    } finally {
      setLoading(undefined);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={() => handle('google')} disabled={loading==='google'} className="w-full border rounded py-2">
        {loading==='google' ? '...' : 'Continue with Google'}
      </button>
      <button onClick={() => handle('apple')} disabled={loading==='apple'} className="w-full border rounded py-2">
        {loading==='apple' ? '...' : 'Continue with Apple'}
      </button>
      {error && <div className="text-red-600 text-xs">{error}</div>}
    </div>
  );
}
