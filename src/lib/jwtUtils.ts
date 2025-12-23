/**
 * JWT Token Utilities
 * 
 * Provides token validation, decoding, and expiry checking.
 */

import { jwtDecode } from 'jwt-decode';

export interface JwtPayload {
  exp?: number;
  iat?: number;
  nbf?: number;
  aud?: string | string[];
  iss?: string;
  sub?: string;
  oid?: string;
  email?: string;
  emails?: string[];
  preferred_username?: string;
  name?: string;
  roles?: string[];
  tfp?: string; // Trust Framework Policy
  [key: string]: any;
}

/**
 * Decode JWT token without verification
 * Note: This does NOT verify the signature - only use for reading claims
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error);
    return null;
  }
}

// Alias for consistency
export const decodeToken = decodeJwt;

/**
 * Check if token is expired
 * @param token - JWT token string
 * @param bufferSeconds - Buffer time in seconds (default: 300 = 5 minutes)
 */
export function isTokenExpired(token: string, bufferSeconds = 300): boolean {
  const decoded = decodeJwt(token);
  if (!decoded?.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now + bufferSeconds;
}

/**
 * Get token expiration timestamp
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeJwt(token);
  if (!decoded?.exp) return null;
  
  return new Date(decoded.exp * 1000);
}

/**
 * Get time until token expires (in seconds)
 */
export function getTimeUntilExpiry(token: string): number | null {
  const decoded = decodeJwt(token);
  if (!decoded?.exp) return null;
  
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - now);
}

/**
 * Validate token structure and claims
 */
export function validateTokenClaims(
  token: string,
  options?: {
    requiredClaims?: string[];
    audience?: string;
    issuer?: string;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const decoded = decodeJwt(token);
  if (!decoded) {
    return { valid: false, errors: ['Failed to decode token'] };
  }
  
  // Check expiration
  if (isTokenExpired(token, 0)) {
    errors.push('Token is expired');
  }
  
  // Check not before (nbf)
  if (decoded.nbf) {
    const now = Math.floor(Date.now() / 1000);
    if (decoded.nbf > now) {
      errors.push('Token not yet valid (nbf claim)');
    }
  }
  
  // Check required claims
  if (options?.requiredClaims) {
    for (const claim of options.requiredClaims) {
      if (!(claim in decoded)) {
        errors.push(`Missing required claim: ${claim}`);
      }
    }
  }
  
  // Check audience
  if (options?.audience) {
    const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
    if (!aud.includes(options.audience)) {
      errors.push(`Invalid audience. Expected: ${options.audience}`);
    }
  }
  
  // Check issuer
  if (options?.issuer && decoded.iss !== options.issuer) {
    errors.push(`Invalid issuer. Expected: ${options.issuer}, Got: ${decoded.iss}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract user info from token
 */
export function extractUserInfo(token: string): {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
} | null {
  const decoded = decodeJwt(token);
  if (!decoded) return null;
  
  const emails = Array.isArray(decoded.emails) ? decoded.emails : [];
  
  return {
    id: decoded.oid || decoded.sub || '',
    email: decoded.preferred_username || decoded.email || emails[0] || '',
    name: decoded.name,
    roles: decoded.roles,
  };
}

/**
 * Check if token needs refresh (expires in < 5 minutes)
 */
export function shouldRefreshToken(token: string): boolean {
  return isTokenExpired(token, 300); // 5 minutes buffer
}

/**
 * Format token expiry for display
 */
export function formatTokenExpiry(token: string): string {
  const timeLeft = getTimeUntilExpiry(token);
  if (timeLeft === null) return 'Unknown';
  if (timeLeft <= 0) return 'Expired';
  
  const minutes = Math.floor(timeLeft / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
