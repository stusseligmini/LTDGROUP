/**
 * Server-side Application Insights Telemetry
 * 
 * Provides server-side telemetry tracking for:
 * - API route handlers
 * - Server actions
 * - Database operations
 * - Background jobs
 * 
 * Note: Install with `npm install applicationinsights`
 */

// ============================================================================
// Types
// ============================================================================

export type SeverityLevel = 'Verbose' | 'Information' | 'Warning' | 'Error' | 'Critical';

export interface ServerTelemetryConfig {
  connectionString: string;
  samplingPercentage?: number;
  enableAutoCollect?: boolean;
}

export interface ServerTelemetryEvent {
  name: string;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
}

export interface ServerTelemetryTrace {
  message: string;
  properties?: Record<string, string>;
  severityLevel?: SeverityLevel;
}

export interface ServerTelemetryException {
  exception: Error;
  properties?: Record<string, string>;
  severityLevel?: SeverityLevel;
}

export interface ServerTelemetryDependency {
  target: string;
  name: string;
  data: string;
  duration: number;
  resultCode: string | number;
  success: boolean;
  dependencyTypeName?: string;
  properties?: Record<string, string>;
}

// ============================================================================
// Configuration
// ============================================================================

type TelemetryClient = any;
let telemetryClient: TelemetryClient | null = null;
let isInitialized = false;

const CONNECTION_STRING = process.env.APPINSIGHTS_CONNECTION_STRING || '';
const SAMPLING_PERCENTAGE = parseInt(process.env.APPINSIGHTS_SAMPLING_PERCENTAGE || '100', 10);
const ENABLE_AUTO_COLLECT = process.env.APPINSIGHTS_AUTO_COLLECT !== 'false';

/**
 * Initialize Application Insights for server-side tracking
 */
export function initializeServerTelemetry(config?: Partial<ServerTelemetryConfig>): void {
  // Azure Application Insights removed from stack; disable telemetry initialization.
  if (isInitialized) return;
  console.warn('[ServerTelemetry] Application Insights disabled (package removed)');
  telemetryClient = null; // Explicitly null to force console fallback paths.
  isInitialized = true;
}

/**
 * Get the server telemetry client
 */
export function getServerTelemetryClient(): TelemetryClient | null {
  if (!isInitialized) {
    initializeServerTelemetry();
  }
  return telemetryClient;
}

// ============================================================================
// Telemetry Tracking Functions
// ============================================================================

/**
 * Track a custom event
 */
export function trackServerEvent(event: ServerTelemetryEvent): void {
  if (!telemetryClient) {
    console.log('[ServerTelemetry] Event:', event.name);
    return;
  }

  try {
    telemetryClient.trackEvent({
      name: event.name,
      properties: event.properties,
      measurements: event.measurements,
    });
  } catch (error) {
    console.error('[ServerTelemetry] Failed to track event:', error);
  }
}

/**
 * Track a trace message
 */
export function trackServerTrace(trace: ServerTelemetryTrace): void {
  if (!telemetryClient) {
    console.log('[ServerTelemetry] Trace:', trace.message);
    return;
  }

  try {
    telemetryClient.trackTrace({
      message: trace.message,
      severity: mapSeverityLevel(trace.severityLevel),
      properties: trace.properties,
    });
  } catch (error) {
    console.error('[ServerTelemetry] Failed to track trace:', error);
  }
}

/**
 * Track an exception
 */
export function trackServerException(exception: ServerTelemetryException): void {
  if (!telemetryClient) {
    console.error('[ServerTelemetry] Exception:', exception.exception);
    return;
  }

  try {
    telemetryClient.trackException({
      exception: exception.exception,
      severity: mapSeverityLevel(exception.severityLevel || 'Error'),
      properties: exception.properties,
    });
  } catch (error) {
    console.error('[ServerTelemetry] Failed to track exception:', error);
  }
}

/**
 * Track a dependency call (external service, database, etc.)
 */
export function trackServerDependency(dependency: ServerTelemetryDependency): void {
  if (!telemetryClient) {
    console.log('[ServerTelemetry] Dependency:', dependency.name);
    return;
  }

  try {
    telemetryClient.trackDependency({
      target: dependency.target,
      name: dependency.name,
      data: dependency.data,
      duration: dependency.duration,
      resultCode: dependency.resultCode,
      success: dependency.success,
      dependencyTypeName: dependency.dependencyTypeName || 'HTTP',
      properties: dependency.properties,
    });
  } catch (error) {
    console.error('[ServerTelemetry] Failed to track dependency:', error);
  }
}

/**
 * Track a custom metric
 */
export function trackServerMetric(name: string, value: number, properties?: Record<string, string>): void {
  if (!telemetryClient) {
    console.log('[ServerTelemetry] Metric:', name, value);
    return;
  }

  try {
    telemetryClient.trackMetric({
      name,
      value,
      properties,
    });
  } catch (error) {
    console.error('[ServerTelemetry] Failed to track metric:', error);
  }
}

/**
 * Flush telemetry data immediately
 */
export function flushServerTelemetry(): Promise<void> {
  if (!telemetryClient) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    telemetryClient!.flush({
      callback: () => {
        resolve();
      },
    });
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapSeverityLevel(level?: SeverityLevel): number {
  switch (level) {
    case 'Verbose':
      return 0;
    case 'Information':
      return 1;
    case 'Warning':
      return 2;
    case 'Error':
      return 3;
    case 'Critical':
      return 4;
    default:
      return 1;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Track API route handler
 */
export async function trackApiRoute<T>(
  routeName: string,
  method: string,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let statusCode = 200;
  let success = true;

  try {
    const result = await handler();
    return result;
  } catch (error) {
    success = false;
    statusCode = error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500;
    
    trackServerException({
      exception: error as Error,
      properties: {
        routeName,
        method,
      },
      severityLevel: 'Error',
    });
    
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    
    trackServerEvent({
      name: success ? 'api.route.success' : 'api.route.failure',
      properties: {
        routeName,
        method,
        statusCode: statusCode.toString(),
      },
      measurements: {
        duration,
      },
    });

    // Track slow API routes
    if (duration > 2000) {
      trackServerEvent({
        name: 'api.route.slow',
        properties: {
          routeName,
          method,
        },
        measurements: {
          duration,
        },
      });
    }
  }
}

/**
 * Track database operation
 */
export async function trackDatabaseOperation<T>(
  operation: string,
  model: string,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = true;

  try {
    const result = await handler();
    return result;
  } catch (error) {
    success = false;
    
    trackServerException({
      exception: error as Error,
      properties: {
        operation,
        model,
      },
      severityLevel: 'Error',
    });
    
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    
    trackServerDependency({
      target: 'database',
      name: `${model}.${operation}`,
      data: operation,
      duration,
      resultCode: success ? 200 : 500,
      success,
      dependencyTypeName: 'SQL',
      properties: {
        model,
      },
    });
  }
}

/**
 * Track external API call
 */
export async function trackExternalApi<T>(
  apiName: string,
  endpoint: string,
  method: string,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let statusCode = 200;
  let success = true;

  try {
    const result = await handler();
    return result;
  } catch (error) {
    success = false;
    statusCode = error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500;
    
    trackServerException({
      exception: error as Error,
      properties: {
        apiName,
        endpoint,
        method,
      },
      severityLevel: 'Warning',
    });
    
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    
    trackServerDependency({
      target: apiName,
      name: endpoint,
      data: `${method} ${endpoint}`,
      duration,
      resultCode: statusCode,
      success,
      dependencyTypeName: 'HTTP',
      properties: {
        method,
      },
    });
  }
}

/**
 * Track authentication event
 */
export function trackAuthEvent(
  eventType: 'login' | 'logout' | 'refresh' | 'failure',
  userId?: string,
  error?: string
): void {
  trackServerEvent({
    name: `auth.${eventType}`,
    properties: {
      userId: userId || 'unknown',
      error: error || '',
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Shutdown
// ============================================================================

/**
 * Gracefully shutdown telemetry client
 */
export async function shutdownServerTelemetry(): Promise<void> {
  if (!telemetryClient) {
    return;
  }

  try {
    await flushServerTelemetry();
    console.log('[ServerTelemetry] Shutdown complete');
  } catch (error) {
    console.error('[ServerTelemetry] Shutdown failed:', error);
  }
}
