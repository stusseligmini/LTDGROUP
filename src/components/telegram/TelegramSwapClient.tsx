'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Lock, Unlock } from 'lucide-react';
import { getTelegramWebApp, showBackButton, hideBackButton } from '@/lib/telegram/webapp';
import { getSolanaAddress, loadEncryptedMnemonic, decryptMnemonic } from '@/lib/clientKeyManagement';
import { deriveSolanaWallet } from '@/lib/solana/solanaWallet';
import { appFetch } from '@/lib/network/appFetch';

interface Quote {
  outputAmount: string;
  minimumReceived: string;
  priceImpact: number;
  executionPrice: number;
}

const TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERZzW1Yw4qF9hQxNxqzqH7h1gW4P3AfkG', decimals: 6 },
];

interface TelegramSwapClientProps {
  walletId: string;
}

export function TelegramSwapClient({ walletId }: TelegramSwapClientProps) {
  const router = useRouter();
  const [fromMint, setFromMint] = useState(TOKENS[0].mint);
  const [toMint, setToMint] = useState(TOKENS[1].mint);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50);
  const [password, setPassword] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'preview' | 'confirm' | 'success'>('input');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    const onBack = () => router.back();
    showBackButton(onBack);
    return () => hideBackButton();
  }, [router]);

  const fetchQuote = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Enter amount');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const fromTokenInfo = TOKENS.find(t => t.mint === fromMint);
      if (!fromTokenInfo) throw new Error('Unsupported from token');
      const atomicAmount = BigInt(Math.floor(Number(amount) * 10 ** fromTokenInfo.decimals)).toString();

          const res = await appFetch('/api/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockchain: 'solana',
          fromToken: fromMint,
          toToken: toMint,
          amount: atomicAmount,
        }),
      });

      if (!res.ok) throw new Error('Failed to get quote');
      const data = await res.json();
      const q = data.data?.quote || data.quote;
      if (!q) throw new Error('Invalid quote');

      const toInfo = TOKENS.find(t => t.mint === toMint);
      const outputAmount = (Number(q.outputAmount) / (toInfo?.decimals ? 10 ** toInfo.decimals : 1)).toFixed(6);
      const slippagePercent = slippageBps / 10000;
      const minReceived = (Number(q.outputAmount) * (1 - slippagePercent) / (toInfo?.decimals ? 10 ** toInfo.decimals : 1)).toFixed(6);

      setQuote({
        outputAmount,
        minimumReceived: minReceived,
        priceImpact: q.priceImpactPct || 0,
        executionPrice: Number(q.outAmount) / Number(q.inAmount),
      });
      setStep('preview');
    } catch (e: any) {
      setError(e.message || 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!quote || !password) {
      setError('Missing quote or password');
      return;
    }

    setExecuting(true);
    setError('');
    let mnemonic = '';
    try {
      // Get and decrypt mnemonic
      const encrypted = loadEncryptedMnemonic(walletId);
      if (!encrypted) throw new Error('Wallet not found');

      mnemonic = await decryptMnemonic(
        encrypted.encryptedMnemonic || (encrypted as any).encrypted,
        password,
        encrypted.salt,
        encrypted.iv
      );

      const solWallet = await deriveSolanaWallet(mnemonic, 0);

      // Build and sign transaction
      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: { /* quote data */ },
          userPublicKey: solWallet.address,
          wrapAndUnwrapSol: true,
          slippageBps,
        }),
      });

      if (!swapRes.ok) throw new Error('Swap build failed');
      const swapJson = await swapRes.json();
      const swapTransactionBase64 = swapJson.swapTransaction;

      const { VersionedTransaction } = await import('@solana/web3.js');
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTransactionBase64, 'base64'));
      tx.sign([solWallet.keypair]);

      // Broadcast
          const executeRes = await appFetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          blockchain: 'solana',
          fromToken: fromMint,
          toToken: toMint,
          amount: '',
          signedTransaction: Buffer.from(tx.serialize()).toString('base64'),
        }),
      });

      if (!executeRes.ok) throw new Error('Broadcast failed');
      const result = await executeRes.json();
      const hash = result.data?.txHash;

      setTxHash(hash);
      setStep('success');
      setPassword('');
    } catch (e: any) {
      setError(e.message || 'Swap failed');
    } finally {
      mnemonic = '';
      setExecuting(false);
    }
  };

  const viewExplorer = () => {
    window.open(`https://solscan.io/tx/${txHash}?cluster=mainnet`);
  };

  const goBack = () => {
    if (step === 'input') {
      router.back();
    } else if (step === 'preview') {
      setStep('input');
      setQuote(null);
    } else if (step === 'confirm') {
      setStep('preview');
    }
  };

  // INPUT STEP
  if (step === 'input') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Swap Tokens</h1>
          <button onClick={goBack} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          {/* From Token */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <label className="text-xs text-gray-400 mb-2 block">From</label>
            <select 
              value={fromMint} 
              onChange={(e) => setFromMint(e.target.value)}
              className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600 mb-2"
            >
              {TOKENS.map(t => <option key={t.mint} value={t.mint}>{t.symbol}</option>)}
            </select>
            <input 
              type="number" 
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600"
            />
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center">
            <button 
              onClick={() => {
                setFromMint(toMint);
                setToMint(fromMint);
              }}
              className="bg-cyan-600 hover:bg-cyan-700 p-2 rounded-full"
            >
              <ArrowRight className="h-5 w-5 rotate-90" />
            </button>
          </div>

          {/* To Token */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <label className="text-xs text-gray-400 mb-2 block">To</label>
            <select 
              value={toMint} 
              onChange={(e) => setToMint(e.target.value)}
              className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600 mb-2"
            >
              {TOKENS.map(t => <option key={t.mint} value={t.mint}>{t.symbol}</option>)}
            </select>
            <div className="bg-slate-700 text-gray-400 p-3 rounded-lg border border-slate-600">
              Calculate quote below
            </div>
          </div>

          {/* Slippage */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <label className="text-xs text-gray-400 mb-2 block">Slippage (bps)</label>
            <input 
              type="number" 
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600"
            />
            <p className="text-xs text-gray-500 mt-1">50 bps = 0.5%</p>
          </div>

          {error && <div className="text-sm text-red-500 bg-red-900/30 p-3 rounded">{error}</div>}

          <button 
            onClick={fetchQuote}
            disabled={loading || !amount}
            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold p-3 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting quote...</> : 'Get Quote'}
          </button>
        </div>
      </div>
    );
  }

  // PREVIEW STEP
  if (step === 'preview' && quote) {
    const fromToken = TOKENS.find(t => t.mint === fromMint);
    const toToken = TOKENS.find(t => t.mint === toMint);

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Review Swap</h1>
          <button onClick={goBack} className="text-gray-400 hover:text-white">←</button>
        </div>

        <div className="space-y-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex justify-between">
            <span className="text-gray-400">You send</span>
            <span className="font-semibold">{amount} {fromToken?.symbol}</span>
          </div>
          <div className="h-px bg-slate-700"></div>
          <div className="flex justify-between">
            <span className="text-gray-400">You&apos;ll receive</span>
            <span className="font-semibold text-lg">{quote.outputAmount} {toToken?.symbol}</span>
          </div>
          <div className="h-px bg-slate-700"></div>
          <div className="flex justify-between">
            <span className="text-gray-400">Minimum received</span>
            <span className="text-sm">{quote.minimumReceived} {toToken?.symbol}</span>
          </div>
          <div className="h-px bg-slate-700"></div>
          <div className="flex justify-between">
            <span className="text-gray-400">Price impact</span>
            <span className={quote.priceImpact > 5 ? 'text-red-500' : quote.priceImpact > 2 ? 'text-yellow-500' : 'text-green-500'}>
              {(quote.priceImpact * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        <button 
          onClick={() => setStep('confirm')}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-3 rounded-lg"
        >
          Confirm Swap
        </button>

        <button 
          onClick={goBack}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg"
        >
          Back
        </button>
      </div>
    );
  }

  // CONFIRM STEP
  if (step === 'confirm' && quote) {
    const toToken = TOKENS.find(t => t.mint === toMint);

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 space-y-4">
        <h1 className="text-2xl font-bold">Sign Transaction</h1>

        <div className="bg-cyan-600/20 border border-cyan-500 rounded-xl p-4">
          <p className="text-sm text-cyan-200">
            You&apos;re about to receive <span className="font-bold">{quote.outputAmount} {toToken?.symbol}</span>
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <label className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Wallet Password
          </label>
          <input 
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600"
          />
        </div>

        {error && <div className="text-sm text-red-500 bg-red-900/30 p-3 rounded">{error}</div>}

        <button 
          onClick={executeSwap}
          disabled={executing || !password}
          className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold p-3 rounded-lg flex items-center justify-center gap-2"
        >
          {executing ? <><Loader2 className="h-4 w-4 animate-spin" /> Executing...</> : 'Execute Swap'}
        </button>

        <button 
          onClick={() => setStep('preview')}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg"
        >
          Back
        </button>
      </div>
    );
  }

  // SUCCESS STEP
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex flex-col justify-between">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="text-6xl">✓</div>
            <h1 className="text-3xl font-bold">Swap Complete!</h1>
            <p className="text-gray-400">Your tokens are being swapped</p>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-left">
              <div className="font-mono text-sm text-gray-400 break-all">{txHash.substring(0, 20)}...</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <button 
            onClick={viewExplorer}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-3 rounded-lg"
          >
            View on Solscan
          </button>

          <button 
            onClick={() => router.push('/telegram')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
