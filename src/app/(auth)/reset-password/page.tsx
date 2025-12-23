"use client";

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

export default function ResetPasswordPage() {
  const { triggerPasswordReset, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    const result = await triggerPasswordReset(email);
    if (!result.success && result.error) {
      setError(result.error);
    } else {
      setSuccess('Password reset email sent. Check your inbox.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/30 via-slate-950/40 to-blue-950/30" />
      <div className="relative z-10 w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/60 backdrop-blur-lg border border-cyan-400/25 rounded-2xl px-8 py-10 space-y-6"
        >
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-mono font-bold text-cyan-200">Reset password</h1>
            <p className="text-sm text-gray-300">
              Vi bruker Firebase Authentication for å håndtere passordet ditt. Skriv inn e‑posten din, så sender vi en sikker lenke for tilbakestilling.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/15 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-green-500/40 bg-green-500/15 p-3 text-sm text-green-200 animate-pulse">
              {success}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
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
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono font-semibold py-3 rounded-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending reset email…' : 'Send reset email'}
            </button>
          </form>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <Link href="/splash" className="text-cyan-300 hover:text-cyan-200">
              Tilbake til innlogging
            </Link>
            <Link href="/signup" className="text-cyan-300 hover:text-cyan-200">
              Opprett konto
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
