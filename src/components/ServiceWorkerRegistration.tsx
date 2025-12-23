'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only clean up in production-like secure contexts
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const isSecureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecureContext) {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    const unregisterServiceWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));

        if ('caches' in window && caches) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      } catch (error) {
        logger.error('Service worker cleanup failed', error instanceof Error ? error : undefined);
      }
    };

    unregisterServiceWorkers();
  }, []);

  return null;
}
