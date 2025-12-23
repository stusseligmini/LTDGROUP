'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';
import QRCode from 'qrcode';

interface Wallet {
  id: string;
  blockchain: string;
  address: string;
  balance: number;
  label?: string;
}

export default function ReceivePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (selectedWallet) {
      generateQRCode();
    }
  }, [selectedWallet]);

  const fetchWallets = async () => {
    try {
      const data = await api.get<{ wallets: Wallet[] }>('/wallet/list');
      setWallets(data.wallets || []);
      if (data.wallets?.length > 0) {
        setSelectedWallet(data.wallets[0].id);
      }
    } catch (_err) {
      console.error('Error fetching wallets:', _err);
    }
  };

  const generateQRCode = async () => {
    const selectedWalletData = wallets.find((w) => w.id === selectedWallet);
    if (!selectedWalletData || !canvasRef.current) return;

    let qrData = selectedWalletData.address;

    // Add amount and memo to QR code if specified (Solana format)
    if (selectedWalletData.blockchain.toLowerCase() === 'solana') {
      const params = new URLSearchParams();
      if (amount) params.append('amount', amount);
      if (memo) params.append('memo', memo);
      if (params.toString()) {
        qrData = `solana:${selectedWalletData.address}?${params.toString()}`;
      }
    }

    try {
      await QRCode.toCanvas(canvasRef.current, qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#00f5d4',
          light: '#1a1f2e',
        },
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const copyToClipboard = async () => {
    const selectedWalletData = wallets.find((w) => w.id === selectedWallet);
    if (!selectedWalletData) return;

    try {
      await navigator.clipboard.writeText(selectedWalletData.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const shareAddress = async () => {
    const selectedWalletData = wallets.find((w) => w.id === selectedWallet);
    if (!selectedWalletData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Wallet Address',
          text: `Send ${selectedWalletData.blockchain} to: ${selectedWalletData.address}`,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const downloadQRCode = () => {
    if (!canvasRef.current) return;

    const selectedWalletData = wallets.find((w) => w.id === selectedWallet);
    if (!selectedWalletData) return;

    const link = document.createElement('a');
    link.download = `celora-${selectedWalletData.blockchain}-qr.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Receive Crypto</h1>
          <p className="text-gray-400">Share your wallet address to receive funds</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left - Wallet selection & QR code */}
          <div className="space-y-6">
            {/* Wallet selection */}
            <div className="modern-card p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Select Wallet</h2>

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
                        <div className="font-bold text-white mb-1 capitalize">
                          {wallet.blockchain} {wallet.label && `- ${wallet.label}`}
                        </div>
                        <div className="text-sm text-gray-400">
                          {wallet.balance.toFixed(4)} {wallet.blockchain.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-3xl">
                        {wallet.blockchain.toLowerCase() === 'solana'
                          ? '◎'
                          : wallet.blockchain.toLowerCase() === 'ethereum'
                          ? 'Ξ'
                          : '₿'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {wallets.length === 0 && (
                <div className="text-center py-8 text-gray-400">
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

            {/* QR Code */}
            {selectedWalletData && (
              <div className="modern-card p-6 space-y-4">
                <h2 className="text-xl font-bold text-white">QR Code</h2>
                <p className="text-sm text-gray-400">
                  Scan this code with a crypto wallet to send funds
                </p>

                <div className="flex justify-center">
                  <div className="p-6 bg-white rounded-2xl">
                    <canvas ref={canvasRef}></canvas>
                  </div>
                </div>

                <button
                  onClick={downloadQRCode}
                  className="btn-outline w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Download QR Code
                </button>
              </div>
            )}
          </div>

          {/* Right - Address & options */}
          <div className="space-y-6">
            {/* Address */}
            {selectedWalletData && (
              <div className="modern-card p-6 space-y-4">
                <h2 className="text-xl font-bold text-white">Wallet Address</h2>

                <div className="p-4 bg-dark-surface rounded-lg">
                  <div className="text-sm text-gray-400 mb-2 uppercase">
                    {selectedWalletData.blockchain} Address
                  </div>
                  <div className="text-white font-mono text-sm break-all">
                    {selectedWalletData.address}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copyToClipboard}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy Address
                      </>
                    )}
                  </button>
                  <button
                    onClick={shareAddress}
                    className="btn-outline flex-1 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            )}

            {/* Request specific amount (optional) */}
            {selectedWalletData && selectedWalletData.blockchain.toLowerCase() === 'solana' && (
              <div className="modern-card p-6 space-y-4">
                <h2 className="text-xl font-bold text-white">Request Specific Amount (Optional)</h2>
                <p className="text-sm text-gray-400">
                  Add amount and memo to your QR code for easy payment requests
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (SOL)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="neon-input w-full px-4 py-3"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Memo (Optional)
                  </label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Invoice #, description..."
                    className="neon-input w-full px-4 py-3"
                    maxLength={100}
                  />
                </div>

                {(amount || memo) && (
                  <button
                    onClick={() => {
                      setAmount('');
                      setMemo('');
                    }}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Clear request details
                  </button>
                )}
              </div>
            )}

            {/* Important info */}
            <div className="modern-card p-6 space-y-3 bg-gradient-to-br from-purple-glow/5 to-cyan-primary/5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-cyan-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-white mb-1">Important</h3>
                  <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                    <li>Only send {selectedWalletData?.blockchain} to this address</li>
                    <li>Sending other cryptocurrencies may result in permanent loss</li>
                    <li>Transactions are irreversible once confirmed</li>
                    <li>Always verify the address before sending funds</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
