'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deriveSolanaWallet } from '@/lib/solana/solanaWallet';
import { getSolanaConnection, sendSol } from '@/lib/solana/solanaWallet';
import { estimatePriorityFeeMicroLamports } from '@/lib/solana/solanaWallet';
import { getTokenPrice, formatPrice } from '@/lib/prices/coingecko';
import { envFlags } from '@/lib/env/flags';
import { resolveUsername } from '@/lib/username';
import { getWalletFromLocal as retrieveWalletLocally, WalletEncryption } from '@/lib/wallet/nonCustodialWallet';
import { PublicKey } from '@solana/web3.js';
import { Loader2, Send, DollarSign, Zap } from 'lucide-react';

interface SendTransactionProps {
  walletId?: string;
  onSuccess?: (signature: string) => void;
  prefilledRecipient?: string;
  prefilledAmount?: string;
  readonlyRecipient?: boolean;
}

export function SendTransaction({ walletId, onSuccess, prefilledRecipient, prefilledAmount, readonlyRecipient }: SendTransactionProps) {
  const [recipient, setRecipient] = useState(prefilledRecipient || '');
  const [amount, setAmount] = useState(prefilledAmount || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [estimatedFee, setEstimatedFee] = useState<number>(0);
  const [priorityFeeLevel, setPriorityFeeLevel] = useState<'none' | 'low' | 'medium' | 'high'>('medium');
  const [solPrice, setSolPrice] = useState<number>(0);
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [resolvingUsername, setResolvingUsername] = useState(false);

  // Fetch SOL price
  useEffect(() => {
    if (envFlags.disablePrices) return;
    getTokenPrice('SOL').then(price => {
      if (price) setSolPrice(price.usd);
    });
  }, []);

  // Estimate priority fee
  useEffect(() => {
    estimatePriorityFeeMicroLamports().then(fee => setEstimatedFee(fee));
  }, []);

  // Resolve username or validate address
  useEffect(() => {
    if (!recipient.trim()) {
      setResolvedAddress('');
      return;
    }

    const trimmed = recipient.trim();
    
    // Check if it's a username (@user or user)
    if (trimmed.startsWith('@') || !trimmed.includes('.')) {
      setResolvingUsername(true);
      const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
      
      resolveUsername(username)
        .then(address => {
          if (address) {
            setResolvedAddress(address as any);
            setError('');
          } else {
            setError(`Username @${username} not found`);
            setResolvedAddress('');
          }
        })
        .catch(() => {
          setError('Failed to resolve username');
          setResolvedAddress('');
        })
        .finally(() => setResolvingUsername(false));
    } else {
      // Validate Solana address
      try {
        new PublicKey(trimmed);
        setResolvedAddress(trimmed);
        setError('');
      } catch {
        setError('Invalid Solana address');
        setResolvedAddress('');
      }
    }
  }, [recipient]);

  const getPriorityFeeAmount = (): number => {
    switch (priorityFeeLevel) {
      case 'none': return 0;
      case 'low': return estimatedFee;
      case 'medium': return estimatedFee * 1.5;
      case 'high': return estimatedFee * 2;
      default: return estimatedFee;
    }
  };

  const totalFee = (0.000005 + (getPriorityFeeAmount() / 1_000_000_000)); // Base fee + priority
  const usdAmount = parseFloat(amount || '0') * solPrice;
  const usdFee = totalFee * solPrice;

  const handleSend = async () => {
    if (!resolvedAddress) {
      setError('Please enter a valid recipient address or username');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!password) {
      setError('Please enter your wallet password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Retrieve and decrypt wallet
      const stored = retrieveWalletLocally(walletId || 'default');
      if (!stored) {
        throw new Error('Wallet not found. Please create or import a wallet first.');
      }

      const decryptedMnemonic = await WalletEncryption.decrypt(
        stored.encryptedMnemonic,
        password,
        stored.salt,
        stored.iv
      );

      // Derive Solana wallet
      const solanaWallet = await deriveSolanaWallet(decryptedMnemonic, 0);

      // Send transaction
      const { signature } = await sendSol(
        solanaWallet,
        resolvedAddress,
        parseFloat(amount),
        {
          priorityFeeMicroLamports: getPriorityFeeAmount(),
          maxRetries: 3,
          skipPreflight: false,
        }
      );

      setSuccess(`Transaction successful! Signature: ${signature}`);
      setAmount('');
      setRecipient('');
      setPassword('');
      
      if (onSuccess) {
        onSuccess(signature);
      }
    } catch (err: any) {
      console.error('Send error:', err);
      if (err.message?.includes('decrypt')) {
        setError('Incorrect password');
      } else {
        setError(err.message || 'Transaction failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send SOL
        </CardTitle>
        <CardDescription>Send Solana to an address or username</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipient */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Recipient (Address or @username)
          </label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Address or @username"
            disabled={loading || readonlyRecipient}
            readOnly={readonlyRecipient}
          />
          {resolvingUsername && (
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Resolving username...
            </div>
          )}
          {resolvedAddress && recipient.trim() !== resolvedAddress && (
            <div className="mt-1 text-sm text-green-600 break-all">
              ✓ {resolvedAddress.slice(0, 8)}...{resolvedAddress.slice(-8)}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium mb-2">Amount (SOL)</label>
          <div className="relative">
            <Input
              type="number"
              step="0.000001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={loading}
            />
            {usdAmount > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatPrice(usdAmount)}
              </div>
            )}
          </div>
        </div>

        {/* Priority Fee */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Priority Fee (Speed)
          </label>
          <Select value={priorityFeeLevel} onValueChange={(v: any) => setPriorityFeeLevel(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Slow) - Free</SelectItem>
              <SelectItem value="low">Low - ~{formatPrice((estimatedFee / 1_000_000_000) * solPrice)}</SelectItem>
              <SelectItem value="medium">Medium (Recommended) - ~{formatPrice((estimatedFee * 1.5 / 1_000_000_000) * solPrice)}</SelectItem>
              <SelectItem value="high">High (Instant) - ~{formatPrice((estimatedFee * 2 / 1_000_000_000) * solPrice)}</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-1 text-sm text-muted-foreground">
            Total fee: ~{totalFee.toFixed(9)} SOL ({formatPrice(usdFee)})
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2">Wallet Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to sign"
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        {/* Error/Success */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription className="break-all">{success}</AlertDescription>
          </Alert>
        )}

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!resolvedAddress || !amount || !password || loading || resolvingUsername}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send {amount || '0'} SOL
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
