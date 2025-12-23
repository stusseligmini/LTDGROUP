/**
 * Centralized logging utility for the application
 * 
 * IMPORTANT: This logger explicitly does NOT support file logging.
 * All logs are output to console only. File logging is disabled to prevent
 * disk space issues and security concerns. Use external log aggregation
 * services (e.g., OpenTelemetry collector, hosted logging service) for persistent logging.
 */

import { maskPII } from './dataMasking';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const maskedMessage = maskPII(message);
    const maskedError = error instanceof Error ? maskPII(error) : undefined;

    console.error(this.formatMessage(LogLevel.ERROR, maskedMessage, context));
    if (maskedError) {
      console.error(maskedError);
    }
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }

  warn(message: string, context?: LogContext): void {
    const maskedMessage = maskPII(message);
    console.warn(this.formatMessage(LogLevel.WARN, maskedMessage, context));
  }

  info(message: string, context?: LogContext): void {
    const maskedMessage = maskPII(message);
    console.info(this.formatMessage(LogLevel.INFO, maskedMessage, context));
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const maskedMessage = maskPII(message);
      console.debug(this.formatMessage(LogLevel.DEBUG, maskedMessage, context));
    }
  }
}

const logger = new Logger();

export { logger };

// Convenience exports
export function logError(message: string, error?: Error | unknown, context?: LogContext): void {
  logger.error(message, error, context);
}

export function logWarn(message: string, context?: LogContext): void {
  logger.warn(message, context);
}

export function logInfo(message: string, context?: LogContext): void {
  logger.info(message, context);
}

export function logDebug(message: string, context?: LogContext): void {
  logger.debug(message, context);
}
