'use client';

import { useCallback, useEffect, useState } from 'react';
import { WalletSummary } from '@/types/api';
import { appFetch } from '@/lib/network/appFetch';

/**
 * Telegram Mini App Wallet Summary Hook
 * Works with Telegram authentication (no Firebase Auth required)
 */

interface WalletSummaryState {
  summary: WalletSummary | null;
  loading: boolean;
  error: string | null;
}

interface UseTelegramWalletSummaryProps {
  userId: string | null;
  enabled?: boolean;
}

export function useTelegramWalletSummary({ userId, enabled = true }: UseTelegramWalletSummaryProps) {
  const [state, setState] = useState<WalletSummaryState>({
    summary: null,
    loading: false,
    error: null,
  });

  const fetchSummary = useCallback(async () => {
    if (!userId || !enabled) {
      setState((prev) => ({ ...prev, summary: null, error: null, loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await appFetch('/api/wallet/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Normalize to ensure holdings is always an array
      const safeSummary: WalletSummary = {
        totalBalance: data.totalBalance ?? 0,
        currency: data.currency ?? 'USD',
        holdings: Array.isArray(data.holdings) ? data.holdings : [],
        lastUpdated: data.lastUpdated ?? new Date().toISOString(),
      };

      setState({ summary: safeSummary, loading: false, error: null });
    } catch (error) {
      console.error('[TelegramWalletSummary] Error:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load wallet summary',
      }));
    }
  }, [userId, enabled]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary: state.summary,
    loading: state.loading,
    error: state.error,
    refresh: fetchSummary,
  };
}
