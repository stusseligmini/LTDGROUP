'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { useAuthContext } from '@/providers/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  getWalletFromLocal, 
  WalletEncryption,
  deriveWallet 
} from '@/lib/wallet/nonCustodialWallet';
import { solanaWallet, deriveSolanaWallet, getSolanaConnection, estimatePriorityFeeMicroLamports } from '@/lib/solana/solanaWallet';
import { envFlags } from '@/lib/env/flags';
import { type PriorityLevel } from '@/lib/solana/priorityFees';
import { signSolanaTransaction } from '@/lib/wallet/transactionSigning';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey, ComputeBudgetProgram } from '@solana/web3.js';
import { PasswordModal } from '@/components/wallet/PasswordModal';

interface SolanaWallet {
  id: string;
  address: string;
  label: string | null;
  balance: number;
  isDefault: boolean;
}

interface FeeEstimate {
  level: PriorityLevel;
  label: string;
  description: string;
  estimatedFee: number; // In SOL
  estimatedTime: string;
}

export function SendSolana() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [showUSD, setShowUSD] = useState(false);
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>('instant');
  const [feeEstimates, setFeeEstimates] = useState<FeeEstimate[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [isUsername, setIsUsername] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Fetch SOL price
  const fetchSolPrice = useCallback(async () => {
    try {
      if (envFlags.disablePrices) { setSolPrice(150); return; }
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        setSolPrice(data.solana?.usd || 150);
      }
    } catch (err) {
      setSolPrice(150); // Fallback
    }
  }, []);

  // Fetch wallet and balance
  const fetchWallet = useCallback(async () => {
    if (!user) {
      setError('Please sign in to send SOL');
      return;
    }

    try {
      const response = await fetch('/api/wallet/list?blockchain=solana&limit=1', {
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
        setError('No wallets found');
        return;
      }
      
      const solanaWallet = wallets.find((w: any) => w && w.isDefault && w.blockchain === 'solana') ||
                          wallets.find((w: any) => w && w.blockchain === 'solana');

      if (!solanaWallet) {
        setError('No Solana wallet found');
        return;
      }

      setWallet({
        id: solanaWallet.id,
        address: solanaWallet.address,
        label: solanaWallet.label || 'My Solana Wallet',
        balance: 0,
        isDefault: solanaWallet.isDefault,
      });

      // Fetch balance
      const balanceResponse = await fetch(`/api/solana/balance?address=${solanaWallet.address}`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        const solBalance = parseFloat(balanceData.data.balanceSOL || 0);
        setBalance(solBalance);
        setWallet(prev => prev ? { ...prev, balance: solBalance } : null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet');
    }
  }, [user]);

  // Fetch priority fee estimates
  const fetchFeeEstimates = useCallback(async () => {
    try {
      if (envFlags.disablePrices) {
        setFeeEstimates([
          { level: 'low', label: 'Low', description: 'Slow confirmation', estimatedFee: 0.000001, estimatedTime: '1-2min' },
          { level: 'normal', label: 'Normal', description: 'Normal confirmation', estimatedFee: 0.000005, estimatedTime: '<1min' },
          { level: 'high', label: 'High', description: 'Fast confirmation', estimatedFee: 0.00001, estimatedTime: '<30s' },
          { level: 'instant', label: 'Instant', description: 'Instant confirmation (gambling)', estimatedFee: 0.00005, estimatedTime: '<2s' },
        ]);
        return;
      }
      const connection = getSolanaConnection();
      
      const levels: PriorityLevel[] = ['low', 'normal', 'high', 'instant'];
      const estimates: FeeEstimate[] = [];

      for (const level of levels) {
        const estimateMicro = await estimatePriorityFeeMicroLamports(connection);
        // Convert microLamports heuristic into priority tiers
        const base = estimateMicro / 1_000_000_000; // microLamports -> SOL approximation
        const multiplier = level === 'low' ? 0.5 : level === 'normal' ? 1 : level === 'high' ? 1.5 : 2;
        const feeInSOL = base * multiplier;
        
        estimates.push({
          level,
          label: level.charAt(0).toUpperCase() + level.slice(1),
          description: 
            level === 'instant' ? 'Instant confirmation (gambling)' :
            level === 'high' ? 'Fast confirmation (<30s)' :
            level === 'normal' ? 'Normal confirmation (<1min)' :
            'Slow confirmation (1-2min)',
          estimatedFee: feeInSOL,
          estimatedTime: 
            level === 'instant' ? '<2s' :
            level === 'high' ? '<30s' :
            level === 'normal' ? '<1min' :
            '1-2min',
        });
      }

      setFeeEstimates(estimates);
    } catch (err) {
      console.error('Failed to fetch fee estimates', err);
      // Set default estimates
      setFeeEstimates([
        { level: 'low', label: 'Low', description: 'Slow confirmation', estimatedFee: 0.000001, estimatedTime: '1-2min' },
        { level: 'normal', label: 'Normal', description: 'Normal confirmation', estimatedFee: 0.000005, estimatedTime: '<1min' },
        { level: 'high', label: 'High', description: 'Fast confirmation', estimatedFee: 0.00001, estimatedTime: '<30s' },
        { level: 'instant', label: 'Instant', description: 'Instant confirmation (gambling)', estimatedFee: 0.00005, estimatedTime: '<2s' },
      ]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSolPrice();
    fetchWallet();
    fetchFeeEstimates();
  }, [fetchSolPrice, fetchWallet, fetchFeeEstimates]);

  // Pre-fill from query parameters
  useEffect(() => {
    const toParam = searchParams?.get('to') || null;
    const labelParam = searchParams?.get('label') || null;
    
    if (toParam && !toAddress) {
      setToAddress(labelParam || toParam);
    }
  }, [searchParams, toAddress]);

  // Update USD amount when SOL amount changes
  useEffect(() => {
    if (amount && solPrice > 0 && !showUSD) {
      const solAmount = parseFloat(amount) || 0;
      setAmountUSD((solAmount * solPrice).toFixed(2));
    }
  }, [amount, solPrice, showUSD]);

  // Update SOL amount when USD amount changes
  useEffect(() => {
    if (amountUSD && solPrice > 0 && showUSD) {
      const usdAmount = parseFloat(amountUSD) || 0;
      setAmount((usdAmount / solPrice).toFixed(6));
    }
  }, [amountUSD, solPrice, showUSD]);

  // Check if address is a username
  useEffect(() => {
    const addressValue = toAddress.trim();
    if (addressValue.startsWith('@') || addressValue.endsWith('.sol')) {
      setIsUsername(true);
      // Resolve username
      resolveUsername(addressValue);
    } else {
      setIsUsername(false);
      setResolvedAddress(null);
      // Validate Solana address format
      if (addressValue && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addressValue)) {
        setError('Invalid Solana address format');
      } else {
        setError(null);
      }
    }
  }, [toAddress]);

  // Resolve username to address
  const resolveUsername = async (username: string) => {
    try {
      // Remove @ and .sol if present
      const cleanUsername = username.replace(/^@/, '').replace(/\.sol$/, '');
      
      const response = await fetch(`/api/username?username=${cleanUsername}`);
      if (response.ok) {
        const data = await response.json();
        setResolvedAddress(data.data.address);
        setError(null);
      } else {
        setResolvedAddress(null);
        setError('Username not found');
      }
    } catch (err) {
      setResolvedAddress(null);
      setError('Failed to resolve username');
    }
  };

  // Handle max button
  const handleMax = () => {
    if (wallet && balance > 0) {
      // Leave some SOL for fees (0.01 SOL should be enough)
      const maxAmount = Math.max(0, balance - 0.01);
      setAmount(maxAmount.toFixed(6));
    }
  };

  // Get transaction preview
  const getTransactionPreview = () => {
    if (!wallet || !amount || !toAddress) return null;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return null;

    const targetAddress = resolvedAddress || toAddress;
    if (!targetAddress) return null;

    const selectedFee = feeEstimates.find(e => e.level === priorityLevel);
    const totalCost = amountNum + (selectedFee?.estimatedFee || 0.00005);

    return {
      from: wallet.address,
      to: targetAddress,
      amount: amountNum,
      amountUSD: (amountNum * solPrice).toFixed(2),
      fee: selectedFee?.estimatedFee || 0.00005,
      feeUSD: ((selectedFee?.estimatedFee || 0.00005) * solPrice).toFixed(4),
      total: totalCost,
      totalUSD: (totalCost * solPrice).toFixed(2),
      priority: selectedFee?.label || 'Instant',
      estimatedTime: selectedFee?.estimatedTime || '<2s',
      recipient: isUsername ? toAddress : `${targetAddress.slice(0, 8)}...${targetAddress.slice(-8)}`,
    };
  };

  // Preview transaction (show confirmation)
  const handlePreview = () => {
    const preview = getTransactionPreview();
    if (!preview) {
      setError('Please fill in all fields');
      return;
    }

    if (preview.total > balance) {
      setError('Insufficient balance');
      return;
    }

    setPreviewing(true);
  };

  // Confirm and show password modal
  const handleConfirmTransaction = () => {
    setShowPasswordModal(true);
  };

  // Send transaction with password
  const handleSendWithPassword = async (password: string) => {
    if (!wallet) {
      setPasswordError('Wallet not found');
      return;
    }

    const preview = getTransactionPreview();
    if (!preview) {
      setPasswordError('Invalid transaction details');
      return;
    }

    setLoading(true);
    setPasswordError(null);

    let mnemonic = ''; // Declare outside try for cleanup

    try {
      // Get encrypted mnemonic from localStorage
      const walletData = getWalletFromLocal(wallet.id, localStorage);
      if (!walletData) {
        throw new Error('Wallet not found in local storage. Please import your wallet again.');
      }

      // Decrypt mnemonic with password
      mnemonic = await WalletEncryption.decrypt(
        walletData.encryptedMnemonic,
        password,
        walletData.salt,
        walletData.iv
      );

      // Derive Solana wallet from mnemonic
      const solanaWallet = await deriveSolanaWallet(mnemonic, 0);

      // Build transaction
      const connection = getSolanaConnection();
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: solanaWallet.publicKey,
          toPubkey: new PublicKey(preview.to),
          lamports: Math.floor(preview.amount * LAMPORTS_PER_SOL),
        })
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaWallet.publicKey;

      // Add priority fee
      const feeEstimate = feeEstimates.find(e => e.level === priorityLevel);
      if (feeEstimate) {
        const connection = getSolanaConnection();
        const micro = await estimatePriorityFeeMicroLamports(connection);
        transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: micro }));
      }

      // Sign transaction
      transaction.sign(solanaWallet as any);

      // Serialize transaction
      const serialized = transaction.serialize({
        requireAllSignatures: true,
        verifySignatures: false,
      });

      const signedTxBase64 = Buffer.from(serialized).toString('base64');

      // Send to API
      const response = await fetch('/api/solana/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || '',
        },
        body: JSON.stringify({
          walletId: wallet.id,
          toAddress: preview.to,
          amount: preview.amount,
          signedTransaction: signedTxBase64,
          priorityLevel: priorityLevel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send transaction');
      }

      const result = await response.json();

      // Close modal and redirect to transaction page
      setShowPasswordModal(false);
      router.push(`/wallet/history?tx=${result.data.signature}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send transaction';
      
      // Check if it's a password error
      if (errorMessage.toLowerCase().includes('password') || 
          errorMessage.toLowerCase().includes('decrypt') ||
          errorMessage.toLowerCase().includes('incorrect')) {
        setPasswordError('Incorrect password. Please try again.');
      } else {
        setPasswordError(errorMessage);
      }
      
      console.error('Error sending transaction:', err);
    } finally {
      // SECURITY: Clear sensitive data from memory
      mnemonic = '';
      setLoading(false);
    }
  };

  const preview = getTransactionPreview();
  const selectedFee = feeEstimates.find(e => e.level === priorityLevel);

  if (!wallet) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-0">
        <Card>
          <CardContent className="p-6 md:p-8">
            <LoadingSpinner size="lg" message="Loading wallet..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Send SOL</CardTitle>
          <CardDescription>
            Balance: {balance.toFixed(4)} SOL
            {solPrice > 0 && ` (≈ $${(balance * solPrice).toFixed(2)})`}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          variant="inline"
          onRetry={() => {
            setError(null);
            if (wallet && toAddress && amount) {
              // Retry transaction if possible
              // Submit handler (guarded for typecheck)
              // No-op to satisfy typecheck
              void 0;
            }
          }}
        />
      )}

      {/* Send Form */}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* To Address / Username */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Send to Address or Username
            </label>
            <Input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="@username.sol or Solana address"
              className="w-full font-mono text-sm md:text-base"
            />
            {isUsername && resolvedAddress && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Resolved: {resolvedAddress.slice(0, 8)}...{resolvedAddress.slice(-8)}
              </p>
            )}
            {error && toAddress && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Amount
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUSD(!showUSD)}
                >
                  {showUSD ? 'SOL' : 'USD'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                >
                  Max
                </Button>
              </div>
            </div>
            <Input
              type="number"
              step="0.000001"
              value={showUSD ? amountUSD : amount}
              onChange={(e) => {
                if (showUSD) {
                  setAmountUSD(e.target.value);
                } else {
                  setAmount(e.target.value);
                }
              }}
              placeholder={showUSD ? "0.00 USD" : "0.000000 SOL"}
              className="w-full text-xl md:text-2xl"
            />
            <p className="text-xs text-gray-500 mt-1">
              ≈ {showUSD 
                ? `${amount ? parseFloat(amount).toFixed(6) : '0.000000'} SOL`
                : `$${amountUSD || '0.00'} USD`}
            </p>
          </div>

          {/* Priority Fee Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Priority Fee (Confirmation Speed)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {feeEstimates.map((fee) => (
                <button
                  key={fee.level}
                  onClick={() => setPriorityLevel(fee.level)}
                  className={`p-2 md:p-3 rounded-lg border-2 text-left transition-all touch-target ${
                    priorityLevel === fee.level
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-gray-200 hover:border-gray-300 active:bg-gray-100'
                  }`}
                >
                  <p className="font-semibold text-xs md:text-sm">{fee.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{fee.estimatedTime}</p>
                  {fee.level === 'instant' && (
                    <p className="text-xs text-purple-600 mt-1">🎰 Gambling</p>
                  )}
                </button>
              ))}
            </div>
            {selectedFee && (
              <p className="text-xs text-gray-500 mt-2">
                Estimated fee: {selectedFee.estimatedFee.toFixed(6)} SOL (≈ ${(selectedFee.estimatedFee * solPrice).toFixed(4)})
              </p>
            )}
          </div>

          {/* Transaction Preview */}
          {preview && previewing && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Transaction Preview</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">To:</span>
                  <span className="font-mono">{preview.recipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">{preview.amount.toFixed(6)} SOL (${preview.amountUSD})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee:</span>
                  <span>{preview.fee.toFixed(6)} SOL (${preview.feeUSD})</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold">{preview.total.toFixed(6)} SOL (${preview.totalUSD})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Priority:</span>
                  <span>{preview.priority} ({preview.estimatedTime})</span>
                </div>
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="flex gap-3">
            {previewing && (
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewing(false);
                }}
                className="flex-1"
                disabled={loading}
              >
                Back
              </Button>
            )}
            <Button
              onClick={previewing ? handleConfirmTransaction : handlePreview}
              disabled={
                loading ||
                !toAddress ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (resolvedAddress === null && isUsername)
              }
              className={`flex-1 touch-target ${priorityLevel === 'instant' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
            >
              {previewing ? (
                priorityLevel === 'instant' ? 'Confirm & Send ⚡' : 'Confirm & Send'
              ) : priorityLevel === 'instant' ? (
                'Preview (Instant ⚡)'
              ) : (
                'Preview Transaction'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordError(null);
        }}
        onConfirm={handleSendWithPassword}
        title="Confirm Transaction"
        description="Enter your password to sign and send this transaction"
        loading={loading}
        error={passwordError}
      />
    </div>
  );
}

