'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuthContext } from '@/providers/AuthProvider';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/apiClient';

interface SolanaWallet {
  id: string;
  address: string;
  label: string | null;
  balance: number;
}

export function ReceiveSolana() {
  const { user } = useAuthContext();
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch wallet
  const fetchWallet = useCallback(async () => {
    if (!user) {
      setError('Please sign in to receive SOL');
      setLoading(false);
      return;
    }

    try {
      const data = await api.get<{ wallets: any[] }>(
        '/wallet/list?blockchain=solana&limit=1',
        {
          headers: { 'X-User-Id': user.id },
        }
      );
      const wallets = (data as any).data?.wallets || (data as any).wallets || [];
      
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
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Copy address to clipboard
  const handleCopy = async () => {
    if (!wallet) return;

    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Share address (for mobile)
  const handleShare = async () => {
    if (!wallet) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My Solana Address',
          text: `Send SOL to: ${wallet.address}`,
        });
      } else {
        handleCopy();
      }
    } catch (err) {
      console.error('Failed to share address:', err);
    }
  };

  if (loading) {
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

  if (error || !wallet) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-0">
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error || 'Wallet not found'}</p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
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
          <CardTitle>Receive SOL</CardTitle>
          <CardDescription>
            Share your address or QR code to receive Solana
          </CardDescription>
        </CardHeader>
      </Card>

      {/* QR Code */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg border-4 border-gray-200">
              <QRCodeSVG
                value={wallet.address}
                size={256}
                level="M"
                includeMargin={true}
              />
            </div>

            {/* Address */}
            <div className="w-full space-y-3">
              <label className="block text-sm font-medium text-center">
                Your Solana Address
              </label>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="font-mono text-sm break-all text-center">
                  {wallet.address}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCopy}
                  className="flex-1"
                  variant={copied ? 'default' : 'outline'}
                >
                  {copied ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Address
                    </span>
                  )}
                </Button>

                {typeof window !== 'undefined' && 'share' in navigator && (
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    className="flex-1"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Receive SOL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center font-semibold text-xs">
              1
            </span>
            <p className="text-gray-700">
              <strong>Share your address:</strong> Copy the address above and share it with the sender, or let them scan the QR code.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center font-semibold text-xs">
              2
            </span>
            <p className="text-gray-700">
              <strong>Wait for confirmation:</strong> Transactions on Solana are typically confirmed within seconds.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center font-semibold text-xs">
              3
            </span>
            <p className="text-gray-700">
              <strong>Check your balance:</strong> Your balance will update automatically once the transaction is confirmed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Security Tip:</strong> Only share this address on trusted platforms. Anyone who has your address can send you SOL, but they cannot access your funds.
        </p>
      </div>
    </div>
  );
}
