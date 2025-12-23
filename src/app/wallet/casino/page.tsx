'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';

interface CasinoPreset {
  id: string;
  name: string;
  logo: string;
  address: string;
  color: string;
}

interface Wallet {
  id: string;
  blockchain: string;
  address: string;
  balance: number;
  label?: string;
}

interface RecentDeposit {
  id: string;
  casino: string;
  amount: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

const CASINO_PRESETS: CasinoPreset[] = [
  {
    id: 'roobet',
    name: 'Roobet',
    logo: '🎰',
    address: 'RBT1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0',
    color: '#FF3B3B',
  },
  {
    id: 'stake',
    name: 'Stake',
    logo: '💎',
    address: 'STK9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1',
    color: '#00E701',
  },
  {
    id: 'rollbit',
    name: 'Rollbit',
    logo: '🎲',
    address: 'RLB5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3',
    color: '#7B61FF',
  },
  {
    id: 'shuffle',
    name: 'Shuffle',
    logo: '🃏',
    address: 'SHF3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1',
    color: '#FFB800',
  },
];

export default function CasinoDepositPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedCasino, setSelectedCasino] = useState<CasinoPreset | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [amountUSD, setAmountUSD] = useState<string>('');
  const [priorityFee, setPriorityFee] = useState<'normal' | 'fast' | 'instant'>('instant');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentDeposits, setRecentDeposits] = useState<RecentDeposit[]>([]);
  const [showCustomCasino, setShowCustomCasino] = useState(false);
  const [customAddress, setCustomAddress] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchWallets();
      fetchRecentDeposits();
    }
  }, [user]);

  const fetchWallets = async () => {
    try {
      const data = await api.get<{ wallets: Wallet[] }>('/wallet/list?blockchain=solana');
      const solanaWallets = (data.wallets || []).filter(
        (w: Wallet) => w.blockchain.toLowerCase() === 'solana'
      );
      setWallets(solanaWallets);
      if (solanaWallets.length > 0) {
        setSelectedWallet(solanaWallets[0].id);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
    }
  };

  const fetchRecentDeposits = async () => {
    try {
      const data = await api.get<{ transactions?: RecentDeposit[] }>('/solana/history?type=casino');
      setRecentDeposits(data.transactions?.slice(0, 5) || []);
    } catch (err) {
      console.error('Error fetching deposits:', err);
    }
  };

  const handleDeposit = async () => {
    if (!selectedWallet || !amount || (!selectedCasino && !customAddress)) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const targetAddress = showCustomCasino ? customAddress : selectedCasino?.address;

      const response = await fetch('/api/solana/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          walletId: selectedWallet,
          toAddress: targetAddress,
          amount: parseFloat(amount),
          priorityFee: priorityFee,
          memo: `Casino deposit to ${selectedCasino?.name || 'custom'}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send transaction');
      }

      const data = await response.json();
      
      // Success - redirect to transaction details or show success message
      setAmount('');
      setAmountUSD('');
      fetchRecentDeposits();
      
      alert(`Deposit sent successfully! Transaction: ${data.signature}`);
    } catch (err: any) {
      console.error('Error sending deposit:', err);
      setError(err.message || 'Failed to send deposit');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityFeeInfo = () => {
    switch (priorityFee) {
      case 'normal':
        return { label: 'Normal', fee: '~$0.0002', time: '~10s', color: 'text-gray-400' };
      case 'fast':
        return { label: 'Fast', fee: '~$0.001', time: '~5s', color: 'text-yellow-400' };
      case 'instant':
        return { label: 'Instant', fee: '~$0.005', time: '<2s', color: 'text-cyan-primary' };
    }
  };

  const feeInfo = getPriorityFeeInfo();

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

  if (authLoading || !user) {
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Casino Deposits</h1>
          <p className="text-gray-400">Lightning-fast SOL deposits to your favorite casinos</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main deposit form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Casino selection */}
            <div className="modern-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Select Casino</h2>
                <button
                  onClick={() => setShowCustomCasino(!showCustomCasino)}
                  className="text-sm text-cyan-primary hover:text-white transition-colors"
                >
                  {showCustomCasino ? '← Back to Presets' : 'Custom Address'}
                </button>
              </div>

              {!showCustomCasino ? (
                <div className="grid grid-cols-2 gap-4">
                  {CASINO_PRESETS.map((casino) => (
                    <button
                      key={casino.id}
                      onClick={() => setSelectedCasino(casino)}
                      className={`p-6 rounded-lg border-2 transition-all ${
                        selectedCasino?.id === casino.id
                          ? 'border-cyan-primary bg-cyan-primary/10'
                          : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-5xl mb-3">{casino.logo}</div>
                        <div className="text-lg font-bold text-white">{casino.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Casino Wallet Address
                  </label>
                  <input
                    type="text"
                    value={customAddress}
                    onChange={(e) => setCustomAddress(e.target.value)}
                    placeholder="Enter Solana address..."
                    className="neon-input w-full px-4 py-3 font-mono text-sm"
                  />
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="modern-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Deposit Amount</h2>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (SOL)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    // Mock conversion - in real app, fetch current SOL/USD rate
                    const usd = (parseFloat(e.target.value) * 100).toFixed(2);
                    setAmountUSD(usd);
                  }}
                  placeholder="0.00"
                  className="neon-input w-full px-4 py-3 text-2xl font-bold"
                  step="0.01"
                  min="0"
                />
                {amountUSD && (
                  <p className="text-sm text-gray-400 mt-2">≈ ${amountUSD} USD</p>
                )}
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {[0.1, 0.5, 1, 5].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setAmount(amt.toString());
                      setAmountUSD((amt * 100).toFixed(2));
                    }}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-600 hover:border-cyan-primary bg-dark-surface hover:bg-cyan-primary/10 text-white transition-all"
                  >
                    {amt} SOL
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet selection */}
            <div className="modern-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">From Wallet</h2>

              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setSelectedWallet(wallet.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedWallet === wallet.id
                        ? 'border-cyan-primary bg-cyan-primary/10'
                        : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white mb-1">
                          {wallet.label || 'Solana Wallet'}
                        </div>
                        <div className="text-sm text-gray-400 font-mono">
                          {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-cyan-primary">{wallet.balance.toFixed(4)} SOL</div>
                        <div className="text-sm text-gray-400">≈ ${(wallet.balance * 100).toFixed(2)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {wallets.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>No Solana wallets found.</p>
                  <button
                    onClick={() => router.push('/wallet/create-solana')}
                    className="text-cyan-primary hover:text-white mt-2"
                  >
                    Create Solana Wallet →
                  </button>
                </div>
              )}
            </div>

            {/* Priority fee */}
            <div className="modern-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Transaction Speed</h2>

              <div className="grid grid-cols-3 gap-3">
                {(['normal', 'fast', 'instant'] as const).map((fee) => {
                  const info = { normal: { label: 'Normal', fee: '~$0.0002', time: '~10s' }, fast: { label: 'Fast', fee: '~$0.001', time: '~5s' }, instant: { label: 'Instant', fee: '~$0.005', time: '<2s' } }[fee];
                  return (
                    <button
                      key={fee}
                      onClick={() => setPriorityFee(fee)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        priorityFee === fee
                          ? 'border-cyan-primary bg-cyan-primary/10'
                          : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`font-bold mb-1 ${priorityFee === fee ? 'text-cyan-primary' : 'text-white'}`}>
                          {info.label}
                        </div>
                        <div className="text-xs text-gray-400">{info.time}</div>
                        <div className="text-xs text-gray-500 mt-1">{info.fee}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="cel-error">
                <p>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleDeposit}
              disabled={isLoading || !selectedWallet || !amount || (!selectedCasino && !customAddress)}
              className="btn-primary w-full py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : `Deposit ${amount || '0'} SOL ${feeInfo.label}`}
            </button>
          </div>

          {/* Recent deposits sidebar */}
          <div className="space-y-6">
            <div className="modern-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Recent Deposits</h2>

              {recentDeposits.length > 0 ? (
                <div className="space-y-3">
                  {recentDeposits.map((deposit) => (
                    <div key={deposit.id} className="p-4 rounded-lg bg-dark-surface">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{deposit.casino}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(deposit.status)}`}>
                          {deposit.status}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-cyan-primary mb-1">
                        {deposit.amount} SOL
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(deposit.timestamp).toLocaleString()}
                      </div>
                      {deposit.txHash && (
                        <a
                          href={`https://solscan.io/tx/${deposit.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-primary hover:text-white mt-2 inline-block"
                        >
                          View on Solscan →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No recent deposits</p>
                </div>
              )}
            </div>

            {/* Info card */}
            <div className="modern-card p-6 space-y-3 bg-gradient-to-br from-purple-glow/5 to-cyan-primary/5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-cyan-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-white mb-1">Instant Deposits</h3>
                  <p className="text-sm text-gray-400">
                    Choose &quot;Instant&quot; priority for confirmed deposits in under 2 seconds - perfect for time-sensitive casino plays.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
