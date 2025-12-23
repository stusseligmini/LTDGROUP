'use client';

export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { SolanaWalletDashboard } from '@/components/solana/SolanaWalletDashboard';
import { WalletUnlock } from '@/components/wallet/WalletUnlock';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isWalletUnlocked, verifyWalletPin, isPinConfigured } from '@/lib/wallet/pinManagement';

export default function WalletPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [walletUnlocked, setWalletUnlocked] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/splash');
    }
  }, [user, isLoading, router]);

  // Check if wallet needs PIN unlock
  useEffect(() => {
    if (user && !isLoading) {
      const isPinSet = isPinConfigured();
      const isUnlocked = isWalletUnlocked();
      
      setPinRequired(isPinSet);
      setWalletUnlocked(isUnlocked);
    }
  }, [user, isLoading]);

  const handleUnlock = useCallback(async (pin: string): Promise<boolean> => {
    try {
      setUnlocking(true);
      const success = await verifyWalletPin(pin);
      
      if (success) {
        setWalletUnlocked(true);
      }
      
      return success;
    } catch (error) {
      console.error('Unlock error:', error);
      return false;
    } finally {
      setUnlocking(false);
    }
  }, []);

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading...</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Show unlock screen if PIN is required and not unlocked
  if (pinRequired && !walletUnlocked) {
    return (
      <WalletUnlock
        onUnlock={handleUnlock}
        isLoading={unlocking}
        walletLabel="Your Wallet"
      />
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold heading-gradient mb-2">Wallet</h1>
          <p className="text-gray-400">Your Solana wallet dashboard</p>
        </div>
        <SolanaWalletDashboard />
      </div>
    </DashboardShell>
  );
}

