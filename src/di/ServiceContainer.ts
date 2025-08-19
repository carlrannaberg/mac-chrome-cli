/**
 * Service Container for Dependency Injection
 * Manages service lifetimes, dependencies, and provides type-safe service resolution
 */

import { Result } from '../core/Result.js';

/**
 * LRU Cache entry with timestamp for TTL support
 */
interface CacheEntry<T = unknown> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * LRU Cache statistics
 */
interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  ttlEvictions: number;
}

/**
 * Cache configuration options
 */
interface CacheConfig {
  maxSize: number;
  ttlMs: number;
  enabled: boolean;
}

/**
 * LRU Cache implementation with TTL support for preventing memory leaks
 */
class LRUCache<T = unknown> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly accessOrder: string[] = [];
  private stats: CacheStats;
  
  constructor(private config: CacheConfig) {
    this.stats = {
      size: 0,
      maxSize: config.maxSize,
      hits: 0,
      misses: 0,
      evictions: 0,
      ttlEvictions: 0
    };
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    if (!this.config.enabled) {
      this.stats.misses++;
      return undefined;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.ttlEvictions++;
      this.stats.misses++;
      return undefined;
    }

    // Update access statistics
    entry.accessCount++;
    this.moveToEnd(key);
    this.stats.hits++;
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    if (!this.config.enabled) {
      return;
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Check if we need to evict
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      accessCount: 1
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.stats.size = this.cache.size;
    }
    return existed;
  }

  /**
   * Check if entry exists and is not expired
   */
  has(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.ttlEvictions++;
      return false;
    }

    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
    this.stats.size = 0;
    this.stats.evictions = 0;
    this.stats.ttlEvictions = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Update cache configuration
   */
  configure(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.stats.maxSize = this.config.maxSize;
    
    // If disabled, clear cache
    if (!this.config.enabled) {
      this.clear();
    }
    
    // If max size reduced, evict excess entries
    while (this.cache.size > this.config.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    // Collect keys to remove to avoid modifying during iteration
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.config.ttlMs) {
        keysToRemove.push(key);
      }
    });
    
    // Remove expired entries
    for (const key of keysToRemove) {
      this.delete(key);
      this.stats.ttlEvictions++;
      removed++;
    }
    
    return removed;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return this.config.ttlMs > 0 && (Date.now() - entry.timestamp) > this.config.ttlMs;
  }

  /**
   * Move key to end of access order (most recently used)
   */
  private moveToEnd(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
    this.stats.evictions++;
  }
}

/**
 * Service lifetime options
 */
export enum ServiceLifetime {
  /** Single instance shared across the application */
  Singleton = 'singleton',
  /** New instance created for each request */
  Transient = 'transient'
}

/**
 * Service token interface for type-safe registration and resolution
 */
export interface ServiceToken<T = unknown> {
  readonly name: string;
  readonly _type?: T; // Phantom type for TypeScript inference
}

/**
 * Service descriptor for registration
 */
export interface ServiceDescriptor<T = unknown> {
  token: ServiceToken<T>;
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  dependencies?: ServiceToken<unknown>[];
}

/**
 * Service factory function type
 */
export type ServiceFactory<T> = (container: IServiceContainer) => T | Promise<T>;

/**
 * Service container interface
 */
export interface IServiceContainer {
  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): void;
  
  /**
   * Register a singleton service
   */
  registerSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, dependencies?: ServiceToken<unknown>[]): void;
  
  /**
   * Register a transient service
   */
  registerTransient<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, dependencies?: ServiceToken<unknown>[]): void;
  
  /**
   * Resolve a service by token
   */
  resolve<T>(token: ServiceToken<T>): Promise<Result<T, string>>;
  
  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean;
  
  /**
   * Clear all services and reset container
   */
  clear(): void;
  
  /**
   * Get container statistics
   */
  getStats(): ContainerStats;
  
  /**
   * Clear resolution cache
   */
  clearCache(): void;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats;
  
  /**
   * Configure cache settings
   */
  configureCaching(config: Partial<CacheConfig>): void;
}

/**
 * Container statistics
 */
export interface ContainerStats {
  registeredServices: number;
  singletonInstances: number;
  resolutionCount: number;
  circularDependencyChecks: number;
  cachedResolutions: number;
  initializationOrder: string[];
  initializationDuration: number;
  cache: CacheStats;
}

/**
 * Circular dependency detection context
 */
interface ResolutionContext {
  resolving: Set<string>;
  resolved: Map<string, unknown>;
}

/**
 * Main service container implementation
 */
export class ServiceContainer implements IServiceContainer {
  private readonly services = new Map<string, ServiceDescriptor>();
  private readonly singletonInstances = new Map<string, unknown>();
  private readonly resolutionCache: LRUCache<Promise<unknown>>;
  private readonly initializationOrder: string[] = [];
  private resolutionCount = 0;
  private circularDependencyChecks = 0;
  private initializationStartTime: number = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(cacheConfig?: Partial<CacheConfig>) {
    // Default cache configuration with sensible defaults
    const defaultConfig: CacheConfig = {
      maxSize: 100,          // Prevent unbounded growth
      ttlMs: 5 * 60 * 1000, // 5 minutes TTL
      enabled: true          // Enable by default
    };
    
    this.resolutionCache = new LRUCache<Promise<unknown>>({ 
      ...defaultConfig, 
      ...cacheConfig 
    });

    // Set up periodic cleanup of expired entries
    this.setupCleanupTimer();
  }

  /**
   * Set up periodic cleanup timer for cache maintenance
   */
  private setupCleanupTimer(): void {
    // Clean up expired cache entries every 2 minutes
    this.cleanupTimer = setInterval(() => {
      this.resolutionCache.cleanup();
    }, 2 * 60 * 1000);
    
    // Don't keep the process alive just for cache cleanup
    this.cleanupTimer.unref();
  }

  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): void {
    if (this.services.has(descriptor.token.name)) {
      throw new Error(`Service '${descriptor.token.name}' is already registered`);
    }
    
    this.services.set(descriptor.token.name, descriptor);
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    token: ServiceToken<T>, 
    factory: ServiceFactory<T>, 
    dependencies: ServiceToken<unknown>[] = []
  ): void {
    this.register({
      token,
      factory,
      lifetime: ServiceLifetime.Singleton,
      dependencies
    });
  }

  /**
   * Register a transient service
   */
  registerTransient<T>(
    token: ServiceToken<T>, 
    factory: ServiceFactory<T>, 
    dependencies: ServiceToken<unknown>[] = []
  ): void {
    this.register({
      token,
      factory,
      lifetime: ServiceLifetime.Transient,
      dependencies
    });
  }

  /**
   * Resolve a service by token with circular dependency detection and optimized caching
   */
  async resolve<T>(token: ServiceToken<T>): Promise<Result<T, string>> {
    this.resolutionCount++;
    
    // Start timing if this is the first resolution
    if (this.initializationStartTime === 0) {
      this.initializationStartTime = performance.now();
    }
    
    const descriptor = this.services.get(token.name);
    if (!descriptor) {
      return { 
        success: false, 
        error: `Service '${token.name}' is not registered`,
        code: 99, // UNKNOWN_ERROR
        timestamp: new Date().toISOString()
      };
    }
    
    // Only cache concurrent resolution promises for singletons to avoid duplicate work
    // Transient services should always create new instances
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const cachedPromise = this.resolutionCache.get(token.name);
      if (cachedPromise) {
        try {
          const result = await cachedPromise as T;
          return { 
            success: true, 
            data: result,
            code: 0, // SUCCESS
            timestamp: new Date().toISOString()
          };
        } catch (err) {
          this.resolutionCache.delete(token.name);
          const errorMessage = err instanceof Error ? err.message : String(err);
          return { 
            success: false, 
            error: `Failed to resolve cached service '${token.name}': ${errorMessage}`,
            code: 99, // UNKNOWN_ERROR
            timestamp: new Date().toISOString()
          };
        }
      }
    }
    
    const context: ResolutionContext = {
      resolving: new Set(),
      resolved: new Map()
    };
    
    try {
      const resolutionPromise = this.resolveWithContext<T>(token, context);
      
      // Cache the resolution promise to avoid duplicate work (only for singletons)
      if (descriptor.lifetime === ServiceLifetime.Singleton) {
        this.resolutionCache.set(token.name, resolutionPromise);
      }
      
      const result = await resolutionPromise;
      
      // Track initialization order for optimization insights
      if (!this.initializationOrder.includes(token.name)) {
        this.initializationOrder.push(token.name);
      }
      
      return { 
        success: true, 
        data: result,
        code: 0, // SUCCESS
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      // Remove failed resolution from cache
      if (descriptor.lifetime === ServiceLifetime.Singleton) {
        this.resolutionCache.delete(token.name);
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { 
        success: false, 
        error: `Failed to resolve service '${token.name}': ${errorMessage}`,
        code: 99, // UNKNOWN_ERROR
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Internal resolution with context for circular dependency detection
   */
  private async resolveWithContext<T>(token: ServiceToken<T>, context: ResolutionContext): Promise<T> {
    const tokenName = token.name;
    
    // Check for circular dependency
    if (context.resolving.has(tokenName)) {
      this.circularDependencyChecks++;
      const cycle = Array.from(context.resolving).concat(tokenName).join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    
    // Check if already resolved in this context
    if (context.resolved.has(tokenName)) {
      return context.resolved.get(tokenName) as T;
    }
    
    // Check for singleton instance
    if (this.singletonInstances.has(tokenName)) {
      const instance = this.singletonInstances.get(tokenName) as T;
      context.resolved.set(tokenName, instance);
      return instance;
    }
    
    const descriptor = this.services.get(tokenName);
    if (!descriptor) {
      throw new Error(`Service '${tokenName}' is not registered`);
    }
    
    // Mark as resolving
    context.resolving.add(tokenName);
    
    try {
      // Resolve dependencies first
      if (descriptor.dependencies && descriptor.dependencies.length > 0) {
        for (const depToken of descriptor.dependencies) {
          await this.resolveWithContext(depToken, context);
        }
      }
      
      // Create instance
      const instance = await Promise.resolve(descriptor.factory(this));
      
      // Store singleton instance
      if (descriptor.lifetime === ServiceLifetime.Singleton) {
        this.singletonInstances.set(tokenName, instance);
      }
      
      // Cache in resolution context
      context.resolved.set(tokenName, instance);
      
      return instance as T;
      
    } finally {
      // Remove from resolving set
      context.resolving.delete(tokenName);
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token.name);
  }

  /**
   * Clear all services and reset container
   */
  clear(): void {
    this.services.clear();
    this.singletonInstances.clear();
    this.resolutionCache.clear();
    this.initializationOrder.length = 0;
    this.resolutionCount = 0;
    this.circularDependencyChecks = 0;
    this.initializationStartTime = 0;
    
    // Clean up timer and recreate
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.setupCleanupTimer();
  }

  /**
   * Clear resolution cache
   */
  clearCache(): void {
    this.resolutionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.resolutionCache.getStats();
  }

  /**
   * Configure cache settings
   */
  configureCaching(config: Partial<CacheConfig>): void {
    this.resolutionCache.configure(config);
  }

  /**
   * Dispose of the container and clean up resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Get container statistics
   */
  getStats(): ContainerStats {
    const initializationDuration = this.initializationStartTime > 0 ? 
      performance.now() - this.initializationStartTime : 0;
    
    const cacheStats = this.resolutionCache.getStats();
      
    return {
      registeredServices: this.services.size,
      singletonInstances: this.singletonInstances.size,
      resolutionCount: this.resolutionCount,
      circularDependencyChecks: this.circularDependencyChecks,
      cachedResolutions: cacheStats.size,
      initializationOrder: [...this.initializationOrder],
      initializationDuration,
      cache: cacheStats
    };
  }
}

/**
 * Helper function to create service tokens with better TypeScript inference
 */
export function createServiceToken<T>(name: string): ServiceToken<T> {
  return { name };
}

// Export cache-related interfaces for external use
export type { CacheConfig, CacheStats };

/**
 * Global service container instance
 */
export const serviceContainer = new ServiceContainer();
