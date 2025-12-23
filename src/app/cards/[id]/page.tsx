'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/apiClient';

interface Card {
  id: string;
  cardNumber: string;
  brand: 'VISA' | 'MASTERCARD';
  status: 'ACTIVE' | 'FROZEN' | 'CANCELLED';
  expiryDate: string;
  cvv: string;
  dailyLimit: number;
  monthlyLimit: number;
  totalLimit: number;
  dailySpent: number;
  monthlySpent: number;
  totalSpent: number;
  cashbackRate: number;
  createdAt: string;
  linkedWalletAddress?: string;
}

interface Transaction {
  id: string;
  cardId: string;
  merchantName: string;
  merchantCity?: string;
  merchantCountry: string;
  mcc: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'declined' | 'reversed';
  transactionDate: string | Date;
  settledDate?: string | Date;
  declineReason?: string;
}

interface SpendingByCategory {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export default function CardDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = params?.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const [card, setCard] = useState<Card | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spendingByCategory, setSpendingByCategory] = useState<SpendingByCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullNumber, setShowFullNumber] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [provisioning, setProvisioning] = useState<'apple' | 'google' | null>(null);
  const [provisioningResult, setProvisioningResult] = useState<{
    token?: string;
    activationData?: string;
    tokenReferenceId?: string;
  } | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [user, authLoading, router]);

  const fetchCardDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<{ card: Card; spendingByCategory?: SpendingByCategory[] }>(
        `/cards/${cardId}`
      );
      setCard(data.card);
      
      // Calculate spending by category
      if (data.spendingByCategory) {
        setSpendingByCategory(data.spendingByCategory);
      }
    } catch (err: any) {
      console.error('Error fetching card:', err);
      setError(err.message || 'Failed to load card details');
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.get<{ transactions: Transaction[] }>(
        `/cards/${cardId}/transactions?limit=20`
      );
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [cardId]);

  useEffect(() => {
    if (user && cardId) {
      fetchCardDetails();
      fetchTransactions();
    }
  }, [user, cardId, fetchCardDetails, fetchTransactions]);

  const handleFreezeToggle = async () => {
    if (!card) return;

    try {
      setActionLoading(true);
      const newStatus = card.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';

      await api.patch(`/cards/${cardId}/status`, { status: newStatus });

      setCard({ ...card, status: newStatus });
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(err.message || 'Failed to update card status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProvision = async (walletType: 'apple' | 'google') => {
    if (!card) return;
    setProvisioning(walletType);
    setProvisioningError(null);
    setProvisioningResult(null);

    try {
      const data = await api.post<{
        success: boolean;
        data?: { token?: string; activationData?: string; tokenReferenceId?: string };
        error?: { message?: string };
      }>(`/cards/${cardId}/provision`, { walletType });

      if ((data as any)?.success === false) {
        const message = (data as any)?.error?.message || 'Provisioning failed';
        setProvisioningError(message);
        return;
      }

      setProvisioningResult((data as any)?.data || null);
    } catch (err: any) {
      setProvisioningError(err?.message || 'Failed to provision wallet token');
    } finally {
      setProvisioning(null);
    }
  };

  const handleCancelCard = async () => {
    if (!card) return;

    const confirmed = confirm(
      'Are you sure you want to cancel this card? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);

      await api.delete(`/cards/${cardId}`);

      alert('Card cancelled successfully');
      router.push('/cards');
    } catch (err: any) {
      console.error('Error cancelling card:', err);
      alert(err.message || 'Failed to cancel card');
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-cyan-primary bg-cyan-primary/20';
      case 'FROZEN':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'CANCELLED':
        return 'text-red-400 bg-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-cyan-primary';
      case 'pending':
        return 'text-yellow-400';
      case 'declined':
      case 'reversed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getMccCategory = (mcc: string): string => {
    const categories: Record<string, string> = {
      '5999': 'Shopping',
      '4121': 'Transportation',
      '5814': 'Food & Drink',
      '5541': 'Gas',
      '7841': 'Entertainment',
      '5411': 'Groceries',
      '5732': 'Electronics',
      '5812': 'Restaurants',
    };
    return categories[mcc] || 'Other';
  };

  const formatCardNumber = (number: string, reveal: boolean) => {
    if (reveal) {
      return number.match(/.{1,4}/g)?.join(' ') || number;
    }
    const last4 = number.slice(-4);
    return `•••• •••• •••• ${last4}`;
  };

  const calculateSpendingPercentage = (spent: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((spent / limit) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-400';
    return 'bg-cyan-primary';
  };

  if (authLoading || isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading card details...</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !card) {
    return (
      <DashboardShell>
        <div className="max-w-4xl mx-auto">
          <div className="cel-error">
            <p>{error || 'Card not found'}</p>
          </div>
          <button
            onClick={() => router.push('/cards')}
            className="btn-outline mt-4"
          >
            ← Back to Cards
          </button>
        </div>
      </DashboardShell>
    );
  }

  const dailyPercentage = calculateSpendingPercentage(card.dailySpent, card.dailyLimit);
  const monthlyPercentage = calculateSpendingPercentage(card.monthlySpent, card.monthlyLimit);
  const totalPercentage = calculateSpendingPercentage(card.totalSpent, card.totalLimit);

  return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/cards')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Cards
          </button>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(card.status)}`}>
              {card.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Card display & actions */}
          <div className="space-y-6">
            {/* Virtual card display */}
            <div className="modern-card p-8">
              <div
                className={`rounded-2xl p-6 text-white relative overflow-hidden ${
                  card.brand === 'VISA'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-800'
                    : 'bg-gradient-to-br from-orange-600 to-orange-800'
                }`}
                style={{ aspectRatio: '1.586/1' }}
              >
                {/* Card background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
                </div>

                <div className="relative z-10 h-full flex flex-col justify-between">
                  {/* Top row - Chip & Brand */}
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-10 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-lg"></div>
                    <div className="text-2xl font-bold tracking-wider">
                      {card.brand}
                    </div>
                  </div>

                  {/* Card number */}
                  <div>
                    <div className="text-2xl font-mono tracking-wider mb-4">
                      {formatCardNumber(card.cardNumber, showFullNumber)}
                    </div>
                    <button
                      onClick={() => setShowFullNumber(!showFullNumber)}
                      className="text-sm text-white/80 hover:text-white underline"
                    >
                      {showFullNumber ? 'Hide' : 'Reveal'} Full Number
                    </button>
                  </div>

                  {/* Bottom row - Expiry & CVV */}
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-white/60 mb-1">VALID THRU</div>
                      <div className="text-lg font-mono">{card.expiryDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60 mb-1">CVV</div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-mono">
                          {showCVV ? card.cvv : '•••'}
                        </div>
                        <button
                          onClick={() => setShowCVV(!showCVV)}
                          className="text-white/80 hover:text-white"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showCVV ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked wallet */}
              {card.linkedWalletAddress && (
                <div className="mt-4 p-3 rounded-lg bg-dark-surface">
                  <div className="text-xs text-gray-400 mb-1">Linked Wallet</div>
                  <div className="text-sm font-mono text-cyan-primary">
                    {card.linkedWalletAddress.slice(0, 8)}...{card.linkedWalletAddress.slice(-6)}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="modern-card p-6 space-y-3">
              <h3 className="text-lg font-bold text-white mb-4">Card Actions</h3>

              <button
                onClick={handleFreezeToggle}
                disabled={actionLoading || card.status === 'CANCELLED'}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  card.status === 'ACTIVE'
                    ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 border border-yellow-400/50'
                    : 'bg-cyan-primary/20 text-cyan-primary hover:bg-cyan-primary/30 border border-cyan-primary/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {actionLoading ? 'Processing...' : card.status === 'ACTIVE' ? '❄️ Freeze Card' : '🔓 Unfreeze Card'}
              </button>

              <button
                onClick={() => router.push(`/cards/${cardId}/limits`)}
                disabled={card.status === 'CANCELLED'}
                className="w-full py-3 rounded-lg font-semibold transition-all bg-dark-surface text-white hover:bg-gray-700 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚙️ Adjust Limits
              </button>

              <button
                onClick={handleCancelCard}
                disabled={actionLoading || card.status === 'CANCELLED'}
                className="w-full py-3 rounded-lg font-semibold transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Cancelling...' : '🗑️ Cancel Card'}
              </button>

              <div className="pt-2 border-t border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Wallet provisioning</span>
                  {provisioning && (
                    <span className="text-xs text-cyan-primary">{provisioning === 'apple' ? 'Apple' : 'Google'}...</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleProvision('apple')}
                    disabled={!!provisioning || card.status !== 'ACTIVE'}
                    className="py-2 rounded-lg font-semibold transition-all bg-dark-surface text-white hover:bg-gray-700 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apple Wallet
                  </button>
                  <button
                    onClick={() => handleProvision('google')}
                    disabled={!!provisioning || card.status !== 'ACTIVE'}
                    className="py-2 rounded-lg font-semibold transition-all bg-dark-surface text-white hover:bg-gray-700 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Google Pay
                  </button>
                </div>
                {provisioningError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                    {provisioningError}
                  </div>
                )}
                {provisioningResult && (
                  <div className="text-xs text-cyan-primary bg-cyan-primary/10 border border-cyan-primary/30 rounded p-2 space-y-1">
                    <div className="font-semibold">Provisioned</div>
                    {provisioningResult.tokenReferenceId && <div>Token ID: {provisioningResult.tokenReferenceId}</div>}
                    {provisioningResult.token && <div>Token: {provisioningResult.token}</div>}
                    {provisioningResult.activationData && <div>Activation: {provisioningResult.activationData}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Card info */}
            <div className="modern-card p-6 space-y-3">
              <h3 className="text-lg font-bold text-white mb-4">Card Information</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Created</span>
                  <span className="text-white font-medium">
                    {new Date(card.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cashback Rate</span>
                  <span className="text-cyan-primary font-bold">{card.cashbackRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Card ID</span>
                  <span className="text-white font-mono text-xs">{card.id.slice(0, 8)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Spending & Transactions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Spending limits */}
            <div className="modern-card p-6 space-y-6">
              <h2 className="text-2xl font-bold text-white">Spending Overview</h2>

              {/* Daily */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Daily Limit</span>
                  <span className="text-sm font-bold text-white">
                    ${card.dailySpent.toFixed(2)} / ${card.dailyLimit.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 bg-dark-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressColor(dailyPercentage)}`}
                    style={{ width: `${dailyPercentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ${(card.dailyLimit - card.dailySpent).toFixed(2)} remaining
                </div>
              </div>

              {/* Monthly */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Monthly Limit</span>
                  <span className="text-sm font-bold text-white">
                    ${card.monthlySpent.toFixed(2)} / ${card.monthlyLimit.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 bg-dark-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressColor(monthlyPercentage)}`}
                    style={{ width: `${monthlyPercentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ${(card.monthlyLimit - card.monthlySpent).toFixed(2)} remaining
                </div>
              </div>

              {/* Total */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Total Limit</span>
                  <span className="text-sm font-bold text-white">
                    ${card.totalSpent.toFixed(2)} / ${card.totalLimit.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 bg-dark-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressColor(totalPercentage)}`}
                    style={{ width: `${totalPercentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ${(card.totalLimit - card.totalSpent).toFixed(2)} remaining
                </div>
              </div>
            </div>

            {/* Spending by category */}
            {spendingByCategory.length > 0 && (
              <div className="modern-card p-6">
                <h3 className="text-xl font-bold text-white mb-4">Spending by Category</h3>
                <div className="space-y-3">
                  {spendingByCategory.map((item) => (
                    <div key={item.category}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">{item.category}</span>
                        <span className="text-sm font-bold text-white">
                          ${item.amount.toFixed(2)} ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-dark-surface rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent transactions */}
            <div className="modern-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
                <button
                  onClick={() => router.push(`/wallet/transactions?card=${cardId}`)}
                  className="text-sm text-cyan-primary hover:text-white transition-colors"
                >
                  View All →
                </button>
              </div>

              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const category = getMccCategory(tx.mcc);
                    const location = tx.merchantCity
                      ? `${tx.merchantCity}, ${tx.merchantCountry}`
                      : tx.merchantCountry;
                    const transactionDate = typeof tx.transactionDate === 'string' 
                      ? new Date(tx.transactionDate) 
                      : tx.transactionDate;
                    const cashback = tx.status === 'approved' ? tx.amount * 0.02 : 0;

                    return (
                      <div
                        key={tx.id}
                        className="p-4 rounded-lg bg-dark-surface hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-white mb-1">{tx.merchantName}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <span>{category}</span>
                              {location && (
                                <>
                                  <span>•</span>
                                  <span>{location}</span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {transactionDate.toLocaleString()}
                            </div>
                            {tx.declineReason && (
                              <div className="text-xs text-red-400 mt-1">
                                {tx.declineReason}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getTransactionStatusColor(tx.status)}`}>
                              -{tx.currency === 'USD' ? '$' : ''}{tx.amount.toFixed(2)}
                            </div>
                            {cashback > 0 && (
                              <div className="text-xs text-cyan-primary mt-1">
                                +${cashback.toFixed(2)} cashback
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1 capitalize">{tx.status}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>No transactions yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
