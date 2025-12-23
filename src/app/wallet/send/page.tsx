'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';

interface Wallet {
  id: string;
  blockchain: string;
  address: string;
  balance: number;
  label?: string;
}

export default function SendPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [priorityFee, setPriorityFee] = useState<'normal' | 'fast' | 'instant'>('fast');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/splash');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async () => {
    try {
      const data = await api.get<{ wallets: Wallet[] }>('/wallet/list');
      setWallets(data.wallets || []);
      if (data.wallets?.length > 0) {
        setSelectedWallet(data.wallets[0].id);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
    }
  };

  const validateAddressOrUsername = async (input: string, blockchain: string): Promise<boolean> => {
    if (!input) {
      setAddressError('Address or @username is required');
      return false;
    }

    // ✅ FIXED: Check if it's a username (starts with @)
    if (input.startsWith('@')) {
      try {
        setAddressError('Resolving username...');
        const { resolveUsernameStatus } = await import('@/lib/username/resolver');
        const resolution = await resolveUsernameStatus(input.substring(1)); // Remove @
        
        if (resolution.status === 'ok' && resolution.address) {
          // Username resolved successfully - update toAddress with resolved address
          setToAddress(resolution.address);
          setAddressError(null);
          return true;
        } else {
          setAddressError(`Username ${input} not found`);
          return false;
        }
      } catch (err) {
        setAddressError('Failed to resolve username. Please try again.');
        return false;
      }
    }

    // Otherwise validate as regular address
    switch (blockchain.toLowerCase()) {
      case 'solana':
        if (input.length < 32 || input.length > 44) {
          setAddressError('Invalid Solana address');
          return false;
        }
        break;
      case 'ethereum':
        if (!input.startsWith('0x') || input.length !== 42) {
          setAddressError('Invalid Ethereum address');
          return false;
        }
        break;
      case 'bitcoin':
        if (input.length < 26 || input.length > 35) {
          setAddressError('Invalid Bitcoin address');
          return false;
        }
        break;
    }

    setAddressError(null);
    return true;
  };

  const handleNext = async () => {
    if (step === 1 && !selectedWallet) {
      setError('Please select a wallet');
      return;
    }

    const selectedWalletData = wallets.find((w) => w.id === selectedWallet);
    
    // ✅ FIXED: Async validation for usernames
    if (step === 2) {
      const isValid = await validateAddressOrUsername(toAddress, selectedWalletData?.blockchain || '');
      if (!isValid) {
        return;
      }
    }

    if (step === 3 && (!amount || parseFloat(amount) <= 0)) {
      setError('Please enter a valid amount');
      return;
    }

    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSend = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const selectedWalletData = wallets.find((w) => w.id === selectedWallet);
      if (!selectedWalletData) {
        throw new Error('Wallet not found');
      }

      const path =
        selectedWalletData.blockchain.toLowerCase() === 'solana'
          ? '/solana/send'
          : selectedWalletData.blockchain.toLowerCase() === 'ethereum'
          ? '/ethereum/send'
          : '/bitcoin/send';

      const data = await api.post<any>(path, {
        walletId: selectedWallet,
        toAddress,
        amount: parseFloat(amount),
        priorityFee: priorityFee,
        memo: memo || undefined,
      });
      setTxSignature(data.signature || data.txHash || data.txid);
      setStep(5); // Success step
    } catch (err: any) {
      console.error('Error sending transaction:', err);
      setError(err.message || 'Failed to send transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const _getProgressPercentage = () => {
    return ((step - 1) / 4) * 100;
  };

  const selectedWalletData = wallets.find((w) => w.id === selectedWallet);

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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Send Crypto</h1>
          <p className="text-gray-400">Transfer funds to any wallet address</p>
        </div>

        {/* Progress bar */}
        <div className="modern-card p-6">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    step >= s
                      ? 'bg-cyan-primary text-dark-surface'
                      : 'bg-dark-surface text-gray-400 border-2 border-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`h-1 w-12 mx-2 transition-all ${
                      step > s ? 'bg-cyan-primary' : 'bg-gray-600'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Wallet</span>
            <span>Address</span>
            <span>Amount</span>
            <span>Review</span>
          </div>
        </div>

        {/* Step content */}
        <div className="modern-card p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Select Wallet</h2>
              <p className="text-gray-400">Choose which wallet to send from</p>

              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setSelectedWallet(wallet.id)}
                    className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
                      selectedWallet === wallet.id
                        ? 'border-cyan-primary bg-cyan-primary/10'
                        : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white mb-1 capitalize">
                          {wallet.blockchain} {wallet.label && `- ${wallet.label}`}
                        </div>
                        <div className="text-sm text-gray-400 font-mono">
                          {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-primary">
                          {wallet.balance.toFixed(4)}
                        </div>
                        <div className="text-sm text-gray-400 uppercase">{wallet.blockchain}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {wallets.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>No wallets found.</p>
                  <button
                    onClick={() => router.push('/wallet')}
                    className="text-cyan-primary hover:text-white mt-2"
                  >
                    Create a wallet →
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Enter Recipient Address</h2>
              <p className="text-gray-400">
                Send {selectedWalletData?.blockchain} to any wallet address
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => {
                    setToAddress(e.target.value);
                    if (addressError) {
                      validateAddressOrUsername(e.target.value, selectedWalletData?.blockchain || '');
                    }
                  }}
                  onBlur={() => validateAddressOrUsername(toAddress, selectedWalletData?.blockchain || '')}
                  placeholder={`Enter ${selectedWalletData?.blockchain} address...`}
                  className="neon-input w-full px-4 py-3 font-mono"
                />
                {addressError && (
                  <div className="text-red-400 text-sm mt-2">{addressError}</div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="font-semibold text-yellow-400 mb-1">Double-check the address</div>
                    <div className="text-sm text-yellow-400/80">
                      Cryptocurrency transactions are irreversible. Make sure the address is correct.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Enter Amount</h2>
              <p className="text-gray-400">How much do you want to send?</p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount ({selectedWalletData?.blockchain})
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="neon-input w-full px-4 py-3 text-3xl font-bold"
                  step="0.0001"
                  min="0"
                  max={selectedWalletData?.balance}
                />
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-400">
                    Available: {selectedWalletData?.balance.toFixed(4)} {selectedWalletData?.blockchain}
                  </span>
                  <button
                    onClick={() => setAmount(selectedWalletData?.balance.toString() || '0')}
                    className="text-cyan-primary hover:text-white transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Memo (Optional)
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Add a note..."
                  className="neon-input w-full px-4 py-3"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Transaction Speed
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['normal', 'fast', 'instant'] as const).map((fee) => {
                    const info = {
                      normal: { label: 'Normal', fee: '~$0.0002', time: '~10s' },
                      fast: { label: 'Fast', fee: '~$0.001', time: '~5s' },
                      instant: { label: 'Instant', fee: '~$0.005', time: '<2s' },
                    }[fee];
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
                          <div
                            className={`font-bold mb-1 ${
                              priorityFee === fee ? 'text-cyan-primary' : 'text-white'
                            }`}
                          >
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
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Review & Confirm</h2>
              <p className="text-gray-400">Please review your transaction details</p>

              <div className="space-y-4 bg-dark-surface rounded-lg p-6">
                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">From</span>
                  <div className="text-right">
                    <div className="text-white font-medium capitalize">
                      {selectedWalletData?.blockchain}
                    </div>
                    <div className="text-sm text-gray-400 font-mono">
                      {selectedWalletData?.address.slice(0, 10)}...
                      {selectedWalletData?.address.slice(-8)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">To</span>
                  <div className="text-sm text-white font-mono text-right break-all max-w-[60%]">
                    {toAddress}
                  </div>
                </div>

                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-2xl font-bold text-cyan-primary">
                    {amount} {selectedWalletData?.blockchain}
                  </span>
                </div>

                <div className="flex justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="text-white font-medium">
                    {priorityFee === 'instant'
                      ? '~$0.005'
                      : priorityFee === 'fast'
                      ? '~$0.001'
                      : '~$0.0002'}
                  </span>
                </div>

                {memo && (
                  <div className="flex justify-between py-3">
                    <span className="text-gray-400">Memo</span>
                    <span className="text-white font-medium">{memo}</span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="font-semibold text-red-400 mb-1">Final Warning</div>
                    <div className="text-sm text-red-400/80">
                      This transaction cannot be reversed. Make sure all details are correct.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && txSignature && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white">Transaction Sent!</h2>
              <p className="text-gray-400">Your transaction has been broadcast to the network</p>

              <div className="bg-dark-surface rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Transaction Signature</div>
                <div className="text-white font-mono text-xs break-all">{txSignature}</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/wallet/transactions')}
                  className="btn-primary flex-1"
                >
                  View Transactions
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setToAddress('');
                    setAmount('');
                    setMemo('');
                    setTxSignature(null);
                    setError(null);
                  }}
                  className="btn-outline flex-1"
                >
                  Send Another
                </button>
              </div>
            </div>
          )}

          {error && step !== 5 && (
            <div className="cel-error mt-6">
              <p>{error}</p>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 5 && (
            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <button onClick={handleBack} className="btn-outline flex-1" disabled={isLoading}>
                  ← Back
                </button>
              )}
              {step < 4 && (
                <button
                  onClick={handleNext}
                  className="btn-primary flex-1"
                  disabled={
                    (step === 1 && !selectedWallet) ||
                    (step === 2 && (!toAddress || !!addressError)) ||
                    (step === 3 && (!amount || parseFloat(amount) <= 0))
                  }
                >
                  Next →
                </button>
              )}
              {step === 4 && (
                <button
                  onClick={handleSend}
                  className="btn-primary flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : `Send ${amount} ${selectedWalletData?.blockchain}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
