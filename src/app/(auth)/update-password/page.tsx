"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

export default function UpdatePasswordPage() {
  const { triggerPasswordReset, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    const result = await triggerPasswordReset(email);

    if (!result.success && result.error) {
      setError(result.error);
      return;
    }

    setStatus(
      'Password reset email sent. Check your inbox and follow the instructions.',
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-gray-950 to-blue-950 opacity-80" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-2xl bg-gray-900/70 backdrop-blur-xl border border-cyan-400/25 rounded-2xl px-10 py-12 space-y-8 shadow-[0_25px_80px_-25px_rgba(0,220,255,0.35)]"
      >
        <div className="space-y-2">
          <p className="uppercase tracking-[0.3em] text-xs text-cyan-300/80">Celora Identity</p>
          <h1 className="text-3xl font-mono font-bold text-cyan-200">Update Your Password</h1>
          <p className="text-sm text-gray-300 leading-relaxed">
            Passordadministrasjon håndteres av Firebase Authentication. Skriv inn e‑posten din for å motta en sikker lenke for tilbakestilling av passord.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/15 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {status && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {status}
          </div>
        )}

        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800/50 border border-cyan-400/30 rounded-md px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              placeholder="your@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono font-semibold py-3 rounded-md transition-all"
          >
            {isLoading ? 'Sending reset email…' : 'Send password reset'}
          </button>
        </form>

        <div className="text-sm text-gray-400 flex items-center justify-between">
          <Link href="/splash" className="text-cyan-300 hover:text-cyan-200 font-medium">
            Tilbake til innlogging
          </Link>
          <Link href="/signup" className="text-cyan-300 hover:text-cyan-200 font-medium">
            Opprett konto
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
