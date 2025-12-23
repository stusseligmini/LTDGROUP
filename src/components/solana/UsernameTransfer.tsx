'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { appFetch } from '@/lib/network/appFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthContext } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface UsernameInfo {
  username: string;
  displayName: string;
  address: string;
  publicKey?: string;
}

interface SolanaWallet {
  id: string;
  address: string;
  label: string | null;
  isDefault: boolean;
}

type Tab = 'register' | 'send';

export function UsernameTransfer() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<Tab>('register');
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  
  // Register username state
  const [newUsername, setNewUsername] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  
  // Send to username state
  const [sendUsername, setSendUsername] = useState('');
  const [resolvedInfo, setResolvedInfo] = useState<UsernameInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Fetch user's current wallet and username
  const fetchWalletAndUsername = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      // Fetch user's Solana wallet
      const response = await appFetch('/api/wallet/list?blockchain=solana&limit=1', {
        headers: {
          'X-User-Id': user.id,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet');
      }

      const data = await response.json();
      const wallets = data.data?.wallets || data.wallets || [];
      
      if (!Array.isArray(wallets) || wallets.length === 0) {
        return;
      }
      
      const solanaWallet = wallets.find((w: any) => w && w.isDefault && w.blockchain === 'solana') ||
                          wallets.find((w: any) => w && w.blockchain === 'solana');

      if (solanaWallet) {
        setWallet({
          id: solanaWallet.id,
          address: solanaWallet.address,
          label: solanaWallet.label || 'My Solana Wallet',
          isDefault: solanaWallet.isDefault,
        });
      }

      // Check if user already has a username
      if (user.username) {
        setCurrentUsername(user.username);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchWalletAndUsername();
  }, [fetchWalletAndUsername]);

  // Check username availability
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Clean username: remove @ and .sol suffix if present
    const cleanUsername = username.replace(/^@/, '').replace(/\.sol$/, '').toLowerCase();

    // Validate format
    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      setUsernameAvailable(false);
      return;
    }

    setCheckingAvailability(true);
    setRegisterError(null);

    try {
      // Try to lookup the username - if it exists, it's not available
      const response = await appFetch(`/api/username?username=${encodeURIComponent(cleanUsername)}`, {
        headers: {
          'X-User-Id': user?.id || '',
        },
      });

      if (response.status === 404) {
        // Username not found = available
        setUsernameAvailable(true);
      } else if (response.ok) {
        const data = await response.json();
        // Check if it's the current user's username
        if (data.data?.username === currentUsername || 
            data.data?.address === wallet?.address) {
          setUsernameAvailable(true); // It's their own username
        } else {
          setUsernameAvailable(false); // Taken by someone else
        }
      } else {
        setUsernameAvailable(null);
      }
    } catch (err) {
      console.error('Failed to check username availability:', err);
      setUsernameAvailable(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [user, currentUsername, wallet]);

  // Debounce username availability check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (newUsername && activeTab === 'register') {
        checkUsernameAvailability(newUsername);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [newUsername, activeTab, checkUsernameAvailability]);

  // Register username
  const handleRegisterUsername = useCallback(async () => {
    if (!user || !wallet || !newUsername || !usernameAvailable) {
      return;
    }

    const cleanUsername = newUsername.replace(/^@/, '').replace(/\.sol$/, '').toLowerCase();

    if (!/^[a-z0-9._]+$/.test(cleanUsername) || cleanUsername.length < 3) {
      setRegisterError('Invalid username format');
      return;
    }

    setRegistering(true);
    setRegisterError(null);

    try {
      const response = await appFetch('/api/username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          username: cleanUsername,
          solanaAddress: wallet.address,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to register username');
      }

      const data = await response.json();
      setCurrentUsername(cleanUsername);
      setRegisterSuccess(true);
      setNewUsername('');
      
      // Switch to send tab after successful registration
      setTimeout(() => {
        setActiveTab('send');
        setRegisterSuccess(false);
      }, 2000);
    } catch (err: any) {
      setRegisterError(err.message || 'Failed to register username');
    } finally {
      setRegistering(false);
    }
  }, [user, wallet, newUsername, usernameAvailable]);

  // Resolve username to address
  const handleResolveUsername = useCallback(async () => {
    if (!sendUsername) {
      return;
    }

    const cleanUsername = sendUsername.replace(/^@/, '').replace(/\.sol$/, '').toLowerCase();

    if (cleanUsername.length < 3) {
      setResolveError('Username must be at least 3 characters');
      return;
    }

    setResolving(true);
    setResolveError(null);
    setResolvedInfo(null);

    try {
      const response = await appFetch(`/api/username?username=${encodeURIComponent(cleanUsername)}`, {
        headers: {
          'X-User-Id': user?.id || '',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Username not found');
        }
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to resolve username');
      }

      const data = await response.json();
      setResolvedInfo({
        username: data.data.username,
        displayName: data.data.displayName || `@${data.data.username}.sol`,
        address: data.data.address,
        publicKey: data.data.publicKey,
      });
    } catch (err: any) {
      setResolveError(err.message || 'Failed to resolve username');
    } finally {
      setResolving(false);
    }
  }, [sendUsername, user]);

  // Navigate to send page with resolved address
  const handleSendToResolved = useCallback(() => {
    if (!resolvedInfo) {
      return;
    }

    // Navigate to send page with pre-filled address (use displayName as the label, address as the actual value)
    router.push(`/wallet/send-solana?to=${encodeURIComponent(resolvedInfo.displayName)}&label=${encodeURIComponent(resolvedInfo.displayName)}`);
  }, [resolvedInfo, router]);

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Please sign in to use usernames</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'register'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Register Username
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'send'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Send to Username
        </button>
      </div>

      {/* Register Username Tab */}
      {activeTab === 'register' && (
        <Card>
          <CardHeader>
            <CardTitle>Register @username.sol</CardTitle>
            <CardDescription>
              Create a username for your Solana wallet. Others can send SOL to your username instead of your address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUsername ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-green-900">You have a username!</p>
                    <p className="text-sm text-green-700">@{currentUsername}.sol</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Choose a username
                  </label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      placeholder="dexter"
                      value={newUsername}
                      onChange={(e) => {
                        setNewUsername(e.target.value);
                        setUsernameAvailable(null);
                        setRegisterError(null);
                      }}
                      className="pr-24"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      .sol
                    </div>
                  </div>
                  {checkingAvailability && (
                    <p className="mt-1 text-xs text-gray-500">Checking availability...</p>
                  )}
                  {usernameAvailable === true && !checkingAvailability && (
                    <p className="mt-1 text-xs text-green-600">✓ Username available</p>
                  )}
                  {usernameAvailable === false && !checkingAvailability && (
                    <p className="mt-1 text-xs text-red-600">✗ Username already taken</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    3-20 characters, lowercase letters, numbers, dots, and underscores only
                  </p>
                </div>

                {wallet && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 mb-1">Linked to wallet:</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{wallet.address}</p>
                  </div>
                )}

                {registerSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <p className="text-sm text-green-800">Username registered successfully!</p>
                  </div>
                )}

                {registerError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                    <p className="text-sm text-red-800">{registerError}</p>
                  </div>
                )}

                <Button
                  onClick={handleRegisterUsername}
                  disabled={!usernameAvailable || registering || !wallet || !newUsername}
                  className="w-full"
                >
                  {registering ? 'Registering...' : 'Register Username'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send to Username Tab */}
      {activeTab === 'send' && (
        <Card>
          <CardHeader>
            <CardTitle>Send to Username</CardTitle>
            <CardDescription>
              Send SOL to a username instead of a long address. Enter a username to resolve it to an address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="send-username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="send-username"
                    type="text"
                    placeholder="@dexter.sol or dexter"
                    value={sendUsername}
                    onChange={(e) => {
                      setSendUsername(e.target.value);
                      setResolvedInfo(null);
                      setResolveError(null);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleResolveUsername();
                      }
                    }}
                    className="pr-12"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    .sol
                  </div>
                </div>
                <Button
                  onClick={handleResolveUsername}
                  disabled={!sendUsername || resolving || sendUsername.length < 3}
                >
                  {resolving ? 'Resolving...' : 'Resolve'}
                </Button>
              </div>
            </div>

            {resolveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{resolveError}</p>
              </div>
            )}

            {resolvedInfo && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="font-medium text-blue-900">{resolvedInfo.displayName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Address:</p>
                      <p className="text-sm font-mono text-blue-900 break-all">{resolvedInfo.address}</p>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSendToResolved} className="w-full">
                  Send SOL to {resolvedInfo.displayName}
                </Button>
              </div>
            )}

            {!resolvedInfo && !resolveError && sendUsername && (
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-sm text-gray-500">Click &quot;Resolve&quot; to find the address for this username</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

