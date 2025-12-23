'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/apiClient';

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'card_payment' | 'casino_deposit' | 'casino_win' | 'swap' | 'stake' | 'unstake';
  blockchain: 'solana' | 'ethereum' | 'bitcoin';
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  merchant?: string;
  cardId?: string;
  casino?: string;
  winLoss?: 'win' | 'loss';
  fee?: number;
  description?: string;
}

type FilterType = 'all' | 'send' | 'receive' | 'card_payment' | 'casino_deposit' | 'casino_win' | 'swap' | 'stake';
type BlockchainFilter = 'all' | 'solana' | 'ethereum' | 'bitcoin';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'failed';

function TransactionsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [blockchainFilter, setBlockchainFilter] = useState<BlockchainFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected transaction for modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/splash');
    }
  }, [user, authLoading, router]);

  const fetchTransactions = useCallback(async (reset: boolean = false) => {
    try {
      setIsLoading(true);
      const currentPage = reset ? 1 : page;

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });

      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (blockchainFilter !== 'all') params.append('blockchain', blockchainFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (minAmount) params.append('minAmount', minAmount);
      if (maxAmount) params.append('maxAmount', maxAmount);
      if (searchQuery) params.append('search', searchQuery);

      const cardId = searchParams?.get('card');
      if (cardId) params.append('cardId', cardId);

      const data = await api.get<{ transactions: Transaction[]; hasMore: boolean }>(
        `/wallet/transactions?${params.toString()}`
      );
      if (reset) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions((prev) => [...prev, ...(data.transactions || [])]);
      }
      setHasMore(data.hasMore || false);
      setPage(currentPage + 1);
    } catch (_err) {
      console.error('Error fetching transactions:', _err);
    } finally {
      setIsLoading(false);
    }
  }, [page, typeFilter, blockchainFilter, statusFilter, dateFrom, dateTo, minAmount, maxAmount, searchQuery, user]);

  useEffect(() => {
    if (user) {
      fetchTransactions(true);
    }
  }, [user, typeFilter, blockchainFilter, statusFilter, dateFrom, dateTo, minAmount, maxAmount, searchQuery, fetchTransactions]);

  useEffect(() => {
    // Check for card filter from URL params
    const cardId = searchParams?.get('card');
    if (cardId) {
      setTypeFilter('card_payment');
    }
  }, [searchParams]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchTransactions(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Blockchain', 'Amount', 'Currency', 'Status', 'From', 'To', 'Tx Hash'];
    const rows = transactions.map((tx) => [
      new Date(tx.timestamp).toLocaleString(),
      tx.type,
      tx.blockchain,
      tx.amount,
      tx.currency,
      tx.status,
      tx.fromAddress || '-',
      tx.toAddress || '-',
      tx.txHash || '-',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celora-transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'send':
        return '📤';
      case 'receive':
        return '📥';
      case 'card_payment':
        return '💳';
      case 'casino_deposit':
        return '🎰';
      case 'casino_win':
        return '🎉';
      case 'swap':
        return '🔄';
      case 'stake':
        return '🔒';
      case 'unstake':
        return '🔓';
      default:
        return '💰';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-cyan-primary bg-cyan-primary/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'failed':
        return 'text-red-400 bg-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getBlockchainExplorerUrl = (blockchain: string, txHash: string) => {
    switch (blockchain) {
      case 'solana':
        return `https://solscan.io/tx/${txHash}`;
      case 'ethereum':
        return `https://etherscan.io/tx/${txHash}`;
      case 'bitcoin':
        return `https://blockchair.com/bitcoin/transaction/${txHash}`;
      default:
        return '#';
    }
  };

  if (authLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading...</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold heading-gradient mb-2">Transaction History</h1>
            <p className="text-gray-400">Track all your wallet and card activity</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={transactions.length === 0}
            className="btn-outline ring-glow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="glass-panel border-gradient p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Filters</h2>
            <button
              onClick={() => {
                setTypeFilter('all');
                setBlockchainFilter('all');
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
                setMinAmount('');
                setMaxAmount('');
                setSearchQuery('');
              }}
              className="text-sm text-cyan-primary hover:text-white transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Type filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FilterType)}
                className="neon-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="send">Send</option>
                <option value="receive">Receive</option>
                <option value="card_payment">Card Payment</option>
                <option value="casino_deposit">Casino Deposit</option>
                <option value="casino_win">Casino Win</option>
                <option value="swap">Swap</option>
                <option value="stake">Stake</option>
              </select>
            </div>

            {/* Blockchain filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Blockchain</label>
              <select
                value={blockchainFilter}
                onChange={(e) => setBlockchainFilter(e.target.value as BlockchainFilter)}
                className="neon-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All Chains</option>
                <option value="solana">Solana</option>
                <option value="ethereum">Ethereum</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="neon-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Merchant, address..."
                className="neon-input w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Date from */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="neon-input w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="neon-input w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Min amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0.00"
                className="neon-input w-full px-3 py-2 text-sm"
                step="0.01"
                min="0"
              />
            </div>

            {/* Max amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Amount</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="0.00"
                className="neon-input w-full px-3 py-2 text-sm"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Transactions list */}
        <div className="glass-panel border-gradient p-6">
          {isLoading && transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="cel-loading">
                <div className="cel-loading__spinner"></div>
                <span className="cel-loading__label">Loading transactions...</span>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg mb-2">No transactions found</p>
              <p className="text-sm">Try adjusting your filters or make your first transaction</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTransaction(tx)}
                  className="w-full p-4 rounded-lg bg-dark-surface hover:bg-gray-700 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-3xl mt-1">{getTypeIcon(tx.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{getTypeLabel(tx.type)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(tx.status)}`}>
                            {tx.status}
                          </span>
                          {tx.winLoss && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              tx.winLoss === 'win' ? 'text-green-400 bg-green-400/20' : 'text-red-400 bg-red-400/20'
                            }`}>
                              {tx.winLoss === 'win' ? '🎉 Win' : '📉 Loss'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                          <span className="capitalize">{tx.blockchain}</span>
                          {tx.merchant && (
                            <>
                              <span>•</span>
                              <span>{tx.merchant}</span>
                            </>
                          )}
                          {tx.casino && (
                            <>
                              <span>•</span>
                              <span>{tx.casino}</span>
                            </>
                          )}
                        </div>
                        {tx.description && (
                          <div className="text-xs text-gray-500">{tx.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xl font-bold ${
                        tx.type === 'receive' || tx.type === 'casino_win' ? 'text-green-400' : 'text-white'
                      }`}>
                        {tx.type === 'receive' || tx.type === 'casino_win' ? '+' : '-'}
                        {tx.amount.toFixed(4)} {tx.currency}
                      </div>
                      {tx.fee && tx.fee > 0 && (
                        <div className="text-xs text-gray-400 mt-1">Fee: {tx.fee.toFixed(6)}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full py-3 rounded-lg border border-gray-600 hover:border-cyan-primary bg-dark-surface hover:bg-cyan-primary/10 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transaction details modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="glass-panel border-gradient p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Transaction Details</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(selectedTransaction.status)}`}>
                  {selectedTransaction.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-3 border-b border-gray-700">
                <span className="text-gray-400">Type</span>
                <span className="text-white font-medium">{getTypeLabel(selectedTransaction.type)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-700">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-bold text-lg">
                  {selectedTransaction.amount.toFixed(4)} {selectedTransaction.currency}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-700">
                <span className="text-gray-400">Blockchain</span>
                <span className="text-white font-medium capitalize">{selectedTransaction.blockchain}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-700">
                <span className="text-gray-400">Date</span>
                <span className="text-white font-medium">
                  {new Date(selectedTransaction.timestamp).toLocaleString()}
                </span>
              </div>
              {selectedTransaction.fromAddress && (
                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">From</span>
                  <span className="text-white font-mono text-xs">
                    {selectedTransaction.fromAddress.slice(0, 10)}...{selectedTransaction.fromAddress.slice(-8)}
                  </span>
                </div>
              )}
              {selectedTransaction.toAddress && (
                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">To</span>
                  <span className="text-white font-mono text-xs">
                    {selectedTransaction.toAddress.slice(0, 10)}...{selectedTransaction.toAddress.slice(-8)}
                  </span>
                </div>
              )}
              {selectedTransaction.fee && selectedTransaction.fee > 0 && (
                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="text-white font-medium">{selectedTransaction.fee.toFixed(6)}</span>
                </div>
              )}
              {selectedTransaction.merchant && (
                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">Merchant</span>
                  <span className="text-white font-medium">{selectedTransaction.merchant}</span>
                </div>
              )}
              {selectedTransaction.casino && (
                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">Casino</span>
                  <span className="text-white font-medium">{selectedTransaction.casino}</span>
                </div>
              )}
              {selectedTransaction.txHash && (
                <div className="py-3">
                  <div className="text-gray-400 mb-2">Transaction Hash</div>
                  <div className="text-white font-mono text-xs break-all bg-dark-surface p-3 rounded-lg">
                    {selectedTransaction.txHash}
                  </div>
                  <a
                    href={getBlockchainExplorerUrl(selectedTransaction.blockchain, selectedTransaction.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-primary hover:text-white text-sm mt-2 inline-block"
                  >
                    View on Explorer →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<DashboardShell><div className="p-8 text-slate-300">Loading transactions…</div></DashboardShell>}>
      <TransactionsPageInner />
    </Suspense>
  );
}
