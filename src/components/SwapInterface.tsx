'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { logger } from '@/lib/logger';

interface Wallet {
  id: string;
  blockchain: string;
  address: string;
  label: string | null;
  isDefault: boolean;
}

export default function SwapInterface() {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [loadingWallets, setLoadingWallets] = useState(false);

  // Fetch wallets on component mount
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchWallets = async () => {
      setLoadingWallets(true);
      try {
        const response = await axios.get('/api/wallet/list', {
          signal: controller.signal,
          timeout: 8000,
        }) as { data: { success: boolean; data: { wallets: Wallet[] } } };
        if (response.data.success && response.data.data.wallets) {
          const walletList = response.data.data.wallets;
          setWallets(walletList);
          // Auto-select default wallet or first wallet
          const defaultWallet = walletList.find(w => w.isDefault) || walletList[0];
          if (defaultWallet) {
            setSelectedWalletId(defaultWallet.id);
          }
        }
      } catch (error) {
        if (axios.isCancel(error)) {
          return; // Request cancelled
        }
        logger.error('Error fetching wallets', error instanceof Error ? error : undefined);
      } finally {
        setLoadingWallets(false);
      }
    };

    fetchWallets();
    return () => controller.abort();
  }, []);

  const handleGetQuote = async () => {
    if (!amount) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/swap/quote', {
        blockchain: 'ethereum',
        fromToken,
        toToken,
        amount,
      }, {
        timeout: 8000,
      });

      setQuote(response.data.quote);
    } catch (error) {
      if (axios.isCancel(error)) {
        alert('Request timed out. Please try again.');
        return;
      }
      logger.error('Error getting quote', error instanceof Error ? error : undefined, { 
        blockchain: 'ethereum', 
        fromToken, 
        toToken 
      });
      alert('Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!quote || !selectedWalletId) {
      alert('Please select a wallet');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/swap', {
        blockchain: 'ethereum',
        fromToken,
        toToken,
        amount,
        quoteResponse: quote,
        walletId: selectedWalletId,
      }, {
        timeout: 8000,
      });

      if (response.data.success) {
        alert(`Swap executed! Transaction: ${response.data.data.txHash}`);
        setQuote(null);
        setAmount('');
      } else {
        alert(`Swap failed: ${response.data.error}`);
      }
    } catch (error: any) {
      if (axios.isCancel(error)) {
        alert('Request timed out. Please try again.');
        return;
      }
      logger.error('Error executing swap', error instanceof Error ? error : undefined, { 
        blockchain: 'ethereum', 
        fromToken, 
        toToken 
      });
      alert(`Swap failed: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">Swap Tokens</h2>

        {/* Wallet Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Wallet</label>
          <select
            value={selectedWalletId}
            onChange={(e) => setSelectedWalletId(e.target.value)}
            disabled={loadingWallets || wallets.length === 0}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingWallets ? (
              <option>Loading wallets...</option>
            ) : wallets.length === 0 ? (
              <option>No wallets available</option>
            ) : (
              <>
                <option value="">Select a wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.label || `${wallet.blockchain} - ${wallet.address.slice(0, 8)}...`}
                    {wallet.isDefault ? ' (Default)' : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* From Token */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
            </select>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center my-4">
          <button
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
            }}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
          >
            ↓
          </button>
        </div>

        {/* To Token */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={quote?.outputAmount || '0.0'}
              disabled
              placeholder="0.0"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
            />
            <select
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
            </select>
          </div>
        </div>

        {/* Quote Info */}
        {quote && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Price Impact</span>
              <span className={quote.priceImpact > 2 ? 'text-red-600' : 'text-gray-900'}>
                {quote.priceImpact?.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estimated Gas</span>
              <span className="text-gray-900">{quote.estimatedGas || 'N/A'}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleGetQuote}
            disabled={loading || !amount}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Getting Quote...' : 'Get Quote'}
          </button>

          {quote && (
            <button
              onClick={handleSwap}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Swap Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}









