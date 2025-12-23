"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { resolveUsername, checkUsernameAvailability, registerUsername, UsernameErrorCode, formatUsername, validateUsernameFormat } from '@/lib/username';
import { normalizeUsername } from '@/lib/username-constants';

interface UsernameStepProps {
  walletAddress: string;
  onComplete: (username: string) => void;
}

export function UsernameStep({ walletAddress, onComplete }: UsernameStepProps) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'taken' | 'registering' | 'registered' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [debouncedValue, setDebouncedValue] = useState('');

  // Debounce typing
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedValue(value), 300);
    return () => clearTimeout(handle);
  }, [value]);

  // Generate suggestions when taken
  const buildSuggestions = useCallback((base: string) => {
    const norm = normalizeUsername(base);
    return [
      `${norm}1`,
      `${norm}_`,
      `${norm}sol`,
      `${norm}_${Math.floor(Math.random() * 99)}`,
    ];
  }, []);

  // Check availability & format
  useEffect(() => {
    if (!debouncedValue) {
      setStatus('idle');
      setError(null);
      return;
    }
    const validation = validateUsernameFormat(debouncedValue);
    if (!validation.valid) {
      setStatus('invalid');
      setError(validation.error || 'Invalid username');
      return;
    }
    let cancelled = false;
    const run = async () => {
      setStatus('checking');
      const availability = await checkUsernameAvailability(debouncedValue);
      if (cancelled) return;
      if (availability.error === UsernameErrorCode.Network) {
        setStatus('error');
        setError('Network problem – try again');
        return;
      }
      if (availability.available) {
        setStatus('valid');
        setError(null);
        setSuggestions([]);
      } else {
        setStatus('taken');
        setError('Username already taken');
        setSuggestions(buildSuggestions(debouncedValue));
      }
    };
    run();
    return () => { cancelled = true; };
  }, [debouncedValue, buildSuggestions]);

  const canRegister = status === 'valid';

  const handleRegister = async () => {
    if (!canRegister) return;
    setStatus('registering');
    const result = await registerUsername(value, walletAddress);
    if (!result.success) {
      if (result.error === UsernameErrorCode.Taken) {
        setStatus('taken');
        setError('Username taken during registration');
        setSuggestions(buildSuggestions(value));
        return;
      }
      if (result.error === UsernameErrorCode.InvalidFormat) {
        setStatus('invalid');
        setError('Invalid format');
        return;
      }
      if (result.error === UsernameErrorCode.Network) {
        setStatus('error');
        setError('Network error – retry');
        return;
      }
      setStatus('error');
      setError('Unknown error');
      return;
    }
    setStatus('registered');
    onComplete(normalizeUsername(value));
  };

  const handleSuggestionClick = (s: string) => {
    setValue(s);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Choose a Username</label>
        <Input
          placeholder="@username"
            value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1"
        />
      </div>

      {status === 'checking' && (
        <p className="text-xs text-gray-500">Checking availability...</p>
      )}
      {status === 'valid' && (
        <p className="text-xs text-green-600">Available ✔</p>
      )}
      {status === 'invalid' && error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {status === 'taken' && (
        <div className="space-y-2">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => handleSuggestionClick(s)}
                className="text-xs px-2 py-1 rounded border hover:bg-gray-100"
              >{formatUsername(s)}</button>
            ))}
          </div>
        </div>
      )}
      {status === 'error' && error && (
        <p className="text-xs text-orange-600">{error}</p>
      )}
      {status === 'registered' && (
        <p className="text-xs text-green-700">Username registered successfully! {formatUsername(value)}</p>
      )}

      <Button disabled={!canRegister || (status as any) === 'registering'} onClick={handleRegister}>
        {status === 'registering' ? 'Registering...' : 'Register Username'}
      </Button>
    </div>
  );
}
