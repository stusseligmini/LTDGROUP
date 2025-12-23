'use client';

import { useEffect, useState } from 'react';
import { getTelegramUser } from '@/lib/telegram/miniapp';
import { appFetch } from '@/lib/network/appFetch';

/**
 * Telegram Mini App Authentication Hook
 * Handles authentication bridge between Telegram WebApp and Firebase
 */

interface TelegramAuthState {
  telegramUser: any | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useTelegramAuth(): TelegramAuthState {
  const [state, setState] = useState<TelegramAuthState>({
    telegramUser: null,
    userId: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function authenticate() {
      try {
        console.log('[useTelegramAuth] Starting authentication');
        
        // Check if running in Telegram WebApp
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
          console.log('[useTelegramAuth] Not in Telegram WebApp');
          setState({
            telegramUser: null,
            userId: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Not running in Telegram WebApp',
          });
          return;
        }

        console.log('[useTelegramAuth] Telegram WebApp detected');

        // Get Telegram user data and init data
        const telegramUser = getTelegramUser();
        const initData = window.Telegram.WebApp.initData;
        
        console.log('[useTelegramAuth] Got user data', { 
          userId: telegramUser?.id,
          hasInitData: !!initData 
        });
        
        if (!telegramUser?.id || !initData) {
          console.log('[useTelegramAuth] Missing user or initData', { 
            hasUser: !!telegramUser?.id, 
            hasInitData: !!initData 
          });
          setState({
            telegramUser: null,
            userId: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'No Telegram user data available',
          });
          return;
        }

        console.log('[useTelegramAuth] Calling auth API');
        
        // Call Telegram auth API to link/authenticate
        const response = await appFetch('/api/telegram/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telegramId: telegramUser.id,
            initData: initData,
          }),
        });

        console.log('[useTelegramAuth] Auth API response', { status: response.status });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[useTelegramAuth] Auth API error', errorData);
          throw new Error(errorData.error || `Auth failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('[useTelegramAuth] Auth successful', { uid: data.uid });

        setState({
          telegramUser,
          userId: data.uid || `telegram_${telegramUser.id}`,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('[useTelegramAuth] Error:', error);
        setState({
          telegramUser: null,
          userId: null,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    }

    authenticate();
  }, []);

  return state;
}
