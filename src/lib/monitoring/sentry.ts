/**
 * Sentry Error Monitoring Configuration
 * Tracks errors and performance issues in production
 * Optional: only requires @sentry/nextjs if NEXT_PUBLIC_SENTRY_DSN is set
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

let Sentry: any = { captureException: () => {}, captureMessage: () => {} };

// Only load Sentry if DSN is configured and package is available
if (SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SentryModule = require('@sentry/nextjs');
    Sentry = SentryModule;
    
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
      integrations: [
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.3,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch (e) {
    console.warn('[Sentry] @sentry/nextjs not installed. Install with: npm install @sentry/nextjs');
  }
}

export default Sentry;
