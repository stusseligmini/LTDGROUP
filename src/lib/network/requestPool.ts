// Simple request pool for aborting in-flight duplicate username lookups

interface InFlight {
  controller: AbortController;
  started: number;
}

const inFlight = new Map<string, InFlight>();

export function buildKey(url: string): string {
  return url;
}

export function fetchWithAbort(url: string, init?: RequestInit): Promise<Response> {
  const key = buildKey(url);
  // Abort previous
  const existing = inFlight.get(key);
  if (existing) {
    existing.controller.abort();
    inFlight.delete(key);
  }
  const controller = new AbortController();
  const signal = controller.signal;
  inFlight.set(key, { controller, started: Date.now() });
  return fetch(url, { ...init, signal }).finally(() => {
    // Clean up if same controller still stored
    const current = inFlight.get(key);
    if (current && current.controller === controller) {
      inFlight.delete(key);
    }
  });
}

export function abortAll(): void {
  for (const [key, entry] of inFlight.entries()) {
    entry.controller.abort();
    inFlight.delete(key);
  }
}
