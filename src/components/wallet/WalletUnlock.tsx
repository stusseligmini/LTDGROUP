'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface WalletUnlockProps {
  onUnlock: (pin: string) => Promise<boolean>;
  isLoading?: boolean;
  walletLabel?: string;
}

export function WalletUnlock({ onUnlock, isLoading = false, walletLabel = 'Wallet' }: WalletUnlockProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Check if wallet is temporarily locked due to too many failed attempts
  useEffect(() => {
    const lockoutTime = localStorage.getItem('walletLockoutTime');
    if (lockoutTime) {
      const remainingTime = parseInt(lockoutTime) - Date.now();
      if (remainingTime > 0) {
        setIsLocked(true);
        const timer = setTimeout(() => {
          setIsLocked(false);
          setAttemptCount(0);
          localStorage.removeItem('walletLockoutTime');
          setError(null);
        }, remainingTime);
        return () => clearTimeout(timer);
      } else {
        localStorage.removeItem('walletLockoutTime');
        setAttemptCount(0);
      }
    }
  }, []);

  const handleUnlock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      setError('Wallet is temporarily locked due to too many failed attempts. Try again later.');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    try {
      setError(null);
      const success = await onUnlock(pin);

      if (success) {
        setPin('');
        setAttemptCount(0);
        localStorage.removeItem('walletLockoutTime');
      } else {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);

        if (newAttemptCount >= MAX_ATTEMPTS) {
          setIsLocked(true);
          const lockoutTime = Date.now() + LOCKOUT_DURATION;
          localStorage.setItem('walletLockoutTime', lockoutTime.toString());
          setError('Too many failed attempts. Wallet locked for 5 minutes.');
        } else {
          setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttemptCount} attempts remaining.`);
          setPin('');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock wallet');
      setPin('');
    }
  }, [pin, attemptCount, isLocked, onUnlock]);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 12) {
      setPin(value);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Lock className="w-12 h-12 text-cyan-400" />
          </div>
          <CardTitle className="text-center">Unlock {walletLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6">
              <ErrorDisplay
                title={attemptCount >= MAX_ATTEMPTS - 1 ? 'Security Alert' : 'Incorrect PIN'}
                error={error}
                variant="inline"
              />
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4">
            {/* PIN Input */}
            <div className="space-y-2">
              <label htmlFor="pin" className="block text-sm font-medium text-gray-300">
                Enter Your PIN
              </label>
              <div className="relative">
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="••••"
                  disabled={isLocked || isLoading}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-lg tracking-widest text-center text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  autoFocus
                  inputMode="numeric"
                  maxLength={12}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  disabled={isLocked || isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {pin.length} characters entered
              </p>
            </div>

            {/* Unlock Button */}
            <Button
              type="submit"
              disabled={isLocked || isLoading || pin.length < 4}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Unlocking...' : 'Unlock Wallet'}
            </Button>

            {/* Attempt Counter */}
            {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && (
              <div className="text-center text-sm text-orange-500">
                Attempts: {attemptCount}/{MAX_ATTEMPTS}
              </div>
            )}
          </form>

          {/* Lockout Message */}
          {isLocked && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
              <p className="text-xs text-red-400 text-center">
                Wallet temporarily locked for security. Please try again in 5 minutes.
              </p>
            </div>
          )}

          {/* Info Text */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-gray-400 text-center">
              🔐 Your PIN is encrypted and stored locally. Never share it with anyone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
