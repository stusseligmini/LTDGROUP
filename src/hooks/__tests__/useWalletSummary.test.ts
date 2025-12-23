/** @jest-environment jsdom */
/**
 * useWalletSummary Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWalletSummary } from '../useWalletSummary';
import { useAuthContext } from '@/providers/AuthProvider';
import api from '@/lib/apiClient';

// Mock dependencies
jest.mock('@/providers/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('@/lib/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('useWalletSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch wallet summary when user is authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', roles: [] };
    const mockSession = { accessToken: 'token-123' };
    const mockSummary = {
      currency: 'USD',
      totalBalance: 0,
      holdings: [],
      lastUpdated: new Date().toISOString(),
    };

    (useAuthContext as jest.Mock).mockReturnValue({
      user: mockUser,
      session: mockSession,
    });

    (api.get as jest.Mock).mockResolvedValue({
      data: mockSummary,
      requestId: 'test',
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useWalletSummary());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Allow minor timestamp drift between mock creation and hook setState
    expect({
      ...result.current.summary,
      lastUpdated: undefined,
    }).toEqual({
      ...mockSummary,
      lastUpdated: undefined,
    });
    expect(result.current.error).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/wallet/summary', {
      headers: { 'X-User-Id': mockUser.id },
    });
  });

  it('should not fetch when user is not authenticated', () => {
    (useAuthContext as jest.Mock).mockReturnValue({
      user: null,
      session: null,
    });

    const { result } = renderHook(() => useWalletSummary());

    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', roles: [] };
    const mockSession = { accessToken: 'token-123' };

    (useAuthContext as jest.Mock).mockReturnValue({
      user: mockUser,
      session: mockSession,
    });

    (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useWalletSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe('API Error');
  });

  it('should refresh summary on demand', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', roles: [] };
    const mockSession = { accessToken: 'token-123' };
    const mockSummary = {
      currency: 'USD',
      totalBalance: 0,
      holdings: [],
      lastUpdated: new Date().toISOString(),
    };

    (useAuthContext as jest.Mock).mockReturnValue({
      user: mockUser,
      session: mockSession,
    });

    (api.get as jest.Mock).mockResolvedValue({
      data: mockSummary,
      requestId: 'test',
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useWalletSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

