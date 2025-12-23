'use client';

/**
 * Telegram Mini App Provider
 * Initializes Telegram Web App and provides context
 */

import React, { useEffect, useState, createContext, useContext } from 'react';
import {
  isTelegramMiniApp,
  initTelegramMiniApp,
  getTelegramUser,
  type TelegramUser,
} from '@/lib/telegram/miniapp';

interface TelegramMiniAppContextValue {
  isMiniApp: boolean;
  user: TelegramUser | null;
  ready: boolean;
}

const TelegramMiniAppContext = createContext<TelegramMiniAppContextValue>({
  isMiniApp: false,
  user: null,
  ready: false,
});

export function useTelegramMiniApp() {
  return useContext(TelegramMiniAppContext);
}

interface TelegramMiniAppProviderProps {
  children: React.ReactNode;
}

export function TelegramMiniAppProvider({ children }: TelegramMiniAppProviderProps) {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if running in Telegram Mini App
    const isTMA = isTelegramMiniApp();
    setIsMiniApp(isTMA);

    if (isTMA) {
      // Initialize Telegram Mini App
      initTelegramMiniApp();

      // Get Telegram user
      const telegramUser = getTelegramUser();
      setUser(telegramUser);

      // Mark as ready
      setReady(true);

      // Load Telegram Web App script if not already loaded
      if (!window.Telegram) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        script.onload = () => {
          initTelegramMiniApp();
          const telegramUser = getTelegramUser();
          setUser(telegramUser);
          setReady(true);
        };
        document.head.appendChild(script);
      }
    } else {
      // Not in Telegram Mini App, but mark as ready
      setReady(true);
    }
  }, []);

  return (
    <TelegramMiniAppContext.Provider value={{ isMiniApp, user, ready }}>
      {children}
    </TelegramMiniAppContext.Provider>
  );
}

