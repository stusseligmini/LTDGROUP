"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

export default function SignUpPage() {
  const { signUp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    const result = await signUp(email, password);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 via-slate-950/40 to-cyan-950/30" />
      <div className="relative z-10 w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/65 backdrop-blur-lg border border-purple-400/25 rounded-2xl px-10 py-12 space-y-8 shadow-[0_25px_80px_-25px_rgba(168,85,247,0.45)]"
        >
          <div className="space-y-2">
            <p className="uppercase tracking-[0.3em] text-xs text-purple-300/80">Celora Identity</p>
            <h1 className="text-3xl font-mono font-bold text-purple-200">Create your Celora ID</h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Registreringen håndteres av Firebase Authentication. Du vil motta en e‑post for å bekrefte kontoen din.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/15 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
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
                className="w-full bg-gray-800/50 border border-purple-400/30 rounded-md px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-gray-800/50 border border-purple-400/30 rounded-md px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-400 hover:via-pink-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono font-semibold py-3 rounded-md transition-all"
            >
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="text-sm text-gray-400 flex items-center justify-between">
            <span>Har du allerede konto?</span>
            <Link href="/splash" className="text-cyan-300 hover:text-cyan-200 font-medium">
              Logg inn
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
