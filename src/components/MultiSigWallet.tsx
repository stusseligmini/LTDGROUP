'use client';

import React, { useState, useEffect } from 'react';
import multisigService from '@/server/services/multisigService';
import { logger } from '@/lib/logger';

export default function MultiSigWallet({ walletId }: { walletId: string }) {
  const [wallet, setWallet] = useState<any>(null);
  const [pendingTxs, setPendingTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadWalletData(controller.signal);
    return () => controller.abort();
  }, [walletId]);

  const loadWalletData = async (signal?: AbortSignal) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      
      const dataPromise = Promise.all([
        multisigService.getMultiSigWallet(walletId),
        multisigService.getPendingTransactions(walletId),
      ]);
      
      const [walletData, txs] = await Promise.race([
        dataPromise,
        timeoutPromise,
      ]) as [any, any];
      
      if (signal?.aborted) return;
      
      setWallet(walletData);
      setPendingTxs(txs);
    } catch (error) {
      if (signal?.aborted) return;
      logger.error('Error loading wallet data', error instanceof Error ? error : undefined, { walletId });
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (txId: string, signerAddress: string) => {
    try {
      await multisigService.signTransaction(txId, signerAddress);
      await loadWalletData();
      alert('Transaction signed successfully!');
    } catch (error) {
      alert('Failed to sign transaction');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!wallet) return <div>Wallet not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Multi-Sig Wallet</h2>

      {/* Wallet Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Wallet Details</h3>
        <div className="space-y-2">
          <p><span className="font-semibold">Address:</span> {wallet.address}</p>
          <p><span className="font-semibold">Required Signatures:</span> {wallet.requiredSignatures} / {wallet.totalSigners}</p>
          <p><span className="font-semibold">Blockchain:</span> {wallet.blockchain}</p>
        </div>
      </div>

      {/* Signers */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Signers</h3>
        <div className="space-y-2">
          {wallet.multiSigSigners?.map((signer: any) => (
            <div key={signer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <p className="font-semibold">{signer.name || 'Unnamed'}</p>
                <p className="text-sm text-gray-600 font-mono">{signer.address}</p>
              </div>
              {signer.isActive && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Active</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Pending Transactions</h3>
        {pendingTxs.length === 0 ? (
          <p className="text-gray-500">No pending transactions</p>
        ) : (
          <div className="space-y-4">
            {pendingTxs.map((tx) => (
              <div key={tx.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold">To: {tx.toAddress}</p>
                    <p className="text-lg font-bold text-indigo-600">{tx.amount} {tx.blockchain}</p>
                    {tx.memo && <p className="text-sm text-gray-600">{tx.memo}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Signatures</p>
                    <p className="text-lg font-semibold">{tx.currentSigs} / {tx.requiredSigs}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 mb-3">
                  {tx.signedBy.map((addr: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                      ✓ {addr.slice(0, 6)}...{addr.slice(-4)}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleSign(tx.id, 'current-user-address')}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Sign Transaction
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

