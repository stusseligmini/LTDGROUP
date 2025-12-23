'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Fallback alert inline (avoid missing dependency). Replace with project Alert if available.
interface InlineAlertProps { children: React.ReactNode; destructive?: boolean; }
function InlineAlert({ children, destructive }: InlineAlertProps) {
  return (
    <div className={`rounded border px-3 py-2 text-sm ${destructive ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300 bg-gray-50 text-gray-700'}`}>{children}</div>
  );
}
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Lock, Unlock, Loader2 } from 'lucide-react';
import { getSolanaAddress, loadEncryptedMnemonic } from '@/lib/clientKeyManagement';
import { resolveUsername } from '@/lib/username/client';

interface ReceiveAddressProps {
  walletId: string; // Local encrypted wallet identifier
  address?: string; // If already known (no password needed)
  showUsername?: boolean; // Attempt username resolution
  blockchain?: 'solana'; // Future multi-chain support
  className?: string;
}

/**
 * Display a wallet receive address with QR code & copy helper.
 * - Does NOT expose mnemonic.
 * - Requires password if address not supplied and only encrypted mnemonic exists.
 */
export function ReceiveAddress({
  walletId,
  address: providedAddress,
  showUsername = true,
  blockchain = 'solana',
  className,
}: ReceiveAddressProps) {
  const [address, setAddress] = useState<string>(providedAddress || '');
  const [password, setPassword] = useState('');
  const [unlockNeeded, setUnlockNeeded] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [resolvingUsername, setResolvingUsername] = useState(false);

  // Determine if we need password unlock
  useEffect(() => {
    if (providedAddress) return;
    const stored = loadEncryptedMnemonic(walletId);
    setUnlockNeeded(!!stored && !providedAddress);
  }, [walletId, providedAddress]);

  // Resolve username (best-effort)
  useEffect(() => {
    if (!showUsername || !address) return;
    setResolvingUsername(true);
    resolveUsername(address) // In current design usernames map to addresses; if mismatch, skip.
      .then(resolved => {
        // resolveUsername returns a public address; for reverse lookup you'd need an API.
        // Here we simply treat presence of user mapping equality as username not available.
        if (resolved && resolved === address) {
          setUsername(null); // Cannot infer reverse username from address with current API
        } else {
          setUsername(null);
        }
      })
      .catch(() => setUsername(null))
      .finally(() => setResolvingUsername(false));
  }, [address, showUsername]);

  const handleUnlock = async () => {
    if (!password) {
      setError('Enter password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const addr = await getSolanaAddress(walletId, password);
      if (!addr) throw new Error('Failed to derive address');
      setAddress(addr);
      setUnlockNeeded(false);
      setPassword('');
    } catch (e: any) {
      setError(e.message || 'Unlock failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const qrValue = address || 'waiting';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Receive {blockchain === 'solana' ? 'SOL' : 'Crypto'}</CardTitle>
        <CardDescription>Your public address & QR code for deposits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unlockNeeded && !address && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Lock className="h-4 w-4" /> Encrypted locally – unlock to derive address</p>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Wallet password"
              disabled={loading}
              autoComplete="current-password"
            />
            <Button onClick={handleUnlock} disabled={loading || !password} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Unlocking...</> : <><Unlock className="h-4 w-4 mr-2" /> Unlock Address</>}
            </Button>
              {error && (
                <InlineAlert destructive>{error}</InlineAlert>
              )}
          </div>
        )}

        {address && (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded border shadow-sm">
              <QRCodeSVG value={qrValue} size={160} includeMargin level="M" />
            </div>
            <div className="w-full">
              <p className="text-xs uppercase text-muted-foreground mb-1">Public Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-sm bg-gray-50 rounded px-2 py-1 border">
                  {address}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={!address}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && <p className="text-green-600 text-xs mt-1">Copied</p>}
            </div>
            {showUsername && (
              <div className="text-xs text-muted-foreground">
                {resolvingUsername ? 'Checking username…' : username ? `Username: ${username}` : 'No username mapping'}
              </div>
            )}
            <p className="text-xs text-amber-600 mt-2">Never share your recovery phrase. This is safe to share.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
