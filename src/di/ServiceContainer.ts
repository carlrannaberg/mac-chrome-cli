/**
 * Service Container for Dependency Injection
 * Manages service lifetimes, dependencies, and provides type-safe service resolution
 */

import { Result } from '../core/Result.js';

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
  private readonly resolutionCache = new Map<string, Promise<unknown>>();
  private readonly initializationOrder: string[] = [];
  private resolutionCount = 0;
  private circularDependencyChecks = 0;
  private initializationStartTime: number = 0;

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
      return { success: false, error: `Service '${token.name}' is not registered` };
    }
    
    // Only cache concurrent resolution promises for singletons to avoid duplicate work
    // Transient services should always create new instances
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const cachedPromise = this.resolutionCache.get(token.name);
      if (cachedPromise) {
        try {
          const result = await cachedPromise as T;
          return { success: true, data: result };
        } catch (err) {
          this.resolutionCache.delete(token.name);
          const errorMessage = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Failed to resolve cached service '${token.name}': ${errorMessage}` };
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
      
      return { success: true, data: result };
    } catch (err) {
      // Remove failed resolution from cache
      if (descriptor.lifetime === ServiceLifetime.Singleton) {
        this.resolutionCache.delete(token.name);
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to resolve service '${token.name}': ${errorMessage}` };
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
  }

  /**
   * Get container statistics
   */
  getStats(): ContainerStats {
    const initializationDuration = this.initializationStartTime > 0 ? 
      performance.now() - this.initializationStartTime : 0;
      
    return {
      registeredServices: this.services.size,
      singletonInstances: this.singletonInstances.size,
      resolutionCount: this.resolutionCount,
      circularDependencyChecks: this.circularDependencyChecks,
      cachedResolutions: this.resolutionCache.size,
      initializationOrder: [...this.initializationOrder],
      initializationDuration
    };
  }
}

/**
 * Helper function to create service tokens with better TypeScript inference
 */
export function createServiceToken<T>(name: string): ServiceToken<T> {
  return { name };
}

/**
 * Global service container instance
 */
export const serviceContainer = new ServiceContainer();
