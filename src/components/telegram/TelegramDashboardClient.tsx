'use client';

import { useEffect } from 'react';
import { hideBackButton } from '@/lib/telegram/webapp';
import { useTelegramAuth } from '@/hooks/useTelegramAuth';
import { useTelegramWalletSummary } from '@/hooks/useTelegramWalletSummary';
import { formatCurrency } from '@/lib/ui/formatters';
import { useRouter } from 'next/navigation';
import { SecurityBadge } from '@/components/telegram/SecurityBadge';
import { SecurityMessageCard } from '@/components/telegram/SecurityMessageCard';
import { CeloraLogo } from '@/components/ui/CeloraLogo';

export function TelegramDashboardClient() {
  const router = useRouter();
  const { telegramUser, userId, isAuthenticated, isLoading: authLoading, error: authError } = useTelegramAuth();
  const { summary, loading: summaryLoading, error: summaryError } = useTelegramWalletSummary({ 
    userId, 
    enabled: isAuthenticated 
  });
  
  useEffect(() => {
    hideBackButton(); // No back button on main page
  }, []);

  const error = authError || summaryError;
  
  const totalBalance = summary?.totalBalance ?? 0;
  const currency = summary?.currency ?? 'USD';
  const safeHoldings = Array.isArray(summary?.holdings) ? summary.holdings : [];

  if (authLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-400">
            {authLoading ? 'Authenticating...' : 'Loading your wallet...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Wallet</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 space-y-6">
      {/* Branding Header */}
      <div className="flex flex-col items-center pt-2 gap-2">
        <CeloraLogo size="lg" layout="stack" withText />
        <p className="text-sm text-gray-400">Your non-custodial Solana wallet</p>
      </div>

      {/* Security Badge */}
      <SecurityBadge />

      {/* Security Message */}
      <SecurityMessageCard />
      
      {/* Total Balance Card */}
      <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-6 shadow-xl border border-cyan-500/20">
        <p className="text-cyan-100 text-sm mb-2">Total Balance</p>
        <h2 className="text-4xl font-bold mb-4">
          {formatCurrency(totalBalance, currency)}
        </h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-cyan-100">{safeHoldings.length} wallets</span>
          <button 
            onClick={() => router.push('/telegram/wallet')}
            className="bg-white/20 px-4 py-1 rounded-full hover:bg-white/30 transition"
          >
            View Details →
          </button>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => router.push('/telegram/wallet/send')}
          className="bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 rounded-xl p-6 transition border border-slate-700 hover:border-cyan-500/50"
        >
          <div className="text-3xl mb-2">📤</div>
          <div className="font-semibold">Send</div>
          <div className="text-sm text-gray-400">Transfer crypto</div>
        </button>
        
        <button 
          onClick={() => router.push('/telegram/wallet/receive')}
          className="bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 rounded-xl p-6 transition border border-slate-700 hover:border-cyan-500/50"
        >
          <div className="text-3xl mb-2">📥</div>
          <div className="font-semibold">Receive</div>
          <div className="text-sm text-gray-400">Get QR code</div>
        </button>
        
        <button 
          onClick={() => router.push('/telegram/swap')}
          className="bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 rounded-xl p-6 transition border border-slate-700 hover:border-cyan-500/50"
        >
          <div className="text-3xl mb-2">🔄</div>
          <div className="font-semibold">Swap</div>
          <div className="text-sm text-gray-400">Exchange tokens</div>
        </button>
        
        <button 
          onClick={() => router.push('/telegram/cards')}
          className="bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 rounded-xl p-6 transition border border-slate-700 hover:border-cyan-500/50"
        >
          <div className="text-3xl mb-2">💳</div>
          <div className="font-semibold">Cards</div>
          <div className="text-sm text-gray-400">Virtual cards</div>
        </button>
      </div>
      
      {/* Recent Holdings */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="font-semibold mb-4 flex items-center justify-between">
          <span>Your Wallets</span>
          <span className="text-sm text-gray-400">{safeHoldings.length}</span>
        </h3>
        
        {safeHoldings.length > 0 ? (
          <div className="space-y-3">
            {safeHoldings.slice(0, 3).map((holding: any) => (
              <div 
                key={holding.id}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition cursor-pointer"
                onClick={() => router.push('/telegram/wallet')}
              >
                <div>
                  <div className="font-medium">{holding.label}</div>
                  <div className="text-sm text-gray-400">{holding.currency}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(holding.balance, holding.currency)}</div>
                </div>
              </div>
            ))}
            
            {safeHoldings.length > 3 && (
              <button 
                onClick={() => router.push('/telegram/wallet')}
                className="w-full text-center text-sm text-cyan-400 hover:text-cyan-300 py-2"
              >
                View all {safeHoldings.length} wallets →
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No wallets yet</p>
            <p className="text-sm mt-2">Create a wallet in the main Celora app</p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="text-center pb-4 text-sm text-gray-500">
        <p>Celora Telegram Mini App</p>
        <p className="text-xs mt-1">Secure crypto wallet in your pocket</p>
      </div>
    </div>
  );
}
