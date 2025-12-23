"use client";
import React, { useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

interface Props { onAuth?: () => void }

export function EmailPasswordForm({ onAuth }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [error, setError] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuth?.();
    } catch (e: any) {
      setError(e.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setMode('signin')} className={mode==='signin' ? 'font-semibold' : ''}>Sign In</button>
        <button type="button" onClick={() => setMode('signup')} className={mode==='signup' ? 'font-semibold' : ''}>Sign Up</button>
      </div>
      <input
        type="email"
        required
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded p-2"
      />
      <input
        type="password"
        required
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border rounded p-2"
      />
      {error && <div className="text-red-600 text-xs">{error}</div>}
      <button disabled={loading} className="w-full bg-black text-white rounded py-2">
        {loading ? '...' : (mode==='signup' ? 'Create Account' : 'Sign In')}
      </button>
    </form>
  );
}
