/**
 * Telegram Mini App Integration
 * Provides utilities for interacting with Telegram Web App API
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date?: number;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, callback?: (status: string) => void) => void;
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text: string;
          }>;
        }, callback?: (buttonId: string) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        showScanQrPopup: (params: {
          text?: string;
        }, callback?: (data: string) => void) => void;
        closeScanQrPopup: () => void;
        readTextFromClipboard: (callback?: (text: string) => void) => void;
        requestWriteAccess: (callback?: (granted: boolean) => void) => void;
        requestContact: (callback?: (granted: boolean, contact?: any) => void) => void;
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

/**
 * Check if running inside Telegram Mini App
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.Telegram?.WebApp;
}

/**
 * Get Telegram Web App instance
 */
export function getTelegramWebApp() {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
    return null;
  }
  return window.Telegram.WebApp;
}

/**
 * Get Telegram user from Mini App
 */
export function getTelegramUser(): TelegramUser | null {
  const webApp = getTelegramWebApp();
  if (!webApp?.initDataUnsafe?.user) {
    return null;
  }
  return webApp.initDataUnsafe.user as TelegramUser;
}

/**
 * Initialize Telegram Mini App
 */
export function initTelegramMiniApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  // Notify Telegram that the app is ready
  webApp.ready();

  // Expand the app to full height
  webApp.expand();

  // Apply theme colors
  if (webApp.themeParams.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', webApp.themeParams.bg_color);
  }
  if (webApp.themeParams.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', webApp.themeParams.text_color);
  }
  if (webApp.themeParams.button_color) {
    document.documentElement.style.setProperty('--tg-theme-button-color', webApp.themeParams.button_color);
  }
  if (webApp.themeParams.button_text_color) {
    document.documentElement.style.setProperty('--tg-theme-button-text-color', webApp.themeParams.button_text_color);
  }
}

/**
 * Close Telegram Mini App
 */
export function closeTelegramMiniApp() {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.close();
  }
}

/**
 * Show haptic feedback
 */
export function hapticFeedback(
  style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium'
) {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    webApp.HapticFeedback.impactOccurred(style);
  }
}

/**
 * Show notification feedback
 */
export function notificationFeedback(type: 'error' | 'success' | 'warning' = 'success') {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    webApp.HapticFeedback.notificationOccurred(type);
  }
}

/**
 * Send data back to bot
 */
export function sendDataToBot(data: Record<string, any>) {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.sendData(JSON.stringify(data));
  }
}

/**
 * Show Telegram popup
 */
export function showTelegramPopup(
  message: string,
  options?: {
    title?: string;
    buttons?: Array<{ id?: string; text: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive' }>;
  }
): Promise<string | null> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      resolve(null);
      return;
    }

    webApp.showPopup(
      {
        title: options?.title,
        message,
        buttons: options?.buttons,
      },
      (buttonId) => {
        resolve(buttonId || null);
      }
    );
  });
}

/**
 * Show Telegram alert
 */
export function showTelegramAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      resolve();
      return;
    }

    webApp.showAlert(message, () => {
      resolve();
    });
  });
}

/**
 * Show Telegram confirm dialog
 */
export function showTelegramConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      resolve(false);
      return;
    }

    webApp.showConfirm(message, (confirmed) => {
      resolve(confirmed);
    });
  });
}

/**
 * Set up back button handler
 */
export function setupBackButton(onClick: () => void) {
  const webApp = getTelegramWebApp();
  if (!webApp?.BackButton) return () => {};

  webApp.BackButton.show();
  webApp.BackButton.onClick(onClick);

  return () => {
    webApp.BackButton.offClick(onClick);
    webApp.BackButton.hide();
  };
}

/**
 * Set up main button (bottom button)
 */
export function setupMainButton(
  text: string,
  onClick: () => void,
  options?: {
    color?: string;
    textColor?: string;
  }
) {
  const webApp = getTelegramWebApp();
  if (!webApp?.MainButton) return () => {};

  webApp.MainButton.setText(text);
  if (options?.color) {
    webApp.MainButton.setParams({ color: options.color });
  }
  if (options?.textColor) {
    webApp.MainButton.setParams({ text_color: options.textColor });
  }
  webApp.MainButton.show();
  webApp.MainButton.enable();
  webApp.MainButton.onClick(onClick);

  return () => {
    webApp.MainButton.offClick(onClick);
    webApp.MainButton.hide();
  };
}

