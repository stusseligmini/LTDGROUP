/**
 * Telemetry Module
 * Lightweight console-based telemetry; integrate with your chosen analytics or tracing platform as needed.
 */

export interface TelemetryEvent {
  name: string;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
}

export interface TelemetryError {
  error: Error;
  properties?: Record<string, string>;
  severityLevel?: 'Verbose' | 'Information' | 'Warning' | 'Error' | 'Critical';
}

export interface TelemetryTrace {
  message: string;
  properties?: Record<string, string>;
  severityLevel?: 'Verbose' | 'Information' | 'Warning' | 'Error' | 'Critical';
}

export interface TelemetryMetric {
  name: string;
  average: number;
  sampleCount?: number;
  min?: number;
  max?: number;
  properties?: Record<string, string>;
}

const ENABLE_DEBUG = process.env.NODE_ENV === 'development';

export function initializeAppInsights(): null {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry] Initialized (console logging mode)');
  }
  return null;
}

export function getReactPlugin(): null {
  return null;
}

export function trackEvent({ name, properties, measurements }: TelemetryEvent): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry Event]', name, { properties, measurements });
  }
}

export function trackError({ error, properties, severityLevel }: TelemetryError): void {
  console.error('[Telemetry Error]', error, { properties, severityLevel });
}

export function trackTrace({ message, properties, severityLevel }: TelemetryTrace): void {
  if (ENABLE_DEBUG || severityLevel === 'Error' || severityLevel === 'Critical') {
    console.log('[Telemetry Trace]', message, { properties, severityLevel });
  }
}

export function trackMetric(metric: TelemetryMetric): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry Metric]', metric);
  }
}

export function trackPageView(name?: string): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry PageView]', name || (typeof window !== 'undefined' ? window?.location?.pathname : 'unknown'));
  }
}

export function trackAuthSuccess(userId: string, provider: string): void {
  trackEvent({
    name: TelemetryEvents.AUTH_SUCCESS,
    properties: { userId, provider },
  });
}

export function trackAuthFailure(error: string, provider: string): void {
  trackEvent({
    name: TelemetryEvents.AUTH_FAILURE,
    properties: { error, provider },
  });
}

export function setAuthenticatedUser(userId: string): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry] Set authenticated user:', userId);
  }
}

export function clearAuthenticatedUser(): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry] Clear authenticated user');
  }
}

export function startTrackEvent(name: string): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry] Start tracking event:', name);
  }
}

export function stopTrackEvent(name: string, properties?: Record<string, string>): void {
  if (ENABLE_DEBUG) {
    console.log('[Telemetry] Stop tracking event:', name, properties);
  }
}

export function flush(): Promise<void> {
  return Promise.resolve();
}

export enum TelemetryEvents {
  AUTH_SUCCESS = 'auth.success',
  AUTH_FAILURE = 'auth.failure',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_REFRESH = 'auth.token_refresh',
  WALLET_CREATED = 'wallet.created',
  WALLET_IMPORTED = 'wallet.imported',
  TRANSACTION_INITIATED = 'transaction.initiated',
  TRANSACTION_COMPLETED = 'transaction.completed',
  TRANSACTION_FAILED = 'transaction.failed',
  CARD_CREATED = 'card.created',
  CARD_AUTHORIZATION = 'card.authorization',
  CARD_DECLINED = 'card.declined',
  API_CALL = 'api.call',
  API_ERROR = 'api.error',
  PAGE_VIEW = 'page.view',
  ERROR_BOUNDARY = 'error.boundary',
}
