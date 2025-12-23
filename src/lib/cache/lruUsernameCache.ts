// Lightweight LRU cache with TTL + stale-while-revalidate pattern
export interface CacheEntry<T> { value: T; ts: number; }

export class LruCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  constructor(private maxSize: number, private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    // Move key to end (recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  isFresh(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    return Date.now() - entry.ts < this.ttlMs;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, { value, ts: Date.now() });
    if (this.store.size > this.maxSize) {
      // Evict oldest (first inserted)
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
  }

  clear(): void { this.store.clear(); }
}

export const usernameCache = new LruCache<string>(200, 5 * 60 * 1000);
