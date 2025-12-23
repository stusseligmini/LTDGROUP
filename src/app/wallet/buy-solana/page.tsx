'use client';

export const dynamic = 'force-dynamic';

import { AppShell } from '@/components/layout/AppShell';
import { BuySolana } from '@/components/solana/BuySolana';

export default function BuySolanaPage() {
  return (
    <AppShell title="Buy SOL" subtitle="Purchase SOL with credit card">
      <div className="container mx-auto py-8 px-4">
        <BuySolana />
      </div>
    </AppShell>
  );
}

