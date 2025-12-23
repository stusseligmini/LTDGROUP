/** @jest-environment jsdom */
/**
 * useNotifications Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
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

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch notifications when authenticated', async () => {
    const mockSession = { accessToken: 'token-123' };
    const mockNotifications = [
      {
        id: 'notif-1',
        type: 'transaction',
        title: 'Payment Received',
        body: 'You received 1 CELO',
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        type: 'security',
        title: 'New Login',
        body: 'Your account was accessed',
        read: true,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    (useAuthContext as jest.Mock).mockReturnValue({
      session: mockSession,
    });

    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      notifications: mockNotifications,
    });

    const { result } = renderHook(() => useNotifications());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when not authenticated', () => {
    (useAuthContext as jest.Mock).mockReturnValue({
      session: null,
    });

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const mockSession = { accessToken: 'token-123' };

    (useAuthContext as jest.Mock).mockReturnValue({
      session: mockSession,
    });

    (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.error).toBe('API Error');
  });

  it('should calculate unread count correctly', async () => {
    const mockSession = { accessToken: 'token-123' };
    const mockNotifications = [
      { id: '1', read: false, createdAt: new Date().toISOString() },
      { id: '2', read: true, createdAt: new Date().toISOString() },
      { id: '3', read: false, createdAt: new Date().toISOString() },
    ];

    (useAuthContext as jest.Mock).mockReturnValue({
      session: mockSession,
    });

    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      notifications: mockNotifications,
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.unreadCount).toBe(2);
  });
});

