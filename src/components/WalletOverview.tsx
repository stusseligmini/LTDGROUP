'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useAuthContext } from '../providers/AuthProvider';
import { useWalletSummary } from '@/hooks/useWalletSummary';
import { formatCurrency } from '@/lib/ui/formatters';

export function WalletOverview() {
  const { user } = useAuthContext();
  const { summary, loading, error, refresh } = useWalletSummary();
  const safeHoldings = Array.isArray(summary?.holdings) ? summary.holdings : [];

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <p className="cel-eyebrow">Wallet</p>
          <h2 className="cel-title">Account overview</h2>
        </CardHeader>
        <CardContent>
          <p className="cel-body">Sign in to view your balances and recent wallet activity.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="cel-eyebrow">Wallet</p>
        <h2 className="cel-title">Account overview</h2>
        <button type="button" className="cel-button cel-button--ghost ring-glow" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </CardHeader>

      <CardContent>
        <div className="cel-metric">
          <span className="cel-metric__label">Total balance</span>
          <span className="cel-metric__value">
            {loading ? 'Loading…' : formatCurrency(summary?.totalBalance ?? 0, summary?.currency ?? 'USD')}
          </span>
          <span className="cel-metric__caption">{safeHoldings.length} active accounts</span>
        </div>

        <div className="cel-info-block">
          <span className="cel-info-block__label">Signed in as</span>
          <span className="cel-info-block__value">{user.email}</span>
          <span className="cel-info-block__caption">Secured with enterprise authentication</span>
        </div>

        {error ? (
          <p className="cel-error" role="alert">
            {error}
          </p>
        ) : null}

        {safeHoldings.length > 0 ? (
          <div className="cel-holdings">
            {safeHoldings.slice(0, 3).map((holding) => (
              <div key={holding.id} className="cel-holding-row">
                <div>
                  <p className="cel-holding-row__title">{holding.label}</p>
                  <p className="cel-holding-row__caption">{holding.currency}</p>
                </div>
                <p className="cel-holding-row__value">{formatCurrency(holding.balance, holding.currency)}</p>
              </div>
            ))}
            {safeHoldings.length > 3 ? (
              <p className="cel-note">+ {safeHoldings.length - 3} more accounts</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
