"use strict";
/**
 * Centralized logging utility for the application
 *
 * IMPORTANT: This logger explicitly does NOT support file logging.
 * All logs are output to console only. File logging is disabled to prevent
 * disk space issues and security concerns. Use external log aggregation
 * services (e.g., OpenTelemetry collector, hosted logging service) for persistent logging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
exports.logError = logError;
exports.logWarn = logWarn;
exports.logInfo = logInfo;
exports.logDebug = logDebug;
const dataMasking_1 = require("./dataMasking");
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }
    error(message, error, context) {
        const maskedMessage = (0, dataMasking_1.maskPII)(message);
        const maskedError = error instanceof Error ? (0, dataMasking_1.maskPII)(error) : undefined;
        console.error(this.formatMessage(LogLevel.ERROR, maskedMessage, context));
        if (maskedError) {
            console.error(maskedError);
        }
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
    }
    warn(message, context) {
        const maskedMessage = (0, dataMasking_1.maskPII)(message);
        console.warn(this.formatMessage(LogLevel.WARN, maskedMessage, context));
    }
    info(message, context) {
        const maskedMessage = (0, dataMasking_1.maskPII)(message);
        console.info(this.formatMessage(LogLevel.INFO, maskedMessage, context));
    }
    debug(message, context) {
        if (this.isDevelopment) {
            const maskedMessage = (0, dataMasking_1.maskPII)(message);
            console.debug(this.formatMessage(LogLevel.DEBUG, maskedMessage, context));
        }
    }
}
const logger = new Logger();
exports.logger = logger;
// Convenience exports
function logError(message, error, context) {
    logger.error(message, error, context);
}
function logWarn(message, context) {
    logger.warn(message, context);
}
function logInfo(message, context) {
    logger.info(message, context);
}
function logDebug(message, context) {
    logger.debug(message, context);
}
