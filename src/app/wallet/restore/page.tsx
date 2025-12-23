"use client";
import React, { useState } from 'react';
import { readManifestFile } from '../../../lib/backup';
import { WalletEncryption } from '@/lib/wallet/nonCustodialWallet';

export default function RestorePage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRestore() {
    try {
      setError(null); setDecrypted(null);
      if (!file) throw new Error('Select a manifest file');
      const manifest = await readManifestFile(file);
      if (!manifest.encryptedSeed) throw new Error('Manifest missing encrypted seed');
      if (!password) throw new Error('Enter your encryption password');
      // encryptedSeed packed as base64; no salt/iv in manifest, so unsupported here unless included
      // For this MVP, we expect the user to restore via local storage flow or include salt+iv in metadata.
      const { salt, iv } = (manifest.metadata || {}) as any;
      if (!salt || !iv) throw new Error('Manifest missing salt/iv metadata needed to decrypt');
      const plain = await WalletEncryption.decrypt(manifest.encryptedSeed, password, salt, iv);
      setDecrypted(plain);
    } catch (e: any) {
      setError(e.message || 'Restore failed');
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Restore from Backup</h1>
      <p className="text-sm text-gray-600">Select your recovery manifest and enter the password you used during backup.</p>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <input
        className="w-full border rounded p-2"
        type="password"
        placeholder="encryption password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="bg-black text-white px-4 py-2 rounded" onClick={onRestore}>Restore</button>
      {decrypted && (
        <div className="text-sm bg-gray-50 border p-2 rounded">
          <div className="font-semibold">Decrypted Seed (Keep Secret)</div>
          <div className="font-mono break-all">{decrypted}</div>
        </div>
      )}
      {error && <div className="text-red-700 text-sm">{error}</div>}
      <div className="text-xs text-gray-500">Store manifests offline; never upload them unencrypted.</div>
    </div>
  );
}