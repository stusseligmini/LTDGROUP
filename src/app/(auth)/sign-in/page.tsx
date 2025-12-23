"use client";
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { EmailPasswordForm } from '@/components/auth/EmailPasswordForm';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { PasskeyButton } from '@/components/auth/PasskeyButton';
import { TelegramLinkButton } from '@/components/auth/TelegramLinkButton';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'email'|'oauth'|'passkey'|'telegram'>('email');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign In</h1>
      <div className="flex gap-2 text-sm">
        <button onClick={() => setTab('email')} className={tab==='email' ? 'font-semibold' : ''}>Email</button>
        <button onClick={() => setTab('oauth')} className={tab==='oauth' ? 'font-semibold' : ''}>OAuth</button>
        <button onClick={() => setTab('passkey')} className={tab==='passkey' ? 'font-semibold' : ''}>Passkey</button>
        <button onClick={() => setTab('telegram')} className={tab==='telegram' ? 'font-semibold' : ''}>Telegram</button>
      </div>
      {tab==='email' && <EmailPasswordForm onAuth={() => {}} />}
      {tab==='oauth' && <OAuthButtons onAuth={() => {}} />}
      {tab==='passkey' && <PasskeyButton />}
      {tab==='telegram' && <TelegramLinkButton onLinked={() => {}} />}
      <div className="text-xs text-gray-500">Multi-provider authentication (Option B) scaffold ready.</div>
    </div>
  );
}
