import { logger } from '../logger';

interface RequestLoggerOptions {
  endpoint: string;
  method: string;
  requestId?: string;
}

interface LogMetadata {
  [key: string]: unknown;
}

export function createRequestLogger(options: RequestLoggerOptions) {
  const requestId = options.requestId ?? crypto.randomUUID();
  const startTime = Date.now();
  const base = { endpoint: options.endpoint, method: options.method, requestId };

  return {
    requestId,
    logStart(metadata?: LogMetadata) {
      logger.info('Request started', { ...base, ...metadata });
    },
    logSuccess(metadata?: LogMetadata) {
      logger.info('Request completed', { ...base, duration: Date.now() - startTime, ...metadata });
    },
    logError(error: unknown, metadata?: LogMetadata) {
      logger.error('Request failed', error instanceof Error ? error : undefined, {
        ...base,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        ...metadata,
      });
    },
  };
}
