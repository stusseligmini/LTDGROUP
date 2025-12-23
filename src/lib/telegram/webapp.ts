/**
 * Telegram WebApp SDK Integration
 * For Telegram Mini App functionality
 * 
 * Note: Type declarations are in miniapp.ts to avoid duplication
 */

// Import types from miniapp.ts
import './miniapp';

/**
 * Initialize Telegram WebApp
 */
export function initTelegramWebApp(): void {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const webapp = window.Telegram.WebApp;
    webapp.ready();
    webapp.expand();
  }
}

/**
 * Get Telegram WebApp instance
 */
export function getTelegramWebApp() {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
    return null;
  }
  return window.Telegram.WebApp;
}

/**
 * Check if running in Telegram
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
}

/**
 * Get init data for authentication
 */
export function getTelegramInitData(): string {
  const webapp = getTelegramWebApp();
  return webapp?.initData || '';
}

/**
 * Show main button
 */
export function showMainButton(text: string, onClick: () => void): void {
  const webapp = getTelegramWebApp();
  if (!webapp) return;
  
  webapp.MainButton.setText(text);
  webapp.MainButton.onClick(onClick);
  webapp.MainButton.show();
}

/**
 * Hide main button
 */
export function hideMainButton(): void {
  const webapp = getTelegramWebApp();
  if (!webapp) return;
  webapp.MainButton.hide();
}

/**
 * Show back button
 */
export function showBackButton(onClick: () => void): void {
  const webapp = getTelegramWebApp();
  if (!webapp) return;
  
  webapp.BackButton.onClick(onClick);
  webapp.BackButton.show();
}

/**
 * Hide back button
 */
export function hideBackButton(): void {
  const webapp = getTelegramWebApp();
  if (!webapp) return;
  webapp.BackButton.hide();
}

/**
 * Trigger haptic feedback
 */
export function haptic(type: 'impact' | 'notification' | 'selection', style?: string): void {
  const webapp = getTelegramWebApp();
  if (!webapp) return;
  
  if (type === 'impact') {
    webapp.HapticFeedback.impactOccurred(style as any || 'medium');
  } else if (type === 'notification') {
    webapp.HapticFeedback.notificationOccurred(style as any || 'success');
  } else if (type === 'selection') {
    webapp.HapticFeedback.selectionChanged();
  }
}

/**
 * Show alert
 */
export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const webapp = getTelegramWebApp();
    if (!webapp) {
      alert(message);
      resolve();
      return;
    }
    webapp.showAlert(message, () => resolve());
  });
}

/**
 * Show confirmation
 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const webapp = getTelegramWebApp();
    if (!webapp) {
      resolve(confirm(message));
      return;
    }
    webapp.showConfirm(message, (confirmed) => resolve(confirmed));
  });
}

/**
 * Close Mini App
 */
export function closeMiniApp(): void {
  const webapp = getTelegramWebApp();
  if (!webapp) {
    window.close();
    return;
  }
  webapp.close();
}

/**
 * Get theme colors from Telegram
 */
export function getTelegramTheme() {
  const webapp = getTelegramWebApp();
  if (!webapp) return null;
  
  return {
    colorScheme: webapp.colorScheme,
    colors: webapp.themeParams,
  };
}

















