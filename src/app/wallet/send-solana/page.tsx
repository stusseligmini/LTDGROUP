'use client';

export const dynamic = 'force-dynamic';

import { AppShell } from '@/components/layout/AppShell';
import { Suspense } from 'react';
import { SendSolana } from '@/components/solana/SendSolana';

export default function SendSolanaPage() {
  return (
    <AppShell title="Send SOL" subtitle="Send SOL with instant confirmation">
      <div className="container mx-auto py-8 px-4">
        <Suspense fallback={<div className="text-slate-300">Loading send form…</div>}>
          <SendSolana />
        </Suspense>
      </div>
    </AppShell>
  );
}

