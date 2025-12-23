'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { CeloraLogo } from '@/components/ui/CeloraLogo';

export default function SplashPage() {
  const router = useRouter();
  const { user, isLoading, signInAnonymous } = useAuth();

  useEffect(() => {
    // If user is already authenticated, redirect to wallet
    if (!isLoading && user) {
      console.log('[Splash] User already authenticated, redirecting to /wallet');
      router.push('/wallet');
    }
  }, [user, isLoading, router]);

  const handleGetStarted = async () => {
    try {
      console.log('[Splash] Starting anonymous sign in...');
      // Use anonymous login for splash page quick start
      const result = await signInAnonymous?.();
      console.log('[Splash] Sign in result:', result);
      if (result?.error) {
        console.error('[Splash] Sign in failed:', result.error);
        const errorMsg = typeof result.error === 'string' ? result.error : (result.error as any)?.message || 'Unknown error';
        alert('Login failed: ' + errorMsg);
      } else {
        console.log('[Splash] Sign in successful, waiting for auth state...');
        // Wait a brief moment for auth state to propagate and cookie to be set
        await new Promise(resolve => setTimeout(resolve, 150));
        try {
          // Probe for existing wallets; if none, route to create flow
          const resp = await fetch('/api/wallet/list?blockchain=solana&limit=1');
          if (resp.ok) {
            const data = await resp.json();
            const wallets = data.data?.wallets || data.wallets || [];
            if (Array.isArray(wallets) && wallets.length > 0) {
              console.log('[Splash] Wallet exists, redirecting to /wallet');
              router.push('/wallet');
            } else {
              console.log('[Splash] No wallet, redirecting to /wallet/create-solana');
              router.push('/wallet/create-solana');
            }
          } else {
            console.log('[Splash] Wallet probe failed, fallback to /wallet');
            router.push('/wallet');
          }
        } catch (_e) {
          console.log('[Splash] Wallet probe exception, fallback to /wallet');
          router.push('/wallet');
        }
      }
    } catch (_error) {
      console.error('[Splash] Sign in exception:', _error);
      alert('Login error: ' + (_error instanceof Error ? _error.message : 'Unknown'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="cel-loading">
          <div className="cel-loading__spinner" />
          <p className="cel-loading__label">Preparing sign-in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg relative flex flex-col items-center justify-start pt-24 px-8">
      {/* Soft neon radial overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-purple-500/10"
        aria-hidden="true"
      />
      {/* Main content container */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center space-y-8">
        {/* Logo */}
        <CeloraLogo
          size="hero"
          layout="stack"
          withText={true}
        />
        
        {/* Get Started Button */}
        <button
          type="button"
          onClick={handleGetStarted}
          disabled={isLoading}
          aria-label="Get started"
          aria-busy={isLoading}
          className="group px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1022] transition-all duration-200 ease-out hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(10,245,211,.3)] hover:shadow-[0_0_40px_rgba(10,245,211,.5)]"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
