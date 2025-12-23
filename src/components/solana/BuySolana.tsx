'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { appFetch } from '@/lib/network/appFetch';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthContext } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { MoonPayWidget } from '@/components/fiat/MoonPayWidget';
import { RampWidget } from '@/components/fiat/RampWidget';

type Provider = 'moonpay' | 'ramp';

interface SolanaWallet {
  id: string;
  address: string;
  label: string | null;
  isDefault: boolean;
}

interface PurchaseStatus {
  status: 'idle' | 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  error?: string;
}

export function BuySolana() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('moonpay');
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({ status: 'idle' });
  const [showWidget, setShowWidget] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get MoonPay API key from environment (or use default)
  const moonPayApiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || 'pk_test_placeholder';
  const moonPayEnvironment: 'sandbox' | 'production' = 
    process.env.NEXT_PUBLIC_MOONPAY_ENV === 'production' ? 'production' : 'sandbox';

  // Get Ramp API key from environment
  const rampApiKey = process.env.NEXT_PUBLIC_RAMP_API_KEY || '';
  const rampEnvironment: 'sandbox' | 'production' = 
    process.env.NEXT_PUBLIC_RAMP_ENV === 'production' ? 'production' : 'sandbox';

  // Fetch user's Solana wallet
  const fetchWallet = useCallback(async () => {
    if (!user) {
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
        return;
      }
      
      const solanaWallet = wallets.find((w: any) => w && w.isDefault && w.blockchain === 'solana') ||
                          wallets.find((w: any) => w && w.blockchain === 'solana');

      if (solanaWallet) {
        setWallet({
          id: solanaWallet.id,
          address: solanaWallet.address,
          label: solanaWallet.label || 'My Solana Wallet',
          isDefault: solanaWallet.isDefault,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Handle MoonPay success
  const handleMoonPaySuccess = useCallback((txHash: string) => {
    setPurchaseStatus({
      status: 'completed',
      transactionHash: txHash,
    });
    setShowWidget(false);
    
    // Redirect to transaction history after 2 seconds
    setTimeout(() => {
      router.push(`/wallet/history?tx=${txHash}`);
    }, 2000);
  }, [router]);

  // Handle MoonPay error
  const handleMoonPayError = useCallback((error: Error) => {
    setPurchaseStatus({
      status: 'failed',
      error: error.message,
    });
    setShowWidget(false);
  }, []);

  // Handle MoonPay close
  const handleMoonPayClose = useCallback(() => {
    setShowWidget(false);
    if (purchaseStatus.status === 'idle') {
      setPurchaseStatus({ status: 'idle' });
    }
  }, [purchaseStatus.status]);

  // Handle Ramp success (would be implemented with Ramp widget)
  const handleRampSuccess = useCallback((purchaseData: any) => {
    setPurchaseStatus({
      status: 'completed',
      transactionHash: purchaseData.transactionHash || purchaseData.cryptoTransactionHash,
    });
    setShowWidget(false);
  }, []);

  // Handle Ramp error
  const handleRampError = useCallback((error: Error) => {
    setPurchaseStatus({
      status: 'failed',
      error: error.message,
    });
    setShowWidget(false);
  }, []);

  // Open widget
  const handleOpenWidget = () => {
    setPurchaseStatus({ status: 'pending' });
    setShowWidget(true);
  };

  // Copy address to clipboard
  const handleCopyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      alert('Address copied to clipboard!');
    }
  };

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Please sign in to buy SOL</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading wallet...</p>
        </CardContent>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card className="max-w-2xl mx-auto">
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Buy SOL with Credit Card</CardTitle>
          <CardDescription>
            Purchase SOL directly to your non-custodial wallet. Funds go straight to your address.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Provider Selection */}
      {!showWidget && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Provider</CardTitle>
            <CardDescription>
              Select a fiat on-ramp provider. Both send SOL directly to your wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wallet Address Display */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Your Solana Address</p>
                  <p className="text-sm font-mono text-gray-900 break-all">{wallet.address}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="ml-4"
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MoonPay */}
              <Card
                className={`cursor-pointer transition-all ${
                  selectedProvider === 'moonpay'
                    ? 'border-2 border-blue-500 bg-blue-50'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedProvider('moonpay')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🌙</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">MoonPay</h3>
                      <p className="text-xs text-gray-500">Credit/debit card, Apple Pay</p>
                    </div>
                    {selectedProvider === 'moonpay' && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Ramp Network */}
              <Card
                className={`cursor-pointer transition-all ${
                  selectedProvider === 'ramp'
                    ? 'border-2 border-blue-500 bg-blue-50'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedProvider('ramp')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🚀</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Ramp Network</h3>
                      <p className="text-xs text-gray-500">Card, bank transfer, Apple Pay</p>
                    </div>
                    {selectedProvider === 'ramp' && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Continue Button */}
            <Button
              onClick={handleOpenWidget}
              className="w-full"
              disabled={purchaseStatus.status === 'pending'}
            >
              Continue with {selectedProvider === 'moonpay' ? 'MoonPay' : 'Ramp'}
            </Button>

            {/* Info */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> All purchases go directly to your non-custodial wallet. 
                Celora never touches your funds. The provider handles KYC and compliance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widget Display */}
      {showWidget && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedProvider === 'moonpay' ? 'MoonPay' : 'Ramp Network'}
                </CardTitle>
                <CardDescription>
                  Complete your purchase. SOL will be sent to your wallet address.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMoonPayClose}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedProvider === 'moonpay' ? (
              <div className="w-full" style={{ height: '600px' }}>
                <MoonPayWidget
                  address={wallet.address}
                  apiKey={moonPayApiKey}
                  environment={moonPayEnvironment}
                  onSuccess={handleMoonPaySuccess}
                  onError={handleMoonPayError}
                  onClose={handleMoonPayClose}
                  options={{
                    defaultCryptoCurrency: 'sol',
                    colorCode: '#06b6d4', // Cyan color
                  }}
                />
              </div>
            ) : (
              <div className="w-full" style={{ height: '600px' }}>
                <RampWidget
                  address={wallet.address}
                  apiKey={rampApiKey}
                  environment={rampEnvironment}
                  onSuccess={handleRampSuccess}
                  onError={handleRampError}
                  onClose={handleMoonPayClose}
                  options={{
                    defaultAsset: 'SOL',
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Status */}
      {purchaseStatus.status === 'completed' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-green-900">Purchase completed!</p>
                {purchaseStatus.transactionHash && (
                  <p className="text-xs text-green-700 font-mono mt-1">
                    TX: {purchaseStatus.transactionHash.slice(0, 16)}...
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {purchaseStatus.status === 'failed' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-red-900">Purchase failed</p>
                {purchaseStatus.error && (
                  <p className="text-xs text-red-700 mt-1">{purchaseStatus.error}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

