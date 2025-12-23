/**
 * Authentication Flow Hooks
 * 
 * Provides convenient hooks for auth state, token management, and user info.
 * Backed by Firebase Authentication.
 */
'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';
import { isTokenExpired, getTimeUntilExpiry, extractUserInfo } from '@/lib/jwtUtils';

interface AuthState {
  user: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
}

interface TokenInfo {
  isExpired: boolean;
  timeUntilExpiry: number | null;
  shouldRefresh: boolean;
  userInfo: ReturnType<typeof extractUserInfo>;
}

/**
 * Main auth hook with comprehensive state
 */
export function useAuthFlow(): AuthState {
  const { user, loading, error } = useAuthContext();

  return useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      error,
    }),
    [user, loading, error]
  );
}

/**
 * Hook for token information and validation
 */
export function useTokenInfo(): TokenInfo | null {
  const { session } = useAuthContext();
  
  return useMemo(() => {
    if (!session?.accessToken) return null;
    
    const token = session.accessToken;
    const timeUntilExpiry = getTimeUntilExpiry(token);
    
    return {
      isExpired: isTokenExpired(token, 0),
      timeUntilExpiry,
      shouldRefresh: isTokenExpired(token, 300), // 5 min buffer
      userInfo: extractUserInfo(token),
    };
  }, [session]);
}

/**
 * Hook for automatic token refresh on mount/focus
 */
export function useAutoRefresh(enabled = true): void {
  const { refreshSession } = useAuthContext();
  const tokenInfo = useTokenInfo();
  
  const handleRefresh = useCallback(async () => {
    if (!enabled || !tokenInfo) return;
    
    if (tokenInfo.shouldRefresh && !tokenInfo.isExpired) {
      try {
        await refreshSession();
      } catch (error) {
        console.error('[Auth] Auto-refresh failed:', error);
      }
    }
  }, [enabled, tokenInfo, refreshSession]);
  
  // Refresh on mount if needed
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);
  
  // Refresh on window focus
  useEffect(() => {
    if (!enabled) return;
    
    const handleFocus = () => {
      handleRefresh();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [enabled, handleRefresh]);
}

/**
 * Hook to require authentication (redirects if not authenticated)
 */
export function useRequireAuth(): AuthState {
  const auth = useAuthFlow();
  const { signIn } = useAuthContext();
  
  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      console.warn('[Auth] User not authenticated, triggering sign-in');
      signIn('anonymous@celora.com', 'quickstart');
    }
  }, [auth.loading, auth.isAuthenticated, signIn]);
  
  return auth;
}

// Alias for backward compatibility
export const useAuth = useAuthFlow;
