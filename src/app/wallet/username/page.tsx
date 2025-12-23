'use client';

export const dynamic = 'force-dynamic';

import { AppShell } from '@/components/layout/AppShell';
import { UsernameTransfer } from '@/components/solana/UsernameTransfer';

export default function UsernamePage() {
  return (
    <AppShell title="Username" subtitle="Register and send to @username.sol">
      <div className="container mx-auto py-8 px-4">
        <UsernameTransfer />
      </div>
    </AppShell>
  );
}

