'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { useTelegramMiniApp } from '@/components/telegram/TelegramMiniAppProvider';
import { useAuthContext } from '@/providers/AuthProvider';

function LinkTelegramPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMiniApp, user: telegramUser, ready } = useTelegramMiniApp();
  const { user } = useAuthContext();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const telegramId = searchParams?.get('telegram_id') || null;

  const handleLink = useCallback(async (id: string, username?: string) => {
    if (!user) {
      setError('Please sign in to link your Telegram account');
      return;
    }

    setLinking(true);
    setError(null);

    try {
      const response = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          telegramId: id,
          telegramUsername: username,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to link Telegram account');
      }

      setSuccess(true);
      
      // Redirect to wallet after 2 seconds
      setTimeout(() => {
        if (isMiniApp) {
          router.push('/wallet');
        } else {
          router.push('/wallet');
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to link Telegram account');
    } finally {
      setLinking(false);
    }
  }, [user, isMiniApp, router]);

  useEffect(() => {
    // If Telegram user is available and user is authenticated, auto-link
    if (ready && user && telegramUser && !linking && !success) {
      handleLink(telegramUser.id.toString(), telegramUser.username);
    }
  }, [ready, user, telegramUser, linking, success, handleLink]);

  if (!ready) {
    return (
      <AppShell title="Link Telegram" subtitle="Connecting...">
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <LoadingSpinner size="lg" message="Loading..." />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Link Telegram" subtitle="Sign in required">
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <ErrorDisplay
                error="Please sign in to link your Telegram account"
                title="Sign In Required"
                onRetry={() => router.push('/')}
                retryLabel="Go to Sign In"
              />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Link Telegram" subtitle="Connect your Telegram account">
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        {success ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-4">
                <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-green-900 mb-2">Successfully Linked!</h2>
              <p className="text-green-700">Your Telegram account has been linked to your Celora wallet.</p>
              <p className="text-sm text-green-600 mt-2">Redirecting to wallet...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Link Telegram Account</CardTitle>
              <CardDescription>
                Connect your Telegram account to use wallet commands and receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {telegramUser ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Telegram User:</strong> @{telegramUser.username || telegramUser.id}
                    </p>
                  </div>
                  
                  {error && (
                    <ErrorDisplay error={error} variant="inline" />
                  )}

                  <Button
                    onClick={() => handleLink(telegramUser.id.toString(), telegramUser.username)}
                    disabled={linking}
                    className="w-full touch-target"
                  >
                    {linking ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner size="sm" />
                        <span>Linking...</span>
                      </span>
                    ) : (
                      'Link Telegram Account'
                    )}
                  </Button>
                </>
              ) : telegramId ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Telegram ID: {telegramId}
                    </p>
                  </div>
                  
                  {error && (
                    <ErrorDisplay error={error} variant="inline" />
                  )}

                  <Button
                    onClick={() => handleLink(telegramId, undefined)}
                    disabled={linking}
                    className="w-full touch-target"
                  >
                    {linking ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner size="sm" />
                        <span>Linking...</span>
                      </span>
                    ) : (
                      'Link Telegram Account'
                    )}
                  </Button>
                </>
              ) : (
                <ErrorDisplay
                  error="No Telegram information found. Please access this page from Telegram."
                  title="Telegram Required"
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default function LinkTelegramPage() {
  return (
    <Suspense fallback={<AppShell title="Link Telegram" subtitle="Loading..."><div className="p-8 text-slate-300">Loading…</div></AppShell>}>
      <LinkTelegramPageInner />
    </Suspense>
  );
}

