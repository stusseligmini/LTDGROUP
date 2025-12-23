let authToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

function stripTrailingSlash(value: string | undefined | null): string | undefined {
  if (!value) return value ?? undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      stripTrailingSlash(process.env.PLATFORM_API_BASE_URL) ||
      stripTrailingSlash(process.env.API_BASE_URL) ||
      '/api'
    );
  }

  const runtimeBase = (window as typeof window & { __CELORA_API_BASE__?: string }).__CELORA_API_BASE__;
  const appUrl = stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  const apiBaseEnv = stripTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL);

  if (window.location.protocol === 'chrome-extension:') {
    if (runtimeBase) {
      return runtimeBase;
    }
    if (appUrl) {
      return `${appUrl}/api`;
    }
    if (apiBaseEnv) {
      return apiBaseEnv;
    }
    return '';
  }

  if (runtimeBase) {
    return runtimeBase;
  }

  if (appUrl && window.location.origin === appUrl) {
    return '/api';
  }

  return '/api';
}

function shouldSendCredentials(base: string, initCredentials?: RequestCredentials): RequestCredentials | undefined {
  if (initCredentials) {
    return initCredentials;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  if (!base || base.startsWith('/')) {
    return 'include';
  }

  try {
    const target = new URL(base, window.location.origin);
    if (target.origin === window.location.origin) {
      return 'include';
    }
  } catch (_error) {
    // ignore
  }

  return 'omit';
}

/**
 * Get CSRF token from cookie (client-side only)
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(new RegExp(`(^| )celora-csrf-token=([^;]+)`));
  return match ? match[2] : null;
}

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const baseUrl = resolveBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  // Add CSRF token for state-changing methods
  const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (statefulMethods.includes(method.toUpperCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  const credentials = shouldSendCredentials(baseUrl, init?.credentials);

  const url = baseUrl ? `${baseUrl}${path}` : path;

  const response = await fetch(url, {
    method,
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials,
  });

  const contentType = response.headers.get('content-type');
  const payload = contentType && contentType.includes('application/json') ? await response.json() : undefined;

  if (!response.ok) {
    const error = new Error(payload?.error || response.statusText);
    (error as any).status = response.status;
    (error as any).data = payload;
    throw error;
  }

  return payload as T;
}

export const api = {
  get<T>(path: string, init?: RequestInit) {
    return request<T>('GET', path, undefined, init);
  },
  post<T>(path: string, body: unknown, init?: RequestInit) {
    return request<T>('POST', path, body, init);
  },
  put<T>(path: string, body: unknown, init?: RequestInit) {
    return request<T>('PUT', path, body, init);
  },
  patch<T>(path: string, body: unknown, init?: RequestInit) {
    return request<T>('PATCH', path, body, init);
  },
  delete<T>(path: string, init?: RequestInit) {
    return request<T>('DELETE', path, undefined, init);
  },
};

export default api;
