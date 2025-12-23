"use client";
import React, { useMemo, useState } from 'react';
import { normalizeMnemonic, isLikelyValidMnemonic } from '../../lib/seed';

interface Props {
  originalMnemonic: string;
  onVerified: (normalizedWords: string[]) => void;
}

export default function SeedVerify({ originalMnemonic, onVerified }: Props) {
  const originalWords = useMemo(() => normalizeMnemonic(originalMnemonic), [originalMnemonic]);
  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmWords = useMemo(() => normalizeMnemonic(confirmInput), [confirmInput]);
  const looksValid = isLikelyValidMnemonic(confirmWords);
  const matches = looksValid && confirmWords.join(' ') === originalWords.join(' ');

  function handleVerify() {
    if (!looksValid) {
      setError('Confirmation phrase format looks invalid.');
      return;
    }
    if (!matches) {
      setError('Phrases do not match. Double-check your words.');
      return;
    }
    setError(null);
    onVerified(confirmWords);
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Confirm Your Seed Phrase</h2>
      <p className="text-sm text-gray-600">Re-enter your seed phrase to ensure you have correctly recorded it. This prevents loss due to typos or missing words.</p>
      <div className="bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800 rounded">
        Security tip: Never store your seed in screenshots or cloud notes. Prefer paper in a safe place or a hardware metal backup.
      </div>
      <textarea
        value={confirmInput}
        onChange={(e) => setConfirmInput(e.target.value)}
        rows={4}
        className="w-full border rounded p-2"
        placeholder="re-enter your seed phrase"
      />
      <div className="text-sm">
        <div>Words: {confirmWords.length}</div>
        <div>Format valid: {looksValid ? 'Yes' : 'No'}</div>
        <div>Matches original: {matches ? 'Yes' : 'No'}</div>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        onClick={handleVerify}
        disabled={!matches}
      >
        Confirm
      </button>
    </div>
  );
}