'use client';

export const dynamic = 'force-dynamic';

import { AppShell } from '@/components/layout/AppShell';
import { CreateSolanaWallet } from '@/components/solana/CreateSolanaWallet';

export default function CreateSolanaWalletPage() {
  return (
    <AppShell title="Create Solana Wallet" subtitle="Set up your non-custodial Solana wallet">
      <div className="container mx-auto py-8 px-4">
        <CreateSolanaWallet />
      </div>
    </AppShell>
  );
}

