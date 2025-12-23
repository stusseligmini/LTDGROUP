'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  activeSessions: number;
  lastPasswordChange?: string;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      fetchSecuritySettings();
    }
  }, [user]);

  const fetchSecuritySettings = async () => {
    try {
      const data = await api.get<{ settings: SecuritySettings }>('/user/security');
      setSettings(data.settings);
    } catch (err) {
      console.error('Error fetching security settings:', err);
    }
  };

  const handleChangePassword = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      await api.post('/user/change-password', {
        currentPassword,
        newPassword,
      });

      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      fetchSecuritySettings();
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const data = await api.post<{ settings: SecuritySettings }>('/user/2fa/toggle', {});
      setSettings(data.settings);
      setSuccess(data.settings.twoFactorEnabled ? '2FA enabled' : '2FA disabled');
    } catch (err: any) {
      console.error('Error toggling 2FA:', err);
      setError(err.message || 'Failed to toggle 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateAllSessions = async () => {
    if (!confirm('Are you sure you want to terminate all other sessions? You will remain logged in on this device.')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      await api.post('/user/sessions/terminate-all', {});

      setSuccess('All other sessions terminated');
      fetchSecuritySettings();
    } catch (err: any) {
      console.error('Error terminating sessions:', err);
      setError(err.message || 'Failed to terminate sessions');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !settings) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading security settings...</span>
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
          <h1 className="text-3xl font-bold text-white mb-2">Security Settings</h1>
          <p className="text-gray-400">Manage your account security</p>
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
              className="px-4 py-2 rounded-lg bg-cyan-primary/20 text-cyan-primary font-semibold whitespace-nowrap"
            >
              Security
            </button>
            <button
              onClick={() => router.push('/settings/notifications')}
              className="px-4 py-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors whitespace-nowrap"
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

        {/* Two-Factor Authentication */}
        <div className="modern-card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-400">
                Add an extra layer of security to your account
              </p>
            </div>
            <button
              onClick={handleToggle2FA}
              disabled={isLoading}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                settings.twoFactorEnabled
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 hover:bg-red-500/30'
                  : 'bg-cyan-primary/20 text-cyan-primary border-2 border-cyan-primary/50 hover:bg-cyan-primary/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {settings.twoFactorEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>

          {settings.twoFactorEnabled && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">2FA is enabled</span>
              </div>
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="modern-card p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Change Password</h2>
            {settings.lastPasswordChange && (
              <p className="text-sm text-gray-400">
                Last changed: {new Date(settings.lastPasswordChange).toLocaleString()}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="neon-input w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="neon-input w-full px-4 py-3"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="neon-input w-full px-4 py-3"
              />
            </div>
          </div>

          {error && (
            <div className="cel-error">
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/30">
              <p className="text-green-400">{success}</p>
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Changing...' : 'Change Password'}
          </button>
        </div>

        {/* Active Sessions */}
        <div className="modern-card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Active Sessions</h2>
            <p className="text-sm text-gray-400">
              Manage devices that are currently logged into your account
            </p>
          </div>

          <div className="p-4 rounded-lg bg-dark-surface">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">
                  {settings.activeSessions} active session{settings.activeSessions !== 1 ? 's' : ''}
                </div>
                <div className="text-sm text-gray-400">Including this device</div>
              </div>
              {settings.activeSessions > 1 && (
                <button
                  onClick={handleTerminateAllSessions}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Terminate All Others
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Security Recommendations */}
        <div className="modern-card p-6 space-y-3 bg-gradient-to-br from-purple-glow/5 to-cyan-primary/5">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-cyan-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-white mb-2">Security Best Practices</h3>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Use a strong, unique password</li>
                <li>Enable two-factor authentication</li>
                <li>Never share your password with anyone</li>
                <li>Regularly review your active sessions</li>
                <li>Log out from public or shared devices</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
