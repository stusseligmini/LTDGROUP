"use client";
import React, { useState } from 'react';
import { createRecoveryManifest, downloadManifest } from '../../../lib/backup';
import { useAuthContext } from '@/providers/AuthProvider';
import { WalletEncryption, getWalletFromLocal } from '@/lib/wallet/nonCustodialWallet';

export default function BackupPage() {
  const { user } = useAuthContext();
  const [walletId, setWalletId] = useState('');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBackup() {
    setStatus(null); setError(null);
    try {
      if (!walletId) throw new Error('Enter wallet ID to backup');
      const local = getWalletFromLocal(walletId);
      if (!local) throw new Error('No local encrypted mnemonic for this wallet');
      // Manifest contains encryptedSeed only; password is NOT exported
      const manifest = createRecoveryManifest({
        chain: 'solana',
        walletAddress: 'unknown',
        encryptedSeed: local.encryptedMnemonic,
        encryptionMethod: 'aes-gcm',
        username: username || undefined,
        metadata: { walletId }
      });
      downloadManifest(manifest);
      setStatus('Backup exported as recovery-manifest.json');
    } catch (e: any) {
      setError(e.message || 'Backup failed');
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Backup Wallet</h1>
      <p className="text-sm text-gray-600">Export an encrypted recovery manifest you can store offline. Keep your password separately.</p>
      <input
        className="w-full border rounded p-2"
        placeholder="wallet id (from creation)"
        value={walletId}
        onChange={(e) => setWalletId(e.target.value)}
      />
      <input
        className="w-full border rounded p-2"
        placeholder="optional username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button className="bg-black text-white px-4 py-2 rounded" onClick={handleBackup}>Export Backup</button>
      {status && <div className="text-green-700 text-sm">{status}</div>}
      {error && <div className="text-red-700 text-sm">{error}</div>}
      <div className="text-xs text-gray-500">Never share your manifest. It still requires your password to decrypt.</div>
    </div>
  );
}