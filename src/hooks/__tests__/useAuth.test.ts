/** @jest-environment jsdom */
/**
 * useAuth Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../useAuth';
import { useAuthContext } from '@/providers/AuthProvider';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

describe('useAuth', () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
  };

  const mockSignIn = jest.fn();
  const mockSignUp = jest.fn();
  const mockSignOut = jest.fn();
  const mockRefreshSession = jest.fn();
  const mockTriggerPasswordReset = jest.fn();
  const mockUpdateUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('should return auth state from context', () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', roles: [] };
    const mockSession = { accessToken: 'token-123' };

    (useAuthContext as jest.Mock).mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      error: null,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      triggerPasswordReset: mockTriggerPasswordReset,
      updateUser: mockUpdateUser,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should handle sign in success', async () => {
    mockSignIn.mockResolvedValue({ error: null });

    (useAuthContext as jest.Mock).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      error: null,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      triggerPasswordReset: mockTriggerPasswordReset,
      updateUser: mockUpdateUser,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const response = await result.current.signIn();
      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });
  });

  it('should handle sign in failure', async () => {
    const error = new Error('Sign in failed');
    mockSignIn.mockResolvedValue({ error });

    (useAuthContext as jest.Mock).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      error: null,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      triggerPasswordReset: mockTriggerPasswordReset,
      updateUser: mockUpdateUser,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const response = await result.current.signIn();
      expect(response.success).toBe(false);
      expect(response.error).toBe('Sign in failed');
    });
  });

  it('should handle sign out', async () => {
    mockSignOut.mockResolvedValue(undefined);

    (useAuthContext as jest.Mock).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', roles: [] },
      session: { accessToken: 'token-123' },
      loading: false,
      error: null,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      triggerPasswordReset: mockTriggerPasswordReset,
      updateUser: mockUpdateUser,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const success = await result.current.signOut();
      expect(success).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith('/');
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });

  it('should handle session refresh', async () => {
    mockRefreshSession.mockResolvedValue(undefined);

    (useAuthContext as jest.Mock).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', roles: [] },
      session: { accessToken: 'token-123' },
      loading: false,
      error: null,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      triggerPasswordReset: mockTriggerPasswordReset,
      updateUser: mockUpdateUser,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const success = await result.current.refreshSession();
      expect(success).toBe(true);
    });
  });
});

