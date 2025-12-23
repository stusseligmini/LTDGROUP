export async function appFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', crypto.randomUUID());
  }
  // Always include credentials so auth cookies (firebase-id-token) are sent to API routes
  return fetch(url, { credentials: 'include', ...init, headers });
}
