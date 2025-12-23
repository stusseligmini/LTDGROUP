/**
 * Telegram Mini App - Create Wallet
 * Optimized for Telegram WebApp viewport
 */

'use client';

import { useEffect } from 'react';
import { showBackButton, hideMainButton, haptic } from '@/lib/telegram/webapp';
import { useRouter } from 'next/navigation';
import { CreateSolanaWallet } from '@/components/solana/CreateSolanaWallet';

export default function TelegramCreateWalletPage() {
  const router = useRouter();

  useEffect(() => {
    showBackButton(() => {
      haptic('impact', 'light');
      router.push('/telegram/wallet');
    });
    hideMainButton();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Create Wallet</h1>
        <p className="text-gray-400 text-sm">Set up your non-custodial Solana wallet</p>
      </div>
      
      <div className="max-w-2xl">
        <CreateSolanaWallet />
      </div>
    </div>
  );
}
