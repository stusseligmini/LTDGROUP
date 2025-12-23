/**
 * reCAPTCHA badge component
 * Shows "Protected by reCAPTCHA" badge (required by terms of service)
 */

'use client';

import { recaptchaConfig } from '@/config/recaptcha';

export function RecaptchaBadge() {
  // Only show if reCAPTCHA is configured
  if (!recaptchaConfig.v3.siteKey) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground text-center py-4">
      This site is protected by reCAPTCHA and the Google{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        Privacy Policy
      </a>{' '}
      and{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        Terms of Service
      </a>{' '}
      apply.
    </div>
  );
}
