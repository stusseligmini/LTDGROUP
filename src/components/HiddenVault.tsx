/**
 * Hidden Vault Component
 * PIN-protected wallet access
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import api from '@/lib/apiClient';

interface HiddenVaultProps {
  walletId: string;
  onUnlocked?: (token: string) => void;
}

export function HiddenVault({ walletId, onUnlocked }: HiddenVaultProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<{
    isHidden: boolean;
    vaultLevel: number;
    hasPinSet: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'unlock' | 'setup'>('unlock');

  const loadVaultStatus = useCallback(async () => {
    try {
      const data = await api.get<{ isHidden: boolean; vaultLevel: number; hasPinSet: boolean }>(
        `/wallet/vault?walletId=${walletId}`
      );
      if (data) {
        setVaultStatus(data);
        setMode(data.hasPinSet ? 'unlock' : 'setup');
      }
    } catch (err) {
      logger.error('Failed to load vault status', err instanceof Error ? err : undefined, { walletId });
    }
  }, [walletId]);

  useEffect(() => {
    loadVaultStatus();
  }, [walletId, loadVaultStatus]);

  const handleSetupPin = async () => {
    setError('');

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    // Check for weak PIN
    const weakPatterns = ['000000', '111111', '123456', '654321'];
    if (weakPatterns.includes(pin)) {
      setError('PIN is too weak. Please choose a different PIN');
      return;
    }

    try {
      setLoading(true);

      const data = await api.post<{ success?: boolean }>(
        '/wallet/vault/set-pin',
        { walletId, pin, confirmPin }
      );

      if (data) {
        setPin('');
        setConfirmPin('');
        setMode('unlock');
        await loadVaultStatus();
      } else {
        setError('Failed to set PIN');
      }
    } catch (err) {
      setError('Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    setError('');

    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    try {
      setLoading(true);

      const data = await api.put<{ token: string | undefined }>(
        '/wallet/vault/unlock',
        { walletId, pin }
      );

      if (data) {
        setIsUnlocked(true);
        setPin('');
        
        if (onUnlocked && (data as any).token) {
          onUnlocked((data as any).token);
        }

        // Auto-lock after 5 minutes
        setTimeout(() => {
          setIsUnlocked(false);
        }, 5 * 60 * 1000);
      } else {
        setError((data as any).error || 'Incorrect PIN');
      }
    } catch (err) {
      setError('Failed to unlock vault. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string) => {
    // Only allow digits and max 6 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setError('');
  };

  const handleConfirmPinInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setConfirmPin(cleaned);
    setError('');
  };

  if (isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>🔓</span> Vault Unlocked
              </CardTitle>
              <CardDescription>Your hidden vault is accessible</CardDescription>
            </div>
            <Badge className="bg-green-500">Unlocked</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Vault will automatically lock after 5 minutes of inactivity.
          </p>
          <Button 
            onClick={() => setIsUnlocked(false)} 
            variant="outline"
            className="w-full"
          >
            Lock Vault
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!vaultStatus) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Loading vault...</p>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'setup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Hidden Vault</CardTitle>
          <CardDescription>
            Create a 6-digit PIN to protect your hidden wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pin">PIN (6 digits)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinInput(e.target.value)}
              placeholder="••••••"
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <div>
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => handleConfirmPinInput(e.target.value)}
              placeholder="••••••"
              className="text-center text-2xl tracking-widest"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-900">
            <p className="font-medium mb-1">⚠️ Important:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Choose a PIN you can remember</li>
              <li>Avoid simple patterns like 123456</li>
              <li>This PIN cannot be recovered if forgotten</li>
            </ul>
          </div>

          <Button 
            onClick={handleSetupPin} 
            disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
            className="w-full"
          >
            {loading ? 'Setting up...' : 'Set PIN'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>🔒</span> Hidden Vault
            </CardTitle>
            <CardDescription>
              Enter your PIN to access hidden wallet
            </CardDescription>
          </div>
          {vaultStatus.isHidden && (
            <Badge className="bg-yellow-500">
              Level {vaultStatus.vaultLevel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="unlockPin">PIN</Label>
          <Input
            id="unlockPin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => handlePinInput(e.target.value)}
            placeholder="••••••"
            className="text-center text-2xl tracking-widest"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pin.length === 6) {
                handleUnlock();
              }
            }}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <Button 
          onClick={handleUnlock} 
          disabled={loading || pin.length !== 6}
          className="w-full"
        >
          {loading ? 'Unlocking...' : 'Unlock Vault'}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          Forgot your PIN? Contact support for recovery options.
        </p>
      </CardContent>
    </Card>
  );
}
