'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { CreateSolanaWallet } from '@/components/solana/CreateSolanaWallet';

/**
 * Wallet Creation Page
 * Thin wrapper around `CreateSolanaWallet` for routing consistency.
 * Future: multi-chain selection (EVM, BTC) before invoking specific flow.
 */
export default function WalletCreatePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <CreateSolanaWallet />
    </div>
  );
}
