'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { appFetch } from '@/lib/network/appFetch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthContext } from '@/providers/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { getHeliusTransactionHistory, parseGamblingTransaction, type HeliusTransaction } from '@/lib/solana/heliusApi';
import { TransactionHistoryItem } from '@/components/solana/TransactionHistoryItem';

type FilterType = 'all' | 'deposits' | 'withdrawals' | 'wins' | 'casino';

export function TransactionHistory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<HeliusTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<HeliusTransaction[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [beforeSignature, setBeforeSignature] = useState<string | undefined>(undefined);

  // Get wallet address from URL or fetch from API
  useEffect(() => {
    const address = searchParams?.get('address') || undefined;
    if (address) {
      setWalletAddress(address);
    } else {
      // Fetch user's Solana wallet address
      fetchWalletAddress();
    }
  }, [searchParams]);

  // Fetch wallet address
  const fetchWalletAddress = useCallback(async () => {
    if (!user) {
      setError('Please sign in to view transaction history');
      setLoading(false);
      return;
    }

    try {
      const response = await appFetch('/api/wallet/list?blockchain=solana&limit=1', {
        headers: {
          'X-User-Id': user.id,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet');
      }

      const data = await response.json();
      const wallets = data.data?.wallets || data.wallets || [];
      
      if (!Array.isArray(wallets) || wallets.length === 0) {
        setError('Please sign in to view transaction history');
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

      setWalletAddress(solanaWallet.address);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch wallet');
      setLoading(false);
    }
  }, [user]);

  // Fetch transactions
  const fetchTransactions = useCallback(async (before?: string, append: boolean = false) => {
    if (!walletAddress) return;

    try {
      setLoadingMore(true);
      const txs = await getHeliusTransactionHistory({ address: walletAddress, before, limit: 50, commitment: 'confirmed' });

      if (append) {
        setTransactions(prev => [...prev, ...txs]);
      } else {
        setTransactions(txs);
      }

      // Check if there are more transactions
      setHasMore(txs.length === 50);
      if (txs.length > 0) {
        setBeforeSignature(txs[txs.length - 1].signature);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transaction history');
      console.error('Error fetching transactions', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [walletAddress]);

  // Initial fetch
  useEffect(() => {
    if (walletAddress) {
      setLoading(true);
      fetchTransactions();
    }
  }, [walletAddress, fetchTransactions]);

  // Filter transactions
  useEffect(() => {
    let filtered = [...transactions];

    switch (filter) {
      case 'deposits':
        filtered = transactions.filter(tx => {
          const parsed = parseGamblingTransaction(tx, walletAddress!);
          return parsed.type === 'deposit' || (parsed.type === 'withdrawal' && parsed.isCasinoTx);
        });
        break;
      case 'withdrawals':
        filtered = transactions.filter(tx => {
          const parsed = parseGamblingTransaction(tx, walletAddress!);
          return parsed.type === 'withdrawal' && !parsed.isCasinoTx;
        });
        break;
      case 'wins':
        filtered = transactions.filter(tx => parseGamblingTransaction(tx, walletAddress!).type === 'win');
        break;
      case 'casino':
        filtered = transactions.filter(tx => parseGamblingTransaction(tx, walletAddress!).isCasinoTx);
        break;
      case 'all':
      default:
        filtered = transactions;
        break;
    }

    setFilteredTransactions(filtered);
  }, [transactions, filter]);

  // Format balance
  const formatBalance = (amount: number) => {
    if (amount === 0) return '0.00';
    if (amount < 0.01) return amount.toFixed(6);
    if (amount < 1) return amount.toFixed(4);
    return amount.toFixed(2);
  };

  // Format date
  const formatDate = (timestamp: number) => {
    // Helius returns seconds; convert to ms
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Format full date/time
  const formatFullDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get transaction icon
  // Legacy icon/color helpers removed in favor of TransactionHistoryItem

  // Load more transactions
  const handleLoadMore = () => {
    if (hasMore && beforeSignature && !loadingMore) {
      fetchTransactions(beforeSignature, true);
    }
  };

  // Open transaction in Solscan
  const openInSolscan = (signature: string) => {
    window.open(`https://solscan.io/tx/${signature}`, '_blank');
  };

  // Copy address to clipboard
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    // Could show toast notification here
  };

  if (loading) {
    return (
      <Card className="max-w-6xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transaction history...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-6xl mx-auto">
        <CardContent className="p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            {error.includes('No Solana wallet') && (
              <Button
                onClick={() => router.push('/wallet/create-solana')}
                className="mt-4"
              >
                Create Solana Wallet
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!walletAddress) {
    return (
      <Card className="max-w-6xl mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-gray-600 mb-4">No wallet address found.</p>
          <Button onClick={() => router.push('/wallet')}>
            Go to Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="p-4">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="deposits">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="wins">Wins</TabsTrigger>
              <TabsTrigger value="casino">Casino</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Transactions List (Helius enriched) */}
      <Card>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg mb-2">No transactions found</p>
              <p className="text-gray-400 text-sm">
                {filter === 'all' 
                  ? 'Start using your wallet to see transactions here'
                  : `No ${filter} transactions found`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {filteredTransactions.map((tx) => {
                const parsed = parseGamblingTransaction(tx, walletAddress!);
                return (
                  <div key={tx.signature} className="p-4">
                    <TransactionHistoryItem tx={tx} userAddress={walletAddress!} parsed={parsed} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && filteredTransactions.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

