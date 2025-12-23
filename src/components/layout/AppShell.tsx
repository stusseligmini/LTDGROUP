'use client';

import React from 'react';
import { useAuthContext } from '@/providers/AuthProvider';
import { CeloraLogo } from '@/components/ui/CeloraLogo';

type AppShellVariant = 'pwa' | 'extension';

interface AppShellProps {
  variant?: AppShellVariant;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  stickyFooter?: React.ReactNode;
}

export function AppShell({
  variant = 'pwa',
  children,
  title = 'Celora',
  subtitle = 'Wallet & Security Hub',
  actions,
  stickyFooter,
}: AppShellProps) {
  const { user, loading, signIn, signOut } = useAuthContext();

  const handleSignIn = async () => {
    // Quick anonymous sign in - main page has proper login form
    await signIn('anonymous@celora.com', 'quickstart');
  };

  const handleSignOut = async () => {
    await signOut();
    if (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') {
      window.close();
    }
  };

  return (
    <div className={`cel-shell cel-shell--${variant}`}>
      <header className="cel-shell__header">
        <div className="flex items-center gap-3">
          <CeloraLogo size="xs" />
          <div>
            <p className="cel-shell__eyebrow">Celora</p>
            <h1 className="cel-shell__title">{title}</h1>
            <p className="cel-shell__subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="cel-shell__actions">
          {actions}
          {user ? (
            <button type="button" className="cel-button cel-button--outline" onClick={handleSignOut} disabled={loading}>
              Sign out
            </button>
          ) : (
            <button type="button" className="cel-button cel-button--primary" onClick={handleSignIn} disabled={loading}>
              {loading ? 'Loading…' : 'Sign in'}
            </button>
          )}
        </div>
      </header>

      <main className="cel-shell__main">{children}</main>

      {stickyFooter ? <footer className="cel-shell__footer">{stickyFooter}</footer> : null}
    </div>
  );
}

