/**
 * Higher-order component to protect components with reCAPTCHA
 * 
 * Usage:
 * export default withRecaptchaProtection(MyComponent, {
 *   action: 'wallet_create',
 *   minScore: 0.5,
 *   onVerificationFailed: (score) => console.log('Bot detected:', score)
 * });
 */

'use client';

import { ComponentType, useEffect, useState } from 'react';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { executeAndVerifyRecaptcha } from '@/lib/recaptcha/client';
import { RecaptchaAction } from '@/config/recaptcha';

export interface RecaptchaProtectionOptions {
  action: RecaptchaAction | string;
  minScore?: number;
  onVerificationFailed?: (score: number, reasons: string[]) => void;
  loadingComponent?: ComponentType;
  blockedComponent?: ComponentType<{ score: number; reasons: string[] }>;
}

export function withRecaptchaProtection<P extends object>(
  Component: ComponentType<P>,
  options: RecaptchaProtectionOptions
) {
  return function RecaptchaProtectedComponent(props: P) {
    const { executeRecaptcha, ready } = useRecaptcha();
    const [verified, setVerified] = useState<boolean | null>(null);
    const [score, setScore] = useState(0);
    const [reasons, setReasons] = useState<string[]>([]);

    useEffect(() => {
      if (!ready) return;

      const verify = async () => {
        const result = await executeAndVerifyRecaptcha(
          executeRecaptcha,
          options.action
        );

        const minScore = options.minScore ?? 0.5;
        const isVerified = result.success && result.score >= minScore;

        setVerified(isVerified);
        setScore(result.score);
        setReasons(result.reasons);

        if (!isVerified && options.onVerificationFailed) {
          options.onVerificationFailed(result.score, result.reasons);
        }
      };

      verify();
    }, [ready, executeRecaptcha]);

    // Loading state
    if (!ready || verified === null) {
      if (options.loadingComponent) {
        const LoadingComponent = options.loadingComponent;
        return <LoadingComponent />;
      }
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Verifying security...</p>
          </div>
        </div>
      );
    }

    // Blocked state
    if (!verified) {
      if (options.blockedComponent) {
        const BlockedComponent = options.blockedComponent;
        return <BlockedComponent score={score} reasons={reasons} />;
      }
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">🛡️</div>
            <h2 className="text-xl font-semibold mb-2">Security Check Failed</h2>
            <p className="text-muted-foreground">
              We detected unusual activity. Please try again later or contact support.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Risk score: {(score * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      );
    }

    // Verified - render component
    return <Component {...props} />;
  };
}
