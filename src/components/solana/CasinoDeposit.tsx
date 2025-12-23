'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { appFetch } from '@/lib/network/appFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthContext } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { 
  CASINO_PRESETS, 
  getVerifiedPresets, 
  getPresetsByCategory,
  searchPresets,
  type CasinoPreset 
} from '@/lib/casino';
import { 
  getWalletFromLocal, 
  WalletEncryption 
} from '@/lib/wallet/nonCustodialWallet';
import { deriveSolanaWallet, getSolanaConnection, estimatePriorityFeeMicroLamports } from '@/lib/solana/solanaWallet';
import { envFlags } from '@/lib/env/flags';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey, ComputeBudgetProgram } from '@solana/web3.js';

interface SolanaWallet {
  id: string;
  address: string;
  label: string | null;
  balance: number;
}

type Category = 'all' | 'casino' | 'sportsbook' | 'poker' | 'other';

const QUICK_AMOUNTS = [0.1, 0.5, 1.0, 2.5, 5.0];

export function CasinoDeposit() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [selectedCasino, setSelectedCasino] = useState<CasinoPreset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [amount, setAmount] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [previewing, setPreviewing] = useState(false);

  // Filtered casinos
  const [filteredCasinos, setFilteredCasinos] = useState<CasinoPreset[]>([]);

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
      setSolPrice(150);
    }
  }, []);

  // Fetch wallet
  const fetchWallet = useCallback(async () => {
    if (!user) {
      setError('Please sign in to deposit to casino');
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
      });

      // Fetch balance
      const balanceResponse = await appFetch(`/api/solana/balance?address=${solanaWallet.address}`);
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

  // Filter casinos
  useEffect(() => {
    let casinos: CasinoPreset[] = [];

    if (searchQuery) {
      casinos = searchPresets(searchQuery);
    } else if (category === 'all') {
      casinos = getVerifiedPresets();
    } else {
      casinos = getPresetsByCategory(category);
    }

    setFilteredCasinos(casinos);
  }, [searchQuery, category]);

  // Initial load
  useEffect(() => {
    fetchSolPrice();
    fetchWallet();
  }, [fetchSolPrice, fetchWallet]);

  // Handle quick amount
  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

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

  // Get deposit address
  const getDepositAddress = (): string | null => {
    if (useCustomAddress && customAddress) {
      // Validate custom address
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(customAddress)) {
        setError('Invalid Solana address format');
        return null;
      }
      return customAddress;
    }
    if (selectedCasino) {
      return (selectedCasino as any).address || '';
    }
    return null;
  };

  // Get casino name
  const getCasinoName = (): string => {
    if (useCustomAddress) {
      return 'Custom Casino';
    }
    if (selectedCasino) {
      return selectedCasino.name;
    }
    return '';
  };

  // Deposit to casino
  const handleDeposit = async () => {
    if (!wallet || !password) {
      setShowPasswordInput(true);
      return;
    }

    const depositAddress = getDepositAddress();
    if (!depositAddress) {
      setError('Please select a casino or enter a custom address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum > balance) {
      setError('Insufficient balance');
      return;
    }

    const casino = selectedCasino;
    if (casino && casino.minDeposit && amountNum < casino.minDeposit) {
      setError(`Minimum deposit is ${casino.minDeposit} SOL`);
      return;
    }

    if (!previewing) {
      setPreviewing(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get encrypted mnemonic from localStorage
      const walletData = getWalletFromLocal(wallet.id, localStorage);
      if (!walletData) {
        throw new Error('Wallet not found in local storage. Please import your wallet again.');
      }

      // Decrypt mnemonic with password
      const mnemonic = await WalletEncryption.decrypt(
        walletData.encryptedMnemonic,
        password,
        walletData.salt,
        walletData.iv
      );

      // Derive Solana wallet from mnemonic
      const solanaWallet = await deriveSolanaWallet(mnemonic, 0);

      // Build transaction with instant priority fee (gambling)
      const connection = getSolanaConnection();
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const priorityMicro = await estimatePriorityFeeMicroLamports(connection);

      const transaction = new Transaction();
      
      // Add priority fee first (for instant confirmation)
      transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityMicro }));

      // Add transfer
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: solanaWallet.publicKey,
          toPubkey: new PublicKey(depositAddress),
          lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
        })
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaWallet.publicKey;

      // Sign transaction
      transaction.sign(solanaWallet as any);

      // Serialize transaction
      const serialized = transaction.serialize({
        requireAllSignatures: true,
        verifySignatures: false,
      });

      const signedTxBase64 = Buffer.from(serialized).toString('base64');

      // Send to API with casino ID
      const response = await fetch('/api/solana/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || '',
        },
        body: JSON.stringify({
          walletId: wallet.id,
          toAddress: depositAddress,
          amount: amountNum,
          signedTransaction: signedTxBase64,
          priorityLevel: 'instant',
          casinoId: selectedCasino?.id || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send deposit');
      }

      const result = await response.json();

      // Redirect to transaction history
      router.push(`/wallet/history?tx=${result.data.signature}`);
    } catch (err: any) {
      setError(err.message || 'Failed to deposit to casino');
      console.error('Error depositing to casino:', err);
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Casino Deposit</CardTitle>
          <CardDescription>
            One-click deposits to verified casinos with instant confirmation
          </CardDescription>
          {wallet && (
            <CardDescription>
              Balance: {formatBalance(balance)} SOL {solPrice > 0 && `(≈ ${formatUSD(balance * solPrice)})`}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Casino Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Casino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search casinos..."
              className="w-full"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'casino', 'sportsbook', 'poker'] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                  category === cat
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Casino List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {filteredCasinos.map((casino) => (
              <button
                key={casino.id}
                onClick={() => {
                  setSelectedCasino(casino);
                  setUseCustomAddress(false);
                  setCustomAddress('');
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedCasino?.id === casino.id
                    ? 'border-cyan-600 bg-cyan-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{casino.icon || '🎰'}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{casino.name}</p>
                      {casino.verified && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{casino.description}</p>
                    {casino.minDeposit && (
                      <p className="text-xs text-gray-400 mt-1">Min: {casino.minDeposit} SOL</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredCasinos.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No casinos found</p>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  Clear Search
                </Button>
              )}
            </div>
          )}

          {/* Custom Address Option */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={useCustomAddress}
                onChange={(e) => {
                  setUseCustomAddress(e.target.checked);
                  if (e.target.checked) {
                    setSelectedCasino(null);
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Use custom casino address</span>
            </label>
            {useCustomAddress && (
              <Input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Enter Solana address..."
                className="w-full font-mono text-sm"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deposit Amount */}
      {(selectedCasino || useCustomAddress) && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit Amount</CardTitle>
            <CardDescription>
              Deposit to {getCasinoName()} with instant confirmation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Amount Buttons */}
            <div>
              <p className="text-sm font-medium mb-2">Quick Amounts</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_AMOUNTS.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant="outline"
                    onClick={() => handleQuickAmount(quickAmount)}
                    className={amount === quickAmount.toString() ? 'bg-cyan-50 border-cyan-600' : ''}
                  >
                    {quickAmount} SOL
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Custom Amount
              </label>
              <Input
                type="number"
                step="0.000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.000000 SOL"
                className="w-full text-2xl"
              />
              {amount && solPrice > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  ≈ {formatUSD(parseFloat(amount) * solPrice || 0)}
                </p>
              )}
            </div>

            {/* Password Input */}
            {showPasswordInput && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Enter Password to Confirm
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                  className="w-full"
                  autoFocus
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Preview */}
            {previewing && amount && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">Deposit Preview</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="font-medium">{getCasinoName()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold">{formatBalance(parseFloat(amount))} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fee:</span>
                    <span>~0.00005 SOL (Instant)</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold">
                      {formatBalance(parseFloat(amount) + 0.00005)} SOL
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Deposit Button */}
            <div className="flex gap-3">
              {previewing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewing(false);
                    setPassword('');
                    setShowPasswordInput(false);
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleDeposit}
                disabled={
                  loading ||
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  (!selectedCasino && !useCustomAddress) ||
                  (useCustomAddress && !customAddress) ||
                  (showPasswordInput && !password)
                }
                className={`flex-1 bg-purple-600 hover:bg-purple-700 ${
                  previewing ? '' : 'text-lg py-6'
                }`}
              >
                {loading 
                  ? 'Depositing...' 
                  : previewing
                    ? 'Confirm Deposit'
                    : `Deposit ${amount ? formatBalance(parseFloat(amount)) : ''} SOL to ${getCasinoName()}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

