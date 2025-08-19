/**
 * Service Aware Command Base Class
 * Provides dependency injection for CLI commands
 */

import type { IServiceContainer } from './ServiceContainer.js';
import type { IAppleScriptService } from '../services/IAppleScriptService.js';
import type { IDataSanitizer } from '../security/IDataSanitizer.js';
import type { ISecurePathValidator } from '../security/ISecurePathValidator.js';
import type { ICacheService } from './ICacheService.js';
import type { IPerformanceService } from './IPerformanceService.js';
import type { ILoggerService } from './ILoggerService.js';
import type { IConfigurationService } from './IConfigurationService.js';
import type { IRateLimiterService } from './IRateLimiterService.js';
import { SERVICE_TOKENS } from './ServiceTokens.js';

/**
 * Base class for commands that need access to services
 */
export abstract class ServiceAwareCommand {
  protected constructor(protected readonly container: IServiceContainer) {}

  /**
   * Get AppleScript service
   */
  protected async getAppleScriptService(): Promise<IAppleScriptService> {
    const result = await this.container.resolve(SERVICE_TOKENS.AppleScriptService);
    if (!result.success) {
      throw new Error(`Failed to resolve AppleScriptService: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get data sanitizer service
   */
  protected async getDataSanitizer(): Promise<IDataSanitizer> {
    const result = await this.container.resolve(SERVICE_TOKENS.DataSanitizer);
    if (!result.success) {
      throw new Error(`Failed to resolve DataSanitizer: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get path validator service
   */
  protected async getPathValidator(): Promise<ISecurePathValidator> {
    const result = await this.container.resolve(SERVICE_TOKENS.PathValidator);
    if (!result.success) {
      throw new Error(`Failed to resolve PathValidator: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get cache service
   */
  protected async getCacheService(): Promise<ICacheService> {
    const result = await this.container.resolve(SERVICE_TOKENS.CacheService);
    if (!result.success) {
      throw new Error(`Failed to resolve CacheService: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get performance service
   */
  protected async getPerformanceService(): Promise<IPerformanceService> {
    const result = await this.container.resolve(SERVICE_TOKENS.PerformanceService);
    if (!result.success) {
      throw new Error(`Failed to resolve PerformanceService: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get logger service
   */
  protected async getLoggerService(): Promise<ILoggerService> {
    const result = await this.container.resolve(SERVICE_TOKENS.LoggerService);
    if (!result.success) {
      throw new Error(`Failed to resolve LoggerService: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get configuration service
   */
  protected async getConfigurationService(): Promise<IConfigurationService> {
    const result = await this.container.resolve(SERVICE_TOKENS.ConfigurationService);
    if (!result.success) {
      throw new Error(`Failed to resolve ConfigurationService: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Get rate limiter service
   */
  protected async getRateLimiterService(): Promise<IRateLimiterService> {
    const result = await this.container.resolve(SERVICE_TOKENS.RateLimiterService);
    if (!result.success) {
      throw new Error(`Failed to resolve RateLimiterService: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Helper method to resolve multiple services at once
   */
  protected async resolveServices<T extends Record<string, unknown>>(
    serviceMap: { [K in keyof T]: () => Promise<T[K]> }
  ): Promise<T> {
    const results = {} as T;
    const promises = Object.entries(serviceMap).map(async ([key, resolver]) => {
      const service = await (resolver as () => Promise<unknown>)();
      (results as Record<string, unknown>)[key] = service;
    });
    
    await Promise.all(promises);
    return results;
  }
}

/**
 * Create a service-aware command instance
 */
export function createServiceAwareCommand<T extends ServiceAwareCommand>(
  CommandClass: new (container: IServiceContainer) => T,
  container: IServiceContainer
): T {
  return new CommandClass(container);
}
