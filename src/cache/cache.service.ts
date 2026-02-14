import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null; // null = no expiration
}

/**
 * In-memory cache service for storing temporary data
 * Provides simple key-value storage with optional TTL
 */
@Injectable()
export class CacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Get a value from cache
   * @returns The cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlMs Time to live in milliseconds (optional, null = no expiration)
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all keys matching a pattern (simple prefix match)
   */
  keys(prefix?: string): string[] {
    const allKeys = Array.from(this.cache.keys());
    if (!prefix) {
      return allKeys;
    }
    return allKeys.filter((key) => key.startsWith(prefix));
  }
}
