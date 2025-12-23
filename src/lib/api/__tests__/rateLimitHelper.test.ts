/**
 * Rate Limit Helper Tests
 */

// Mock server-only first
jest.mock('server-only', () => ({}));

import { NextRequest } from 'next/server';
import { applyRateLimit, applyRateLimitWithMessage } from '../rateLimitHelper';
import { rateLimit } from '@/lib/security/rateLimit';
import { ErrorCodes } from '@/lib/errors/codes';

// Mock dependencies
jest.mock('@/lib/security/rateLimit');

const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>;

describe('rateLimitHelper', () => {
  const requestId = 'test-request-id';
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = new NextRequest('http://localhost:3000/api/test');
  });

  describe('applyRateLimit', () => {
    it('should return null when rate limit is not exceeded', async () => {
      mockRateLimit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        resetTime: Date.now() + 60000,
      });

      const result = await applyRateLimit(
        mockRequest,
        { limit: 30, windowMs: 60000, endpoint: 'test' },
        requestId
      );

      expect(result).toBeNull();
      expect(mockRateLimit).toHaveBeenCalledWith(mockRequest, {
        limit: 30,
        windowMs: 60000,
        endpoint: 'test',
      });
    });

    it('should return error response when rate limit is exceeded', async () => {
      const resetTime = Date.now() + 60000;
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        resetTime,
      });

      const result = await applyRateLimit(
        mockRequest,
        { limit: 30, windowMs: 60000, endpoint: 'test' },
        requestId
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);

      // Clone response before consuming body
      const clonedResult = result?.clone();
      const json = await clonedResult?.json();
      expect(json).toBeDefined();
      expect(json.error.code).toBe(ErrorCodes.RATE_LIMITED);
      expect(json.error.message).toBe('Too many requests. Please wait before trying again.');
      expect(json.error.requestId).toBe(requestId);

      // Check rate limit headers
      expect(result?.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(result?.headers.get('X-RateLimit-Reset')).toBe(new Date(resetTime).toISOString());
    });

    it('should include correct rate limit headers', async () => {
      const resetTime = Date.now() + 30000;
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 100,
        remaining: 5,
        resetTime,
      });

      const result = await applyRateLimit(
        mockRequest,
        { limit: 100, windowMs: 60000, endpoint: 'test' },
        requestId
      );

      expect(result?.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('5');
      expect(result?.headers.get('X-RateLimit-Reset')).toBe(new Date(resetTime).toISOString());
    });
  });

  describe('applyRateLimitWithMessage', () => {
    it('should return null when rate limit is not exceeded', async () => {
      mockRateLimit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 25,
        resetTime: Date.now() + 60000,
      });

      const result = await applyRateLimitWithMessage(
        mockRequest,
        { limit: 30, windowMs: 60000, endpoint: 'test' },
        requestId,
        'Custom error message'
      );

      expect(result).toBeNull();
    });

    it('should return error response with custom message when rate limited', async () => {
      const customMessage = 'Too many login attempts. Try again in 5 minutes.';
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 300000,
      });

      const result = await applyRateLimitWithMessage(
        mockRequest,
        { limit: 5, windowMs: 300000, endpoint: 'login' },
        requestId,
        customMessage
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);

      const json = await result?.json();
      expect(json.error.message).toBe(customMessage);
      expect(json.error.code).toBe(ErrorCodes.RATE_LIMITED);
    });

    it('should handle different endpoint configurations', async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 120000,
      });

      const result = await applyRateLimitWithMessage(
        mockRequest,
        { limit: 10, windowMs: 120000, endpoint: 'api-keys' },
        requestId,
        'API key generation limit exceeded'
      );

      const json = await result?.json();
      expect(json.error.message).toBe('API key generation limit exceeded');

      expect(mockRateLimit).toHaveBeenCalledWith(mockRequest, {
        limit: 10,
        windowMs: 120000,
        endpoint: 'api-keys',
      });
    });

    it('should preserve all rate limit metadata', async () => {
      const resetTime = Date.now() + 45000;
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 50,
        remaining: 1,
        resetTime,
      });

      const result = await applyRateLimitWithMessage(
        mockRequest,
        { limit: 50, windowMs: 60000, endpoint: 'test' },
        requestId,
        'Rate limited'
      );

      expect(result?.headers.get('X-RateLimit-Limit')).toBe('50');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('1');
      expect(result?.headers.get('X-RateLimit-Reset')).toBe(new Date(resetTime).toISOString());
    });
  });

  describe('edge cases', () => {
    it('should handle rate limit with zero remaining', async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 1,
        remaining: 0,
        resetTime: Date.now() + 10000,
      });

      const result = await applyRateLimit(
        mockRequest,
        { limit: 1, windowMs: 10000, endpoint: 'strict' },
        requestId
      );

      expect(result).not.toBeNull();
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should work with very long window times', async () => {
      const longResetTime = Date.now() + 86400000; // 24 hours
      mockRateLimit.mockResolvedValue({
        success: false,
        limit: 1000,
        remaining: 500,
        resetTime: longResetTime,
      });

      const result = await applyRateLimitWithMessage(
        mockRequest,
        { limit: 1000, windowMs: 86400000, endpoint: 'daily' },
        requestId,
        'Daily limit exceeded'
      );

      expect(result?.headers.get('X-RateLimit-Reset')).toBe(new Date(longResetTime).toISOString());
    });
  });
});
