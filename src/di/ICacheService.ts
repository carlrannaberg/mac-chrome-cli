/**
 * @fileoverview Cache service interface for performance optimization
 * 
 * This module defines the contract for caching services used throughout
 * the application to improve performance by storing frequently accessed data.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

/**
 * Represents a single cache entry with metadata for management and statistics.
 * 
 * @template T - The type of the cached value
 * @interface CacheEntry
 * @example
 * ```typescript
 * const entry: CacheEntry<string> = {
 *   value: 'cached data',
 *   createdAt: Date.now(),
 *   accessCount: 5,
 *   lastAccessed: Date.now()
 * };
 * ```
 */
export interface CacheEntry<T> {
  /** The actual cached value */
  value: T;
  /** Timestamp when the entry was created */
  createdAt: number;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Timestamp of the last access to this entry */
  lastAccessed: number;
}

/**
 * Cache performance and usage statistics.
 * Used for monitoring cache effectiveness and tuning cache parameters.
 * 
 * @interface CacheStats
 * @example
 * ```typescript
 * const stats: CacheStats = {
 *   size: 150,
 *   maxSize: 1000,
 *   hits: 850,
 *   misses: 200,
 *   evictions: 25,
 *   hitRate: 0.81
 * };
 * ```
 */
export interface CacheStats {
  /** Current number of entries in the cache */
  size: number;
  /** Maximum number of entries the cache can hold */
  maxSize: number;
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Number of entries that have been evicted */
  evictions: number;
  /** Cache hit rate as a decimal (0-1) */
  hitRate: number;
}

/**
 * Cache service interface providing high-performance data caching capabilities.
 * 
 * This interface defines a contract for cache implementations that support
 * TTL (Time To Live), LRU eviction, and comprehensive statistics tracking.
 * 
 * @interface ICacheService
 * @example
 * ```typescript
 * class MyCacheService implements ICacheService {
 *   get<T>(key: string): T | undefined {
 *     // Implementation
 *     return undefined;
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface ICacheService {
  /**
   * Retrieves a value from the cache by its key.
   * Updates access statistics and LRU ordering when found.
   * 
   * @template T - The type of the cached value
   * @param key - The cache key to look up
   * @returns The cached value if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const cachedData = cache.get<string>('user:123');
   * if (cachedData) {
   *   console.log('Cache hit:', cachedData);
   * } else {
   *   console.log('Cache miss for key: user:123');
   * }
   * ```
   */
  get<T>(key: string): T | undefined;
  
  /**
   * Stores a value in the cache with an optional TTL (Time To Live).
   * May trigger eviction of older entries if the cache is full.
   * 
   * @template T - The type of the value to cache
   * @param key - The cache key for storage
   * @param value - The value to cache
   * @param ttl - Optional TTL in milliseconds (default: no expiration)
   * 
   * @example
   * ```typescript
   * // Cache with default TTL
   * cache.set('user:123', userData);
   * 
   * // Cache with 5-minute TTL
   * cache.set('temp:data', tempData, 5 * 60 * 1000);
   * ```
   */
  set<T>(key: string, value: T, ttl?: number): void;
  
  /**
   * Checks if a key exists in the cache without affecting access statistics.
   * Does not update LRU ordering or access counts.
   * 
   * @param key - The cache key to check
   * @returns True if the key exists and is not expired
   * 
   * @example
   * ```typescript
   * if (cache.has('config:settings')) {
   *   console.log('Settings are cached');
   * } else {
   *   console.log('Need to load settings');
   * }
   * ```
   */
  has(key: string): boolean;
  
  /**
   * Removes a specific key from the cache.
   * Updates cache statistics and size tracking.
   * 
   * @param key - The cache key to delete
   * @returns True if the key was found and deleted, false otherwise
   * 
   * @example
   * ```typescript
   * const deleted = cache.delete('outdated:data');
   * if (deleted) {
   *   console.log('Successfully removed outdated data');
   * }
   * ```
   */
  delete(key: string): boolean;
  
  /**
   * Removes all entries from the cache and resets statistics.
   * This operation is immediate and cannot be undone.
   * 
   * @example
   * ```typescript
   * // Clear cache after configuration changes
   * cache.clear();
   * console.log('Cache cleared');
   * ```
   */
  clear(): void;
  
  /**
   * Retrieves comprehensive cache performance statistics.
   * Useful for monitoring cache effectiveness and tuning parameters.
   * 
   * @returns Object containing cache statistics and metrics
   * 
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * console.log(`Cache utilization: ${stats.size}/${stats.maxSize}`);
   * ```
   */
  getStats(): CacheStats;
  
  /**
   * Manually removes expired entries from the cache.
   * This is typically called automatically but can be triggered manually
   * for immediate cleanup of expired data.
   * 
   * @returns The number of entries that were pruned
   * 
   * @example
   * ```typescript
   * const pruned = cache.prune();
   * console.log(`Removed ${pruned} expired entries`);
   * ```
   */
  prune(): number;
}
