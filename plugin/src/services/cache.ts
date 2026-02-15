/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Simple in-memory cache with TTL support
 * Used to reduce API rate limiting by caching responses
 */
export class CacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Get a cached value if it exists and hasn't expired
   * @param key Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Store a value in the cache with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time to live in milliseconds
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  /**
   * Check if a key exists and hasn't expired
   * @param key Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key from cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Default cache TTL values in milliseconds
 */
export const CacheTTL = {
  /** 1 minute - for frequently changing data */
  SHORT: 60 * 1000,
  /** 5 minutes - for moderately changing data */
  MEDIUM: 5 * 60 * 1000,
  /** 15 minutes - for rarely changing data */
  LONG: 15 * 60 * 1000,
  /** 1 hour - for static data */
  STATIC: 60 * 60 * 1000,
} as const;

/**
 * Global cache instance
 */
export const cache = new CacheService();
