// Fetch with retry + exponential backoff + jitter (simple implementation)
export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function fetchWithRetry(url: string, init?: RequestInit, opts: RetryOptions = {}): Promise<Response> {
  const { retries = 3, baseDelayMs = 200 } = opts;
  let attempt = 0;

  // Ensure every outbound call carries a requestId for tracing
  const requestId = crypto.randomUUID();
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', requestId);
  }

  const requestInit: RequestInit = { ...init, headers };

  while (true) {
    try {
      const res = await fetch(url, requestInit);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        // retry on 5xx
        attempt++;
        const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 100;
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      attempt++;
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 100;
      await sleep(delay);
    }
  }
}
