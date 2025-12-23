/**
 * Error handling utilities for extension popup
 * Maps Firebase and API errors to user-friendly messages
 */

export interface ErrorDetails {
  message: string;
  code?: string;
  retryable: boolean;
}

/**
 * Map Firebase auth error codes to friendly messages
 */
export function mapFirebaseError(error: any): ErrorDetails {
  const code = error?.code || '';
  const message = error?.message || 'An error occurred';

  const firebaseErrors: Record<string, string> = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email already in use',
    'auth/weak-password': 'Password is too weak (min 6 characters)',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Check your connection',
    'auth/popup-closed-by-user': 'Sign-in cancelled',
    'auth/operation-not-allowed': 'This sign-in method is not enabled',
    'auth/invalid-credential': 'Invalid credentials provided',
    'auth/credential-already-in-use': 'Credentials already linked to another account',
  };

  const friendlyMessage = firebaseErrors[code] || message;
  const retryable = code === 'auth/network-request-failed' || code === 'auth/too-many-requests';

  return {
    message: friendlyMessage,
    code,
    retryable,
  };
}

/**
 * Map API errors to friendly messages
 */
export function mapApiError(error: any): ErrorDetails {
  const status = error?.status || 0;
  const data = error?.data || {};
  const message = data?.error || error?.message || 'An error occurred';

  const statusMessages: Record<number, string> = {
    400: 'Invalid request',
    401: 'Please sign in to continue',
    403: 'You don\'t have permission to do that',
    404: 'Resource not found',
    409: 'Conflict - resource already exists',
    429: 'Too many requests. Please try again later',
    500: 'Server error. Please try again',
    502: 'Service temporarily unavailable',
    503: 'Service temporarily unavailable',
  };

  const friendlyMessage = statusMessages[status] || message;
  const retryable = status >= 500 || status === 429 || status === 0;

  return {
    message: friendlyMessage,
    code: data?.code || `HTTP_${status}`,
    retryable,
  };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if not retryable
      const errorDetails = mapApiError(error);
      if (!errorDetails.retryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Display error in UI with retry option
 */
export interface ErrorUIOptions {
  error: any;
  onRetry?: () => void;
  context?: string;
}

export function formatErrorForUI(options: ErrorUIOptions): {
  message: string;
  canRetry: boolean;
  code?: string;
} {
  const { error, context } = options;
  
  // Try Firebase error first
  if (error?.code?.startsWith('auth/')) {
    const details = mapFirebaseError(error);
    return {
      message: context ? `${context}: ${details.message}` : details.message,
      canRetry: details.retryable,
      code: details.code,
    };
  }
  
  // Try API error
  const details = mapApiError(error);
  return {
    message: context ? `${context}: ${details.message}` : details.message,
    canRetry: details.retryable,
    code: details.code,
  };
}
