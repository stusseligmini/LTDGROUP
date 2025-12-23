'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { appFetch } from '@/lib/network/appFetch';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { Skeleton, SkeletonBalance, SkeletonTransaction } from '@/components/ui/Skeleton';
import { useAuthContext } from '@/providers/AuthProvider';
import { useTelegramAuth } from '@/hooks/useTelegramAuth';
import { useRouter } from 'next/navigation';
import { subscribeToBalance } from '@/lib/solana/solanaWallet';
import { BackupRecovery } from '@/components/wallet/BackupRecovery';

interface SolanaWallet {
  id: string;
  address: string;
  label: string | null;
  balance: number; // In SOL
  balanceUSD: number; // In USD
  isDefault: boolean;
}

interface Transaction {
  signature: string;
  timestamp: number;
  type: 'send' | 'receive' | 'casino_deposit' | 'casino_withdrawal' | 'win' | 'loss';
  label: string;
  amount: number;
  counterparty?: string;
  isCasinoTx: boolean;
  fee: number;
}

interface SolanaPrice {
  usd: number;
  lastUpdated: number;
}

export function SolanaWalletDashboard() {
  const router = useRouter();
  const firebaseAuth = useAuthContext();
  const telegramAuth = useTelegramAuth();
  
  // Use Telegram auth if available, otherwise Firebase
  const user = telegramAuth.isAuthenticated 
    ? { id: telegramAuth.userId!, email: null, username: null, displayName: null, phoneNumber: null, photoURL: null }
    : firebaseAuth.user;
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [balanceUSD, setBalanceUSD] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch SOL price in USD
  const fetchSolPrice = useCallback(async () => {
    try {
      // Try CoinGecko API (free tier, no API key needed)
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        const price = data.solana?.usd || 0;
        setSolPrice(price);
        return price;
      }
    } catch (err) {
      console.warn('Failed to fetch SOL price from CoinGecko', err);
    }

    // Fallback price (you can update this manually or use another API)
    setSolPrice(150); // Approximate SOL price fallback
    return 150;
  }, []);

  // Fetch user's Solana wallet
  const fetchWallet = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch user's Solana wallets from API
      const response = await appFetch('/api/wallet/list?blockchain=solana&limit=10', {
        headers: {
          'X-User-Id': user.id,
        },
      });

      if (!response.ok) {
        const errorMsg = response.status === 401 ? 'Not authenticated' : response.statusText || 'Failed to fetch wallets';
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      // Find Solana wallet from list (prefer default wallet)
      const wallets = data.data?.wallets || data.wallets || [];
      
      if (!Array.isArray(wallets) || wallets.length === 0) {
        setError('No Solana wallet found. Please create one first.');
        setLoading(false);
        return;
      }
      
      const solanaWallet = wallets.find((w: any) => w && w.isDefault && w.blockchain === 'solana') ||
                          wallets.find((w: any) => w && w.blockchain === 'solana');
      
      if (!solanaWallet) {
        setError('No Solana wallet found. Please create one first.');
        setLoading(false);
        return;
      }

      const wallet: SolanaWallet = {
        id: solanaWallet.id,
        address: solanaWallet.address,
        label: solanaWallet.label || 'My Solana Wallet',
        balance: 0, // Will be fetched next
        balanceUSD: 0,
        isDefault: solanaWallet.isDefault || false,
      };

      setWallet(wallet);
      
      // Fetch balance for this wallet
      await fetchBalance(wallet.address);
      
      // Fetch transaction history
      await fetchTransactions(wallet.address);
      
    } catch (err: any) {
      console.error('Failed to fetch wallet', err);
      // Treat auth failures as "no wallet found" to show creation flow
      const errMsg = err.message || 'Failed to load wallet';
      const isAuthError = errMsg.includes('Not authenticated') || errMsg.includes('401');
      const finalError = isAuthError ? 'No Solana wallet found. Please create one first.' : errMsg;
      setError(finalError);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch balance from API
  const fetchBalance = useCallback(async (address: string, retry = false) => {
    try {
      if (retry) {
        setLoadingBalance(true);
      }
      const response = await appFetch(`/api/solana/balance?address=${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      const solBalance = parseFloat(data.data.balanceSOL || 0);
      const usdBalance = solBalance * (solPrice || 150);

      setBalance(solBalance);
      setBalanceUSD(usdBalance);
      setError(null);
      setRetryCount(0);
      
      setWallet(prev => prev ? { ...prev, balance: solBalance, balanceUSD: usdBalance } : null);

      // Subscribe to real-time balance updates
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      unsubscribeRef.current = subscribeToBalance(address, (newBalance) => {
        const currentPrice = solPrice || 150;
        const newUsdBalance = newBalance * currentPrice;
        setBalance(newBalance);
        setBalanceUSD(newUsdBalance);
        setWallet(prev => prev ? { ...prev, balance: newBalance, balanceUSD: newUsdBalance } : null);
      });

    } catch (err: any) {
      console.error('Failed to fetch balance', err);
      if (retryCount < 3 && retry) {
        // Retry after delay
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchBalance(address, true);
        }, 1000 * (retryCount + 1));
      } else {
        setError(err.message || 'Failed to fetch balance. Click retry to try again.');
      }
    } finally {
      setLoadingBalance(false);
    }
  }, [solPrice]);

  // Fetch transaction history
  const fetchTransactions = useCallback(async (address: string, retry = false) => {
    try {
      if (retry) {
        setLoadingTransactions(true);
      }
      const response = await appFetch(`/api/solana/history?address=${address}&limit=5`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transaction history');
      }

      const data = await response.json();
      const txs = (data.data?.transactions || []).slice(0, 5);
      setTransactions(txs);

    } catch (err: any) {
      console.error('Failed to fetch transactions', err);
      // Don't set error for transaction history, just log it - it's not critical
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Retry loading wallet
  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setLoading(true);
    fetchWallet();
  }, [fetchWallet]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      
      // Fetch SOL price first
      const price = await fetchSolPrice();
      
      // Then fetch wallet and balance
      await fetchWallet();
      
      setLoading(false);
    };

    load();

    // Refresh SOL price every minute
    const priceInterval = setInterval(() => {
      fetchSolPrice();
    }, 60000);

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clearInterval(priceInterval);
    };
  }, [fetchSolPrice, fetchWallet]);

  // Refresh balance when SOL price changes
  useEffect(() => {
    if (balance > 0) {
      setBalanceUSD(balance * solPrice);
      setWallet(prev => prev ? { ...prev, balanceUSD: balance * solPrice } : null);
    }
  }, [solPrice, balance]);

  // Format balance
  const formatBalance = (bal: number) => {
    if (bal === 0) return '0.00';
    if (bal < 0.01) return bal.toFixed(6);
    if (bal < 1) return bal.toFixed(4);
    return bal.toFixed(2);
  };

  // Format USD
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Quick actions
  const handleSend = () => {
    router.push('/wallet/send-solana');
  };

  const handleReceive = () => {
    // Show QR code or address
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      alert('Address copied to clipboard!');
    }
  };

  const handleBuy = () => {
    router.push('/wallet/buy-solana');
  };

  const handleCasino = () => {
    router.push('/wallet/casino-deposit');
  };

  const handleViewHistory = () => {
    if (wallet) {
      router.push(`/wallet/history?address=${wallet.address}`);
    } else {
      router.push('/wallet/history');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 md:p-8">
            <SkeletonBalance />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton height={24} width="60%" />
            <Skeleton height={16} width="40%" className="mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonTransaction key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !wallet) {
    return (
      <div className="max-w-4xl mx-auto">
        <ErrorDisplay
          error={error}
          title={error.includes('No Solana wallet') ? 'No Wallet Found' : 'Failed to Load Wallet'}
          onRetry={error.includes('No Solana wallet') ? undefined : handleRetry}
          retryLabel="Retry"
        />
        {error.includes('No Solana wallet') && (
          <div className="mt-4 text-center">
            <Button
              onClick={() => router.push('/wallet/create-solana')}
              className="touch-target"
            >
              Create Solana Wallet
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!wallet) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-gray-600 mb-4">No Solana wallet found.</p>
          <Button onClick={() => router.push('/wallet/create-solana')}>
            Create Solana Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0">
      {/* Error Banner (if error but wallet exists) */}
      {error && wallet && (
        <ErrorDisplay
          error={error}
          variant="inline"
          onRetry={() => {
            if (wallet) {
              fetchBalance(wallet.address, true);
              fetchTransactions(wallet.address, true);
            }
          }}
          retryLabel="Retry"
        />
      )}

      {/* Balance Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <CardTitle className="text-lg md:text-xl">{wallet.label}</CardTitle>
          <CardDescription className="text-xs md:text-sm break-all md:break-normal">
            {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              {loadingBalance ? (
                <div className="py-4">
                  <LoadingSpinner size="md" message="Loading balance..." />
                </div>
              ) : (
                <>
                  <p className="text-3xl md:text-4xl font-bold text-gray-900">
                    {formatBalance(balance)} SOL
                  </p>
                  <p className="text-lg md:text-xl text-gray-600 mt-2">
                    ≈ {formatUSD(balanceUSD)}
                  </p>
                  {solPrice > 0 && (
                    <p className="text-xs md:text-sm text-gray-500 mt-1">
                      1 SOL = {formatUSD(solPrice)}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-6">
              <Button
                variant="outline"
                onClick={handleSend}
                className="flex flex-col items-center justify-center h-20 md:h-20 min-h-[80px] touch-target"
              >
                <span className="text-xl md:text-2xl mb-1">↑</span>
                <span className="text-xs md:text-sm font-medium">Send</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleReceive}
                className="flex flex-col items-center justify-center h-20 md:h-20 min-h-[80px] touch-target"
              >
                <span className="text-xl md:text-2xl mb-1">↓</span>
                <span className="text-xs md:text-sm font-medium">Receive</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleBuy}
                className="flex flex-col items-center justify-center h-20 md:h-20 min-h-[80px] touch-target"
              >
                <span className="text-xl md:text-2xl mb-1">💳</span>
                <span className="text-xs md:text-sm font-medium">Buy</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleCasino}
                className="flex flex-col items-center justify-center h-20 md:h-20 min-h-[80px] touch-target bg-purple-50 hover:bg-purple-100"
              >
                <span className="text-xl md:text-2xl mb-1">🎰</span>
                <span className="text-xs md:text-sm font-medium">Casino</span>
              </Button>
            </div>

            {/* Username Link */}
            <div className="flex items-center justify-center mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/wallet/username')}
                className="text-xs md:text-sm text-gray-600 hover:text-gray-900 touch-target"
              >
                {user?.username ? (
                  <>
                    <span className="mr-1 md:mr-2">@</span>
                    <span className="hidden sm:inline">{user.username}.sol</span>
                    <span className="sm:hidden">{user.username}</span>
                    <span className="ml-1 md:ml-2 text-xs">→</span>
                  </>
                ) : (
                  <>
                    <span className="mr-1 md:mr-2">@</span>
                    <span className="hidden sm:inline">Register Username</span>
                    <span className="sm:hidden">Username</span>
                    <span className="ml-1 md:ml-2 text-xs">→</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 5 transactions</CardDescription>
            </div>
            {transactions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewHistory}
              >
                View All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonTransaction key={i} />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <p className="text-sm md:text-base text-gray-500">No transactions yet</p>
              <Button
                variant="outline"
                onClick={handleBuy}
                className="mt-4 touch-target"
              >
                Buy SOL to get started
              </Button>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.signature}
                  className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200 cursor-pointer touch-target"
                  onClick={() => {
                    window.open(`https://solscan.io/tx/${tx.signature}`, '_blank');
                  }}
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.type === 'receive' || tx.type === 'win'
                          ? 'bg-green-100 text-green-600'
                          : tx.type === 'casino_deposit' || tx.type === 'loss'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span className="text-sm md:text-base">{tx.type === 'receive' || tx.type === 'win' ? '↑' : '↓'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs md:text-sm truncate">{tx.label}</p>
                      <p className="text-xs text-gray-500">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p
                      className={`font-semibold text-xs md:text-sm ${
                        tx.type === 'receive' || tx.type === 'win'
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {tx.type === 'receive' || tx.type === 'win' ? '+' : '-'}
                      {formatBalance(Math.abs(tx.amount))} SOL
                    </p>
                    {tx.isCasinoTx && (
                      <span className="text-xs text-purple-600 font-medium">🎰</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup & Recovery */}
      <BackupRecovery
        walletId={wallet.id}
        walletName={wallet.label || 'My Solana Wallet'}
        className="bg-white"
      />
    </div>
  );
}

