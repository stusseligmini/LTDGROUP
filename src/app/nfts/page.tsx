'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import NFTGallery from '@/components/NFTGallery';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function NFTsPage() {
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
          <h1 className="text-3xl font-bold heading-gradient mb-2">NFTs</h1>
          <p className="text-gray-400">Your NFT collection</p>
        </div>
        <NFTGallery />
      </div>
    </DashboardShell>
  );
}

