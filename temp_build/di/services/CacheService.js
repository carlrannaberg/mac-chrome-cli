/**
 * Cache Service Implementation
 * LRU cache with TTL support for performance optimization
 */
import { LRUCache } from 'lru-cache';
export class CacheService {
    constructor(options = {}) {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
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
    get(key) {
        const entry = this.cache.get(key);
        if (entry) {
            this.hits++;
            entry.accessCount++;
            entry.lastAccessed = Date.now();
            return entry.value;
        }
        this.misses++;
        return undefined;
    }
    /**
     * Set value in cache
     */
    set(key, value, ttl) {
        const now = Date.now();
        const entry = {
            value,
            createdAt: now,
            accessCount: 0,
            lastAccessed: now
        };
        if (ttl) {
            this.cache.set(key, entry, { ttl });
        }
        else {
            this.cache.set(key, entry);
        }
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Delete key from cache
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
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
    prune() {
        const sizeBefore = this.cache.size;
        this.cache.purgeStale();
        return sizeBefore - this.cache.size;
    }
}
