'use client';

import React, { useState, useEffect, ReactNode } from 'react';

/**
 * React hook to get the CSP nonce for use in client-side scripts
 * 
 * This is necessary for client components that need to add inline scripts
 * that should be allowed by the Content Security Policy
 */
export function useCspNonce(): string | null {
  const [nonce, setNonce] = useState<string | null>(null);

  useEffect(() => {
    // Look for nonce in meta tag (inserted by server component)
    const nonceTag = document.querySelector('meta[name="csp-nonce"]');
    if (nonceTag) {
      setNonce(nonceTag.getAttribute('content'));
    }
  }, []);

  return nonce;
}

/**
 * Component to safely add inline scripts with proper CSP nonce
 */
export function SafeInlineScript({ 
  children, 
  nonce 
}: { 
  children: string; 
  nonce: string | null;
}): React.ReactElement | null {
  if (!nonce) return null;
  
  return React.createElement('script', {
    nonce,
    dangerouslySetInnerHTML: { __html: children }
  });
}

/**
 * Helper to sanitize script content
 * This helps prevent XSS even in nonce-protected scripts
 */
export function sanitizeScriptContent(script: string): string {
  // Basic sanitization to prevent script tag injection
  return script
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--');
}

/**
 * Helper component to provide CSP nonce to child components
 */
export function CspNonceProvider({
  children,
  nonce
}: {
  children: ReactNode;
  nonce: string;
}): React.ReactElement {
  // Insert meta tag with nonce value for client components to read
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('meta', { name: "csp-nonce", content: nonce }),
    children
  );
}
