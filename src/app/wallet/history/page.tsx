'use client';

export const dynamic = 'force-dynamic';

import { AppShell } from '@/components/layout/AppShell';
import { Suspense } from 'react';
import { TransactionHistory } from '@/components/solana/TransactionHistory';

export default function TransactionHistoryPage() {
  return (
    <AppShell title="Transaction History" subtitle="View your Solana transaction history">
      <div className="container mx-auto py-8 px-4">
        <Suspense fallback={<div className="text-slate-300">Loading history…</div>}>
          <TransactionHistory />
        </Suspense>
      </div>
    </AppShell>
  );
}

