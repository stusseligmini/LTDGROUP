'use client';

import React, { useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import StakingDashboard from '@/components/StakingDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function StakingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/splash');
    }
  }, [user, isLoading, router]);

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

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold heading-gradient mb-2">Staking</h1>
          <p className="text-gray-400">Earn rewards by staking your tokens</p>
        </div>
        <StakingDashboard />
      </div>
    </DashboardShell>
  );
}
















