/**
 * Simple in-memory cache with TTL support.
 * Used for caching stats and districts endpoints.
 */
export class MemoryCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  /** Returns cached value or undefined if expired/missing. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Stores value with TTL in milliseconds. */
  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Returns true if key exists and hasn't expired. */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Removes a specific key. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /** Clears all entries. */
  clear(): void {
    this.store.clear();
  }
}
