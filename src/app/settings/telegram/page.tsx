'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiClient';

interface TelegramStatus {
  isLinked: boolean;
  username?: string;
  linkedAt?: string;
}

export default function TelegramSettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
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
      fetchTelegramStatus();
    }
  }, [user]);

  const fetchTelegramStatus = async () => {
    try {
      const data = await api.get<{ status: TelegramStatus }>('/user/telegram/status');
      setStatus(data.status);
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    }
  };

  const handleGenerateLinkCode = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const data = await api.post<{ code: string }>('/user/telegram/generate-link-code', {});
      setLinkCode(data.code);
      setSuccess('Link code generated! Send it to @celorawalletbot on Telegram');
    } catch (err: any) {
      console.error('Error generating link code:', err);
      setError(err.message || 'Failed to generate link code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Are you sure you want to unlink your Telegram account?')) {
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      await api.post('/user/telegram/unlink', {});
      setStatus({ isLinked: false });
      setSuccess('Telegram account unlinked successfully');
    } catch (err: any) {
      console.error('Error unlinking Telegram:', err);
      setError(err.message || 'Failed to unlink Telegram');
    } finally {
      setIsLoading(false);
    }
  };

  const openTelegram = () => {
    window.open('https://t.me/celorawalletbot', '_blank');
  };

  if (authLoading || !status) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading Telegram settings...</span>
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
          <h1 className="text-3xl font-bold text-white mb-2">Telegram Integration</h1>
          <p className="text-gray-400">Connect your Celora wallet to Telegram</p>
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
              className="px-4 py-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Notifications
            </button>
            <button
              onClick={() => router.push('/settings/telegram')}
              className="px-4 py-2 rounded-lg bg-cyan-primary/20 text-cyan-primary font-semibold whitespace-nowrap"
            >
              Telegram
            </button>
          </div>
        </div>

        {/* Connection status */}
        <div className="modern-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-cyan-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
            </svg>
            <div>
              <h2 className="text-2xl font-bold text-white">Connection Status</h2>
              {status.isLinked ? (
                <p className="text-green-400 text-sm">Connected to @celorawalletbot</p>
              ) : (
                <p className="text-gray-400 text-sm">Not connected</p>
              )}
            </div>
          </div>

          {status.isLinked ? (
            <div className="p-6 rounded-lg bg-green-500/10 border-2 border-green-500/30 space-y-3">
              <div className="flex items-center gap-2 text-green-400 mb-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-bold text-lg">Account Linked</span>
              </div>

              {status.username && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Telegram Username</span>
                  <span className="text-white font-semibold">@{status.username}</span>
                </div>
              )}

              {status.linkedAt && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Linked At</span>
                  <span className="text-white font-semibold">
                    {new Date(status.linkedAt).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={openTelegram}
                  className="btn-outline flex-1 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
                  </svg>
                  Open Bot
                </button>
                <button
                  onClick={handleUnlinkTelegram}
                  disabled={isLoading}
                  className="px-6 py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border-2 border-red-500/50 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Unlink
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600">
                <h3 className="font-semibold text-white mb-2">How to Link Your Account</h3>
                <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                  <li>Click &quot;Generate Link Code&quot; below</li>
                  <li>Open Telegram and start a chat with @celorawalletbot</li>
                  <li>Send the generated code to the bot</li>
                  <li>Your account will be linked automatically!</li>
                </ol>
              </div>

              {linkCode && (
                <div className="p-6 rounded-lg bg-cyan-primary/10 border-2 border-cyan-primary/50 space-y-3">
                  <div className="font-semibold text-white mb-2">Your Link Code:</div>
                  <div className="p-4 bg-dark-surface rounded-lg">
                    <div className="text-3xl font-mono text-cyan-primary text-center tracking-wider">
                      {linkCode}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    This code expires in 10 minutes. Send it to @celorawalletbot to link your account.
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleGenerateLinkCode}
                  disabled={isLoading}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Generating...' : linkCode ? 'Generate New Code' : 'Generate Link Code'}
                </button>
                <button
                  onClick={openTelegram}
                  className="btn-outline flex-1 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
                  </svg>
                  Open Bot
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bot features */}
        <div className="modern-card p-6 space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Bot Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-dark-surface">
              <div className="text-2xl mb-2">🔔</div>
              <h3 className="font-semibold text-white mb-1">Real-time Notifications</h3>
              <p className="text-sm text-gray-400">
                Get instant alerts for transactions, card activity, and security events
              </p>
            </div>

            <div className="p-4 rounded-lg bg-dark-surface">
              <div className="text-2xl mb-2">💰</div>
              <h3 className="font-semibold text-white mb-1">Balance Checks</h3>
              <p className="text-sm text-gray-400">
                Check your wallet balances directly from Telegram
              </p>
            </div>

            <div className="p-4 rounded-lg bg-dark-surface">
              <div className="text-2xl mb-2">🎰</div>
              <h3 className="font-semibold text-white mb-1">Casino Wins</h3>
              <p className="text-sm text-gray-400">
                Celebrate your wins with instant notifications
              </p>
            </div>

            <div className="p-4 rounded-lg bg-dark-surface">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="font-semibold text-white mb-1">Security Alerts</h3>
              <p className="text-sm text-gray-400">
                Stay informed about important security events
              </p>
            </div>
          </div>
        </div>

        {/* Bot commands */}
        <div className="modern-card p-6 space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Available Commands</h2>

          <div className="space-y-3 font-mono text-sm">
            <div className="p-3 rounded-lg bg-dark-surface">
              <div className="text-cyan-primary font-bold mb-1">/start</div>
              <div className="text-gray-400">Initialize the bot and see welcome message</div>
            </div>

            <div className="p-3 rounded-lg bg-dark-surface">
              <div className="text-cyan-primary font-bold mb-1">/celowallet</div>
              <div className="text-gray-400">View your wallet balances</div>
            </div>

            <div className="p-3 rounded-lg bg-dark-surface">
              <div className="text-cyan-primary font-bold mb-1">/cla</div>
              <div className="text-gray-400">Check card and account status</div>
            </div>

            <div className="p-3 rounded-lg bg-dark-surface">
              <div className="text-cyan-primary font-bold mb-1">/help</div>
              <div className="text-gray-400">Show all available commands</div>
            </div>
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
      </div>
    </DashboardShell>
  );
}
