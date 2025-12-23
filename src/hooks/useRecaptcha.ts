/**
 * React hook for reCAPTCHA v3 (invisible) integration
 * 
 * Usage:
 * const { executeRecaptcha, ready } = useRecaptcha();
 * const token = await executeRecaptcha('login');
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { recaptchaConfig, RecaptchaAction } from '@/config/recaptcha';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export function useRecaptcha() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load reCAPTCHA script
    const siteKey = recaptchaConfig.v3.siteKey;
    
    if (!siteKey) {
      console.warn('reCAPTCHA site key not configured');
      return;
    }

    // Check if script already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => setReady(true));
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      window.grecaptcha?.ready(() => setReady(true));
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const executeRecaptcha = useCallback(
    async (action: RecaptchaAction | string): Promise<string | null> => {
      if (!ready || !window.grecaptcha) {
        console.warn('reCAPTCHA not ready');
        return null;
      }

      const siteKey = recaptchaConfig.v3.siteKey;
      if (!siteKey) {
        console.warn('reCAPTCHA site key not configured');
        return null;
      }

      try {
        const token = await window.grecaptcha.execute(siteKey, { action });
        return token;
      } catch (error) {
        console.error('reCAPTCHA execution failed:', error);
        return null;
      }
    },
    [ready]
  );

  return {
    executeRecaptcha,
    ready,
  };
}
