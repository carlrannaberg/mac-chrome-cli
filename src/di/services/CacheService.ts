/**
 * Cache Service Implementation
 * LRU cache with TTL support for performance optimization
 */

import { LRUCache } from 'lru-cache';
import type { ICacheService, CacheEntry, CacheStats } from '../ICacheService.js';

export class CacheService implements ICacheService {
  private readonly cache: LRUCache<string, CacheEntry<unknown>>;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.cache = new LRUCache({
      max: options.maxSize || 100,
      ttl: options.ttl || 1000 * 60 * 15, // 15 minutes default
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      // Track evictions
      dispose: () => {
        this.evictions++;
      }
    });
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.hits++;
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      return entry.value as T;
    }
    
    this.misses++;
    return undefined;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now
    };
    
    if (ttl) {
      this.cache.set(key, entry as CacheEntry<unknown>, { ttl });
    } else {
      this.cache.set(key, entry as CacheEntry<unknown>);
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate
    };
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const sizeBefore = this.cache.size;
    this.cache.purgeStale();
    return sizeBefore - this.cache.size;
  }
}
