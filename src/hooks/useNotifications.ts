'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/apiClient';
import { NotificationItem } from '@/types/api';
import { useAuthContext } from '@/providers/AuthProvider';

interface NotificationState {
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
}

export function useNotifications() {
  const { session } = useAuthContext();
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    loading: false,
    error: null,
  });

  const fetchNotifications = useCallback(async () => {
    if (!session?.accessToken) {
      setState((prev) => ({ ...prev, notifications: [], error: null, loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get<{ success: boolean; notifications: NotificationItem[] }>('/notifications');
      const items = Array.isArray(response?.notifications) ? response.notifications : [];
      const sorted = items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setState({
        notifications: sorted,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load notifications', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load notifications',
      }));
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => state.notifications.filter((notification) => !notification.read).length,
    [state.notifications]
  );

  return {
    notifications: state.notifications,
    loading: state.loading,
    error: state.error,
    unreadCount,
    refresh: fetchNotifications,
  };
}

