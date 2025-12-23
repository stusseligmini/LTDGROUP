'use client';

import React, { useState, useEffect } from 'react';
import { appFetch } from '@/lib/network/appFetch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface SwapTransaction {
  id: string;
  txHash: string;
  blockchain: string;
  amount: string;
  amountUsd: number | null;
  tokenSymbol: string | null;
  gasFee: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  memo: string | null;
}

interface SwapHistoryProps {
  walletId: string;
  className?: string;
}

const BLOCKCHAIN_EXPLORERS: Record<string, (hash: string) => string> = {
  solana: (hash) => `https://solscan.io/tx/${hash}?cluster=mainnet`,
  ethereum: (hash) => `https://etherscan.io/tx/${hash}`,
  polygon: (hash) => `https://polygonscan.com/tx/${hash}`,
  arbitrum: (hash) => `https://arbiscan.io/tx/${hash}`,
};

export function SwapHistory({
  walletId,
  className,
}: SwapHistoryProps) {
  const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await appFetch(`/api/swap/history?walletId=${walletId}&limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setTransactions(data.data?.transactions || []);
      setPagination(data.data?.pagination || {});
    } catch (e: any) {
      setError(e.message || 'Failed to fetch swap history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [walletId, offset]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getExplorerUrl = (blockchain: string, txHash: string): string | null => {
    const explorer = BLOCKCHAIN_EXPLORERS[blockchain.toLowerCase()];
    return explorer ? explorer(txHash) : null;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Swap History</CardTitle>
        <CardDescription>Your recent token swaps</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>
        )}

        {loading && transactions.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            No swaps yet. Start swapping to see your history.
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const explorerUrl = getExplorerUrl(tx.blockchain, tx.txHash);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded border hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div>{getStatusIcon(tx.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {tx.amount} {tx.tokenSymbol || 'tokens'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {tx.amountUsd && (
                      <div className="text-right text-sm">
                        <div className="font-medium">${tx.amountUsd.toFixed(2)}</div>
                      </div>
                    )}
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between pt-4 border-t text-sm">
            <div className="text-gray-600">
              {offset + 1}-{Math.min(offset + limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={!pagination.hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
