'use client';

import React, { ReactNode } from 'react';
import { TelegramMiniAppProvider } from '@/components/telegram/TelegramMiniAppProvider';
import { AuthProvider } from './AuthProvider';
import { AppCheckProvider } from './AppCheckProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ThemeProvider } from './ThemeProvider';
import { TelemetryProvider } from '@/components/TelemetryProvider';
import { DevToolsWarning } from '@/components/security/DevToolsWarning';
import { DevModeBanner } from '@/components/dev/DevModeBanner';
import { ToastProvider } from './ToastProvider';

interface ProvidersWrapperProps {
  children: ReactNode;
  isTelegram: boolean;
}

export function ProvidersWrapper({ children, isTelegram }: ProvidersWrapperProps) {
  if (isTelegram) {
    return (
      <TelegramMiniAppProvider>
        <AuthProvider>
          <AppCheckProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AppCheckProvider>
        </AuthProvider>
      </TelegramMiniAppProvider>
    );
  }

  return (
    <ThemeProvider>
      <TelemetryProvider>
        <ErrorBoundary>
          <TelegramMiniAppProvider>
            <AuthProvider>
              <AppCheckProvider>
                {children}
              </AppCheckProvider>
            </AuthProvider>
          </TelegramMiniAppProvider>
        </ErrorBoundary>
        <DevToolsWarning />
        <DevModeBanner />
        <ToastProvider />
      </TelemetryProvider>
    </ThemeProvider>
  );
}
