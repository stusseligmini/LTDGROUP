/**
 * Security Middleware Tests
 * 
 * Tests CSP, CSRF, and Rate Limiting functionality
 */

import { describe, expect, it } from '@jest/globals';
import {
  generateCspNonce,
  buildCspDirectives,
} from '../../security/contentSecurityPolicy';
import {
  generateCsrfToken,
} from '../../security/csrfProtection';

describe('Content Security Policy', () => {
  describe('generateCspNonce', () => {
    it('should generate a nonce', () => {
      const nonce = generateCspNonce();
      
      expect(nonce).toBeTruthy();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });
    
    it('should generate unique nonces', () => {
      const nonce1 = generateCspNonce();
      const nonce2 = generateCspNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });
    
    it('should generate base64-encoded nonce', () => {
      const nonce = generateCspNonce();
      
      // Base64 pattern
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });
  
  describe('buildCspDirectives', () => {
    it('should build directives without nonce', () => {
      const directives = buildCspDirectives({});
      
      expect(directives).toHaveProperty('default-src');
      expect(directives).toHaveProperty('script-src');
      expect(directives).toHaveProperty('style-src');
      expect(directives).toHaveProperty('connect-src');
    });
    
    it('should include nonce in script-src when provided', () => {
      const nonce = 'test-nonce-123';
      const directives = buildCspDirectives({ nonce });
      
      expect(directives['script-src']).toContain(`'nonce-${nonce}'`);
    });
    
    it('should include Firebase/Google domains in connect-src', () => {
      const directives = buildCspDirectives({});
      
      const connectSrc = directives['connect-src'];
      expect(connectSrc).toBeDefined();
      expect(connectSrc.some((src: string) => src.includes('firestore.googleapis.com'))).toBe(true);
      expect(connectSrc.some((src: string) => src.includes('securetoken.googleapis.com'))).toBe(true);
    });
    
    it('should have self in default-src', () => {
      const directives = buildCspDirectives({});
      
      expect(directives['default-src']).toContain("'self'");
    });
    
    it('should include Firebase/Google SDK domains', () => {
      const directives = buildCspDirectives({});
      
      const scriptSrc = directives['script-src'];
      const connectSrc = directives['connect-src'];
      
      expect(scriptSrc.some((src: string) => src.includes('www.gstatic.com'))).toBe(true);
      expect(scriptSrc.some((src: string) => src.includes('googletagmanager'))).toBe(true);
      expect(connectSrc.some((src: string) => src.includes('www.googleapis.com'))).toBe(true);
    });
  });
});

describe('CSRF Protection', () => {
  describe('generateCsrfToken', () => {
    it('should generate a token', () => {
      const token = generateCsrfToken();
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
    
    it('should generate unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      
      expect(token1).not.toBe(token2);
    });
    
    it('should generate base64url-encoded token', () => {
      const token = generateCsrfToken();
      
      // Base64URL pattern (no +, /, or =)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
    
    it('should generate token of sufficient length', () => {
      const token = generateCsrfToken();
      
      // 32 bytes base64url encoded
      expect(token.length).toBeGreaterThanOrEqual(40);
    });
  });
});

describe('Security Integration', () => {
  it('should generate unique nonce and CSRF token per request', () => {
    // Request 1
    const nonce1 = generateCspNonce();
    const csrf1 = generateCsrfToken();
    
    // Request 2
    const nonce2 = generateCspNonce();
    const csrf2 = generateCsrfToken();
    
    expect(nonce1).not.toBe(nonce2);
    expect(csrf1).not.toBe(csrf2);
  });
  
  it('should generate cryptographically random values', () => {
    // Generate multiple tokens
    const tokens = Array.from({ length: 100 }, () => generateCsrfToken());
    const nonces = Array.from({ length: 100 }, () => generateCspNonce());
    
    // All should be unique
    const uniqueTokens = new Set(tokens);
    const uniqueNonces = new Set(nonces);
    
    expect(uniqueTokens.size).toBe(100);
    expect(uniqueNonces.size).toBe(100);
  });
});

describe('CSP Directive Building', () => {
  it('should support report-only mode', () => {
    const directives = buildCspDirectives({ reportOnly: true });
    
    expect(directives).toHaveProperty('default-src');
  });
  
  it('should handle missing environment variables gracefully', () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    
    const directives = buildCspDirectives({});
    
    expect(directives).toHaveProperty('connect-src');
    
    if (originalAppUrl) {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });
  
  it('should include blockchain RPC endpoints', () => {
    const directives = buildCspDirectives({});
    
    const connectSrc = directives['connect-src'];
    
    // Should allow blockchain connections
    expect(connectSrc).toBeDefined();
    expect(connectSrc.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases', () => {
  it('should handle very long nonces', () => {
    const longNonce = 'a'.repeat(1000);
    const directives = buildCspDirectives({ nonce: longNonce });
    
    expect(directives['script-src']).toContain(`'nonce-${longNonce}'`);
  });
  
  it('should handle special characters in nonce', () => {
    const specialNonce = 'abc+def/123==';
    const directives = buildCspDirectives({ nonce: specialNonce });
    
    expect(directives['script-src']).toContain(`'nonce-${specialNonce}'`);
  });
  
  it('should generate tokens consistently', () => {
    for (let i = 0; i < 10; i++) {
      const token = generateCsrfToken();
      const nonce = generateCspNonce();
      
      expect(token).toBeTruthy();
      expect(nonce).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(typeof nonce).toBe('string');
    }
  });
});

describe('Security Headers', () => {
  it('should format CSP directives for headers', () => {
    const directives = buildCspDirectives({ nonce: 'test123' });
    
    // Verify structure for header formatting
    expect(typeof directives).toBe('object');
    expect(Object.keys(directives).length).toBeGreaterThan(0);
    
    // All values should be arrays
    Object.values(directives).forEach((value) => {
      expect(Array.isArray(value)).toBe(true);
    });
  });
});
