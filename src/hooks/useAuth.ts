'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSession, AuthUser, useAuthContext } from '../providers/AuthProvider';

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInAnonymous?: () => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  triggerPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (attributes: Record<string, unknown>) => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const {
    user,
    session,
    loading,
    error,
    signIn,
    signInAnonymous,
    signUp,
    signOut,
    refreshSession,
    triggerPasswordReset,
    updateUser,
  } = useAuthContext();

  const wrappedSignIn = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);

    if (!result.error) {
      return { success: true };
    }

    return { success: false, error: result.error.message };
  }, [signIn]);

  const wrappedSignUp = useCallback(async (email: string, password: string) => {
    const result = await signUp(email, password);

    if (!result.error) {
      return { success: true };
    }

    return { success: false, error: result.error.message };
  }, [signUp]);

  const wrappedSignInAnonymous = useCallback(async () => {
    if (!signInAnonymous) return { success: false, error: 'Anonymous sign-in not available' };
    const result = await signInAnonymous();
    if (!result.error) {
      return { success: true };
    }
    return { success: false, error: result.error.message };
  }, [signInAnonymous]);

  const wrappedSignOut = useCallback(async () => {
    try {
      await signOut();
      router.push('/');
      router.refresh();
      return true;
    } catch (err) {
      console.error('Sign out failed:', err);
      return false;
    }
  }, [router, signOut]);

  const wrappedRefresh = useCallback(async () => {
    try {
      await refreshSession();
      return true;
    } catch (err) {
      console.error('Session refresh failed:', err);
      return false;
    }
  }, [refreshSession]);

  const wrappedPasswordReset = useCallback(async (email: string) => {
    const result = await triggerPasswordReset(email);
    if (!result.error) {
      return { success: true };
    }
    return { success: false, error: result.error.message };
  }, [triggerPasswordReset]);

  const wrappedUpdateUser = useCallback(async (attributes: Record<string, unknown>) => {
    try {
      await updateUser(attributes as Partial<AuthUser>);
      return true;
    } catch {
      return false;
    }
  }, [updateUser]);

  const state = useMemo<AuthState>(
    () => ({
      user,
      session,
      isLoading: loading,
      isAuthenticated: Boolean(user),
      error,
    }),
    [error, loading, session, user]
  );

  return {
    ...state,
    signIn: wrappedSignIn,
    signInAnonymous: wrappedSignInAnonymous,
    signUp: wrappedSignUp,
    signOut: wrappedSignOut,
    refreshSession: wrappedRefresh,
    triggerPasswordReset: wrappedPasswordReset,
    updateUser: wrappedUpdateUser,
  };
}
