/**
 * JWT Utils Tests
 */

import { describe, expect, it, jest } from '@jest/globals';
import {
  decodeJwt,
  isTokenExpired,
  getTokenExpiration,
  getTimeUntilExpiry,
  validateTokenClaims,
  extractUserInfo,
  shouldRefreshToken,
  formatTokenExpiry,
} from '../jwtUtils';

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

describe('JWT Utils', () => {
  const mockDecode = require('jwt-decode').jwtDecode;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeJwt', () => {
    it('should decode valid token', () => {
      const mockPayload = { sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 };
      mockDecode.mockReturnValue(mockPayload);

      const result = decodeJwt('valid-token');
      expect(result).toEqual(mockPayload);
    });

    it('should return null for invalid token', () => {
      mockDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = decodeJwt('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockDecode.mockReturnValue({ exp: futureExp });

      const result = isTokenExpired('token', 300);
      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      mockDecode.mockReturnValue({ exp: pastExp });

      const result = isTokenExpired('token', 300);
      expect(result).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      mockDecode.mockReturnValue({});

      const result = isTokenExpired('token');
      expect(result).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      mockDecode.mockReturnValue({ exp });

      const result = getTokenExpiration('token');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(exp * 1000);
    });

    it('should return null for token without exp', () => {
      mockDecode.mockReturnValue({});

      const result = getTokenExpiration('token');
      expect(result).toBeNull();
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('should return time until expiry in seconds', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      mockDecode.mockReturnValue({ exp });

      const result = getTimeUntilExpiry('token');
      expect(result).toBeGreaterThan(3500);
      expect(result).toBeLessThanOrEqual(3605);
    });

    it('should return 0 for expired token', () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      mockDecode.mockReturnValue({ exp });

      const result = getTimeUntilExpiry('token');
      expect(result).toBe(0);
    });
  });

  describe('validateTokenClaims', () => {
    it('should validate token with all required claims', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      mockDecode.mockReturnValue({
        exp,
        sub: 'user-123',
        aud: 'api',
        iss: 'https://auth.example.com',
      });

      const result = validateTokenClaims('token', {
        requiredClaims: ['sub'],
        audience: 'api',
        issuer: 'https://auth.example.com',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing claims', () => {
      mockDecode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = validateTokenClaims('token', {
        requiredClaims: ['sub', 'email'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('extractUserInfo', () => {
    it('should extract user info from token', () => {
      mockDecode.mockReturnValue({
        oid: 'user-123',
        preferred_username: 'user@example.com',
        name: 'John Doe',
        roles: ['user'],
      });

      const result = extractUserInfo('token');
      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        roles: ['user'],
      });
    });

    it('should handle token without user info', () => {
      mockDecode.mockReturnValue({});

      const result = extractUserInfo('token');
      expect(result).toEqual({ id: '', email: '', name: undefined, roles: undefined });
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true for token expiring soon', () => {
      const exp = Math.floor(Date.now() / 1000) + 200; // 200 seconds = 3.3 minutes
      mockDecode.mockReturnValue({ exp });

      const result = shouldRefreshToken('token');
      expect(result).toBe(true);
    });

    it('should return false for token with plenty of time', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      mockDecode.mockReturnValue({ exp });

      const result = shouldRefreshToken('token');
      expect(result).toBe(false);
    });
  });

  describe('formatTokenExpiry', () => {
    it('should format days and hours', () => {
      const exp = Math.floor(Date.now() / 1000) + 2 * 24 * 3600 + 5 * 3600; // 2 days 5 hours
      mockDecode.mockReturnValue({ exp });

      const result = formatTokenExpiry('token');
      expect(result).toContain('2d');
      expect(result).toContain('5h');
    });

    it('should format hours and minutes', () => {
      const exp = Math.floor(Date.now() / 1000) + 2 * 3600 + 30 * 60; // 2 hours 30 minutes
      mockDecode.mockReturnValue({ exp });

      const result = formatTokenExpiry('token');
      expect(result).toContain('2h');
      expect(result).toContain('30m');
    });

    it('should return "Expired" for expired token', () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      mockDecode.mockReturnValue({ exp });

      const result = formatTokenExpiry('token');
      expect(result).toBe('Expired');
    });
  });
});

