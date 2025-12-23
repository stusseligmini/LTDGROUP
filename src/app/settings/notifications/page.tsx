'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';

interface NotificationSettings {
  emailNotifications: {
    transactionAlerts: boolean;
    cardActivity: boolean;
    securityAlerts: boolean;
    marketingEmails: boolean;
  };
  pushNotifications: {
    transactionAlerts: boolean;
    cardActivity: boolean;
    securityAlerts: boolean;
    casinoWins: boolean;
  };
  telegramNotifications: {
    transactionAlerts: boolean;
    cardActivity: boolean;
    securityAlerts: boolean;
    casinoWins: boolean;
  };
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/splash');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const data = await api.get<{ settings: NotificationSettings }>('/user/notifications');
      setSettings(data.settings);
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      await api.patch('/user/notifications', settings);
      setSuccess('Notification settings updated successfully');
    } catch (err: any) {
      console.error('Error updating settings:', err);
      setError(err.message || 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (category: keyof NotificationSettings, key: string, value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    });
  };

  if (authLoading || !settings) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading notification settings...</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Notification Settings</h1>
          <p className="text-gray-400">Manage how you receive notifications</p>
        </div>

        {/* Navigation tabs */}
        <div className="modern-card p-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => router.push('/settings')}
              className="px-4 py-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Profile
            </button>
            <button
              onClick={() => router.push('/settings/security')}
              className="px-4 py-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Security
            </button>
            <button
              onClick={() => router.push('/settings/notifications')}
              className="px-4 py-2 rounded-lg bg-cyan-primary/20 text-cyan-primary font-semibold whitespace-nowrap"
            >
              Notifications
            </button>
            <button
              onClick={() => router.push('/settings/telegram')}
              className="px-4 py-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Telegram
            </button>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="modern-card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-cyan-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Email Notifications</h2>
          </div>

          <div className="space-y-3">
            {Object.entries(settings.emailNotifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-dark-surface">
                <div>
                  <div className="font-semibold text-white capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-sm text-gray-400">
                    {key === 'transactionAlerts' && 'Get notified about all transactions'}
                    {key === 'cardActivity' && 'Receive alerts for card payments and changes'}
                    {key === 'securityAlerts' && 'Important security notifications'}
                    {key === 'marketingEmails' && 'Product updates and promotions'}
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('emailNotifications', key, !value)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    value ? 'bg-cyan-primary' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      value ? 'transform translate-x-6' : ''
                    }`}
                  ></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Push Notifications */}
        <div className="modern-card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-cyan-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-xl font-bold text-white">Push Notifications</h2>
          </div>

          <div className="space-y-3">
            {Object.entries(settings.pushNotifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-dark-surface">
                <div>
                  <div className="font-semibold text-white capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-sm text-gray-400">
                    {key === 'transactionAlerts' && 'Real-time transaction notifications'}
                    {key === 'cardActivity' && 'Instant card payment alerts'}
                    {key === 'securityAlerts' && 'Critical security updates'}
                    {key === 'casinoWins' && 'Get notified when you win at casinos'}
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('pushNotifications', key, !value)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    value ? 'bg-cyan-primary' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      value ? 'transform translate-x-6' : ''
                    }`}
                  ></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Telegram Notifications */}
        <div className="modern-card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-cyan-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Telegram Notifications</h2>
          </div>

          <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30 mb-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-yellow-400 mb-1">Link Your Telegram Account</div>
                <div className="text-sm text-yellow-400/80">
                  Connect your Telegram to receive notifications. Go to the Telegram tab to link your account.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(settings.telegramNotifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-dark-surface">
                <div>
                  <div className="font-semibold text-white capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-sm text-gray-400">
                    {key === 'transactionAlerts' && 'Transaction updates via Telegram'}
                    {key === 'cardActivity' && 'Card payment alerts on Telegram'}
                    {key === 'securityAlerts' && 'Security notifications on Telegram'}
                    {key === 'casinoWins' && 'Casino win notifications on Telegram'}
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('telegramNotifications', key, !value)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    value ? 'bg-cyan-primary' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      value ? 'transform translate-x-6' : ''
                    }`}
                  ></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="cel-error">
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="modern-card p-4 bg-green-500/20 border-2 border-green-500/30">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        <button
          onClick={handleSaveSettings}
          disabled={isLoading}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Notification Settings'}
        </button>
      </div>
    </DashboardShell>
  );
}
