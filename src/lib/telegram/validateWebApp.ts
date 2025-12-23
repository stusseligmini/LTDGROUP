/**
 * Telegram Web App Data Validation
 * Validates initData from Telegram Mini App
 */

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramWebAppData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
}

/**
 * Validates Telegram Web App data
 * Uses HMAC-SHA256 verification
 */
export function validateTelegramWebAppData(
  initData: string,
  botToken: string
): { valid: boolean; data?: TelegramWebAppData } {
  try {
    if (!initData || !botToken) {
      return { valid: false };
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    
    // Parse init data
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return { valid: false };
    }

    // Remove hash from params
    params.delete('hash');

    // Create data check string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Generate secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    const isValid = calculatedHash === hash;

    if (!isValid) {
      return { valid: false };
    }

    // Parse user data
    const userData = params.get('user');
    let user: TelegramUser | undefined;
    
    if (userData) {
      user = JSON.parse(userData);
    }

    const authDate = parseInt(params.get('auth_date') || '0');
    
    // Check if auth_date is recent (within 1 hour)
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      console.warn('Telegram auth data is too old');
      return { valid: false };
    }

    return {
      valid: true,
      data: {
        user,
        auth_date: authDate,
        hash,
        query_id: params.get('query_id') || undefined,
        chat_instance: params.get('chat_instance') || undefined,
        chat_type: params.get('chat_type') || undefined,
        start_param: params.get('start_param') || undefined,
      },
    };
  } catch (error) {
    console.error('Error validating Telegram Web App data:', error);
    return { valid: false };
  }
}

/**
 * Extract user ID from Telegram Web App
 */
export function getTelegramUserId(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const userData = params.get('user');
    
    if (!userData) {
      return null;
    }

    const user = JSON.parse(userData);
    return user.id || null;
  } catch {
    return null;
  }
}

/**
 * Extract user info from Telegram Web App
 */
export function getTelegramUserInfo(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userData = params.get('user');
    
    if (!userData) {
      return null;
    }

    return JSON.parse(userData);
  } catch {
    return null;
  }
}
