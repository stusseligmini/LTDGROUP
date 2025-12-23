import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface Notification {
  id: string;
  type: 'transaction' | 'alert' | 'update' | 'security';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  icon: string;
  action?: {
    label: string;
    url: string;
  };
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'transactions' | 'alerts'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await axios.put(
        `${process.env.API_BASE_URL}/api/notifications/${notificationId}`,
        { read: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await axios.delete(`${process.env.API_BASE_URL}/api/notifications/${notificationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/notifications/mark-all-read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    if (filter === 'transactions') return n.type === 'transaction';
    if (filter === 'alerts') return ['alert', 'security'].includes(n.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'transaction':
        return '#dbeafe';
      case 'alert':
        return '#fecaca';
      case 'security':
        return '#fed7aa';
      case 'update':
        return '#d1d5db';
      default:
        return '#e5e7eb';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Mark All Read */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.unreadBadge}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['all', 'unread', 'transactions', 'alerts'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>
            {filter === 'all' ? 'No notifications' : 'No notifications in this category'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.notificationCard,
                !item.read && styles.notificationCardUnread,
              ]}
            >
              <View style={styles.notificationContent}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getNotificationColor(item.type) },
                  ]}
                >
                  <Text style={styles.icon}>{item.icon}</Text>
                </View>

                <View style={styles.textContent}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.message} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <Text style={styles.timestamp}>
                    {new Date(item.timestamp * 1000).toLocaleDateString()}{' '}
                    {new Date(item.timestamp * 1000).toLocaleTimeString()}
                  </Text>
                </View>

                {!item.read && <View style={styles.unreadDot} />}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => markAsRead(item.id)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>
                    {item.read ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => deleteNotification(item.id)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Settings Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.settingLink}>
          <Text style={styles.settingText}>🔔 Notification Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  unreadBadge: {
    color: '#6366f1',
    fontSize: 12,
    marginTop: 4,
  },
  markAllText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  notificationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  notificationCardUnread: {
    backgroundColor: '#1a2332',
  },
  notificationContent: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
  textContent: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  actionText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLink: {
    paddingVertical: 8,
  },
  settingText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
});
