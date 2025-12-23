'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';

interface UserProfile {
  email: string;
  displayName?: string;
  createdAt: string;
  lastLogin: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
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
      fetchProfile();
    } else {
      setProfile(null);
      setDisplayName('');
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const data = await api.get<{ profile: UserProfile }>('/user/profile');
      setProfile(data.profile);
      setDisplayName(data.profile.displayName || '');
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const data = await api.patch<{ profile: UserProfile }>(
        '/user/profile',
        { displayName }
      );

      setProfile(data.profile);
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !profile) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading settings...</span>
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
          <h1 className="text-3xl font-bold heading-gradient mb-2">Settings</h1>
          <p className="text-gray-400">Manage your account preferences</p>
        </div>

        {/* Navigation tabs */}
        <div className="glass-panel border-gradient p-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => router.push('/settings')}
              className="px-4 py-2 rounded-lg bg-cyan-primary/20 text-cyan-primary font-semibold whitespace-nowrap"
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

        {/* Profile settings */}
        <div className="glass-panel border-gradient p-6 space-y-6">
          <h2 className="text-2xl font-bold text-white">Profile Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="neon-input w-full px-4 py-3 opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="neon-input w-full px-4 py-3"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Created
              </label>
              <input
                type="text"
                value={new Date(profile.createdAt).toLocaleString()}
                disabled
                className="neon-input w-full px-4 py-3 opacity-60 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Last Login
              </label>
              <input
                type="text"
                value={new Date(profile.lastLogin).toLocaleString()}
                disabled
                className="neon-input w-full px-4 py-3 opacity-60 cursor-not-allowed"
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
            onClick={handleUpdateProfile}
            disabled={isLoading || displayName === profile.displayName}
            className="btn-primary ring-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Danger zone */}
        <div className="glass-panel p-6 space-y-4 border-2 border-red-500/30">
          <h2 className="text-2xl font-bold text-red-400">Danger Zone</h2>
          <p className="text-gray-400">Irreversible and destructive actions</p>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                // TODO: Implement account deletion
                alert('Account deletion is not yet implemented');
              }
            }}
            className="w-full py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border-2 border-red-500/50 font-semibold transition-all"
          >
            Delete Account
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
