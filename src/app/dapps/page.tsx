import React from 'react';
import WalletConnectDisabled from '@/components/WalletConnectDisabled';

export default function DAppsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">dApp Browser</h1>
          
          <WalletConnectDisabled />
        </div>
      </div>
    </div>
  );
}

