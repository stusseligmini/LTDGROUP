/**
 * Client-Side Security Helpers
 * 
 * Utilities for CSP nonce and CSRF token handling in React components.
 */

'use client';

import { useEffect, useState } from 'react';
import { getClientCsrfToken, CSRF_TOKEN_HEADER } from './csrfProtection';

/**
 * Hook to get CSP nonce from meta tag
 */
export function useNonce(): string | null {
  const [nonce, setNonce] = useState<string | null>(null);
  
  useEffect(() => {
    // Get nonce from meta tag injected by middleware
    const metaTag = document.querySelector('meta[property="csp-nonce"]');
    if (metaTag) {
      setNonce(metaTag.getAttribute('content'));
    }
  }, []);
  
  return nonce;
}

/**
 * Hook to get CSRF token
 */
export function useCsrfToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    setToken(getClientCsrfToken());
  }, []);
  
  return token;
}

/**
 * Enhanced fetch with automatic CSRF token
 */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  // Add CSRF token for state-changing methods
  if (statefulMethods.includes(method)) {
    const token = getClientCsrfToken();
    if (token) {
      options.headers = {
        ...options.headers,
        [CSRF_TOKEN_HEADER]: token,
      };
    }
  }
  
  // Add default headers
  options.headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  return fetch(url, options);
}

/**
 * Helper to inject CSP nonce into script tags
 */
export function injectNonceToScript(script: string, nonce: string): string {
  return script.replace(/<script/g, `<script nonce="${nonce}"`);
}
