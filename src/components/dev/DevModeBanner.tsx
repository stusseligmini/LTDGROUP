'use client';

import { useEffect, useState } from 'react';
import { isFirebaseClientConfigured } from '@/lib/firebase/client';

export function DevModeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV === 'development') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const configured = isFirebaseClientConfigured;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`rounded-lg border p-4 shadow-lg backdrop-blur-sm ${
        configured 
          ? 'bg-green-900/80 border-green-500/50 text-green-100' 
          : 'bg-yellow-900/80 border-yellow-500/50 text-yellow-100'
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {configured ? (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">
              {configured ? '🔥 Firebase Connected' : '⚠️ Development Mode'}
            </h3>
            <p className="text-xs opacity-90">
              {configured 
                ? 'Auth & database ready. Check console for any warnings.'
                : 'Firebase not configured. Add credentials to .env.local to enable auth.'}
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
