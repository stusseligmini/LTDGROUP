/**
 * Telegram Mini App Layout
 */

'use client';

import { useEffect } from 'react';
import { initTelegramWebApp, getTelegramTheme } from '@/lib/telegram/webapp';
import '../globals.css';

export default function TelegramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize Telegram WebApp
    initTelegramWebApp();
    
    // Apply Telegram theme
    const theme = getTelegramTheme();
    if (theme) {
      document.documentElement.classList.add(theme.colorScheme);
      
      // Apply Telegram color variables
      if (theme.colors.bg_color) {
        document.documentElement.style.setProperty('--tg-bg', theme.colors.bg_color);
      }
      if (theme.colors.text_color) {
        document.documentElement.style.setProperty('--tg-text', theme.colors.text_color);
      }
      if (theme.colors.button_color) {
        document.documentElement.style.setProperty('--tg-button', theme.colors.button_color);
      }
    }
  }, []);
  
  return (
    <div className="telegram-mini-app bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
      {children}
    </div>
  );
}




