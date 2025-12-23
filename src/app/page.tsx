'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTelegram } from '@/providers/TelegramProvider';
import { Lock } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, signIn, signInAnonymous, signUp } = useAuth();
  const { isTelegram, isReady: telegramReady } = useTelegram();
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  // Route based on environment
  useEffect(() => {
    if (!isLoading && telegramReady) {
      if (isTelegram) {
        // Telegram users always go to telegram routes
        router.push('/telegram');
      } else if (user) {
        router.push('/wallet');
      } else {
        router.push('/splash');
      }
    }
  }, [user, isLoading, router, isTelegram, telegramReady]);

  const handleLockClick = () => {
    console.log('[Home] Lock clicked');
    setShowAuth(true);
  };

  const handleAuth = async () => {
    setError('');
    
    if (isLogin) {
      // If user provided credentials, perform email/password login
      if (email && password) {
        try {
          const result = await signIn(email, password);
          if (result.success !== false) {
            router.push('/wallet');
          } else {
            setError(result.error || 'Login failed');
          }
        } catch (_err) {
          setError('Login error');
        }
      } else {
        // No credentials: allow quick anonymous entry
        try {
          const result = await (signInAnonymous?.() ?? Promise.resolve({ success: false, error: 'Anonymous sign-in unavailable' }));
          if (result.success !== false) {
            router.push('/wallet');
          } else {
            setError(result.error || 'Anonymous login failed');
          }
        } catch (_err: any) {
          setError('Anonymous login error');
        }
      }
    } else {
      // Register - bare email og password
      if (!email || !password) {
        setError('Enter email and password');
        return;
      }
      
      try {
        const result = await signUp(email, password);
        if (result.success !== false) {
          router.push('/onboarding');
        } else {
          setError(result.error || 'Registration failed');
        }
      } catch (_err) {
        setError('Registration error');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="cel-loading">
          <div className="cel-loading__spinner" />
        </div>
      </div>
    );
  }

  if (showAuth) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
              <Lock className="w-16 h-16 text-cyan-400" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
              CELORA
            </h1>
          </div>

          {/* Auth Card */}
          <div className="glass-panel border-gradient p-8 space-y-6">
            {/* Toggle Login/Register */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  isLogin
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                    : 'bg-slate-800/50 text-gray-400 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  !isLogin
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                    : 'bg-slate-800/50 text-gray-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Email (only for register) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Password/PIN */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isLogin ? 'Password or PIN' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? 'Enter password or PIN' : 'Create password'}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleAuth}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {isLogin ? 'Login' : 'Register'}
            </button>

            {/* Back */}
            <button
              onClick={() => setShowAuth(false)}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main frontpage - bare låsen
  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center px-4">
      {/* Neon glow background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-purple-500/10" />

      {/* Lock Icon - clickable */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLockClick(); }}
        className="group relative mb-12 focus:outline-none cursor-pointer z-10"
        aria-label="Open authentication"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-3xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
        <div className="relative w-32 h-32 flex items-center justify-center bg-slate-900/80 rounded-3xl border-2 border-cyan-400/50 group-hover:border-cyan-400 transition-all group-hover:scale-110">
          <Lock className="w-16 h-16 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
        </div>
      </button>

      {/* CELORA Text */}
      <h1 
        className="text-7xl font-bold mb-4 tracking-wider"
        style={{
          color: '#22D3EE',
          WebkitTextStroke: '2px #F97316',
          textShadow: '0 0 20px rgba(34, 211, 238, 0.5)'
        }}
      >
        CELORA
      </h1>

      {/* Subtitle */}
      <p className="text-gray-400 text-lg mb-8">
        Your non-custodial Solana wallet for gambling and beyond
      </p>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mt-8">
        <div className="glass-panel p-6 text-center">
          <div className="text-cyan-400 mb-2">🔒</div>
          <h3 className="text-white font-semibold mb-1">100% Non-Custodial</h3>
          <p className="text-gray-400 text-sm">You own your keys. We never see your seed phrase.</p>
        </div>
        <div className="glass-panel p-6 text-center">
          <div className="text-cyan-400 mb-2">⚡</div>
          <h3 className="text-white font-semibold mb-1">Lightning Fast</h3>
          <p className="text-gray-400 text-sm">Send to @username instantly. Swap tokens in seconds.</p>
        </div>
        <div className="glass-panel p-6 text-center">
          <div className="text-cyan-400 mb-2">🎰</div>
          <h3 className="text-white font-semibold mb-1">Gambler-Friendly</h3>
          <p className="text-gray-400 text-sm">Quick deposits to casinos. Virtual cards. Price tracking.</p>
        </div>
      </div>
    </div>
  );
}

