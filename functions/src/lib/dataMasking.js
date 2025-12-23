"use strict";
/**
 * Data masking utilities for PII protection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPII = maskPII;
/**
 * Masks personally identifiable information (PII) in error messages and logs
 */
function maskPII(data) {
    if (typeof data === 'string') {
        return data
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
            .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****')
            .replace(/\b\d{16}\b/g, '****-****-****-****')
            .replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer ***')
            .replace(/0x[a-fA-F0-9]{40}/g, '0x***')
            .replace(/[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g, '***wallet***');
    }
    if (data instanceof Error) {
        return maskPII(data.message);
    }
    if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data, (key, value) => {
            if (typeof key === 'string' &&
                (key.toLowerCase().includes('password') ||
                    key.toLowerCase().includes('secret') ||
                    key.toLowerCase().includes('token') ||
                    key.toLowerCase().includes('key'))) {
                return '***REDACTED***';
            }
            return typeof value === 'string' ? maskPII(value) : value;
        });
    }
    return String(data);
}
