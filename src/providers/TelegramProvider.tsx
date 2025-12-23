/**
 * Centralized Telegram Detection & Context
 * Single source of truth for Telegram environment detection
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface TelegramContextValue {
  isTelegram: boolean;
  isReady: boolean;
  webApp: any | null;
  initData: string;
  user: any | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  isReady: false,
  webApp: null,
  initData: '',
  user: null,
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<TelegramContextValue>({
    isTelegram: false,
    isReady: false,
    webApp: null,
    initData: '',
    user: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const webApp = window.Telegram?.WebApp;
    if (!webApp || !webApp.initData) {
      setContext({
        isTelegram: false,
        isReady: true,
        webApp: null,
        initData: '',
        user: null,
      });
      return;
    }

    webApp.ready();
    webApp.expand();

    setContext({
      isTelegram: true,
      isReady: true,
      webApp,
      initData: webApp.initData,
      user: webApp.initDataUnsafe?.user || null,
    });
  }, []);

  return (
    <TelegramContext.Provider value={context}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
