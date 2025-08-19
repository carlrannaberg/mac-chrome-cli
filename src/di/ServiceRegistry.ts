/**
 * Service Registry
 * Configures and registers all application services with the DI container
 */

import type { IServiceContainer } from './ServiceContainer.js';
import { SERVICE_TOKENS } from './ServiceTokens.js';

// Service implementations
import { AppleScriptService } from '../services/AppleScriptService.js';
import { NetworkDataSanitizer } from '../security/DataSanitizer.js';
import { SecurePathValidator } from '../security/PathValidator.js';
import { CacheService } from './services/CacheService.js';
import { PerformanceService } from './services/PerformanceService.js';
import { LoggerService } from './services/LoggerService.js';
import { ConfigurationService } from './services/ConfigurationService.js';
import { RateLimiterService } from './services/RateLimiterService.js';

/**
 * Register all application services with the container
 */
export async function registerServices(container: IServiceContainer): Promise<void> {
  // Configuration service - foundation service (no dependencies)
  container.registerSingleton(
    SERVICE_TOKENS.ConfigurationService,
    () => new ConfigurationService()
  );

  // Logger service - depends on configuration
  container.registerSingleton(
    SERVICE_TOKENS.LoggerService,
    async (serviceContainer) => {
      const configResult = await serviceContainer.resolve(SERVICE_TOKENS.ConfigurationService);
      if (!configResult.success) {
        throw new Error(`Failed to resolve ConfigurationService: ${configResult.error}`);
      }
      const config = configResult.data;
      
      const loggingConfig = config.get<{ 
        level?: string; 
        enableConsole?: boolean; 
        enableFile?: boolean; 
        maxEntries?: number;
        enableCorrelationIds?: boolean;
        enableJson?: boolean;
        enablePerformanceLogging?: boolean;
      }>('logging');
      return new LoggerService({
        level: getLogLevel(loggingConfig?.level),
        enableConsole: loggingConfig?.enableConsole ?? true,
        enableFile: loggingConfig?.enableFile ?? false,
        maxEntries: loggingConfig?.maxEntries ?? 1000,
        enableCorrelationIds: loggingConfig?.enableCorrelationIds ?? true,
        enableJson: loggingConfig?.enableJson ?? false,
        enablePerformanceLogging: loggingConfig?.enablePerformanceLogging ?? true
      });
    },
    [SERVICE_TOKENS.ConfigurationService]
  );

  // Cache service - depends on configuration
  container.registerSingleton(
    SERVICE_TOKENS.CacheService,
    async (serviceContainer) => {
      const configResult = await serviceContainer.resolve(SERVICE_TOKENS.ConfigurationService);
      if (!configResult.success) {
        throw new Error(`Failed to resolve ConfigurationService: ${configResult.error}`);
      }
      const config = configResult.data;
      
      return new CacheService({
        maxSize: config.get('maxCacheSize') ?? 100,
        ttl: config.get('cacheTTL') ?? 900000
      });
    },
    [SERVICE_TOKENS.ConfigurationService]
  );

  // Performance service - depends on configuration
  container.registerSingleton(
    SERVICE_TOKENS.PerformanceService,
    async (serviceContainer) => {
      const configResult = await serviceContainer.resolve(SERVICE_TOKENS.ConfigurationService);
      if (!configResult.success) {
        throw new Error(`Failed to resolve ConfigurationService: ${configResult.error}`);
      }
      const config = configResult.data;
      
      const perfConfig = config.get<{ maxBenchmarks?: number }>('performance');
      return new PerformanceService({
        maxBenchmarks: perfConfig?.maxBenchmarks ?? 1000
      });
    },
    [SERVICE_TOKENS.ConfigurationService]
  );

  // Security services - no dependencies
  container.registerSingleton(
    SERVICE_TOKENS.DataSanitizer,
    () => new NetworkDataSanitizer()
  );

  container.registerSingleton(
    SERVICE_TOKENS.PathValidator,
    () => new SecurePathValidator()
  );

  // Rate limiter service - depends on configuration
  container.registerSingleton(
    SERVICE_TOKENS.RateLimiterService,
    async (serviceContainer) => {
      const configResult = await serviceContainer.resolve(SERVICE_TOKENS.ConfigurationService);
      if (!configResult.success) {
        throw new Error(`Failed to resolve ConfigurationService: ${configResult.error}`);
      }
      
      return new RateLimiterService();
    },
    [SERVICE_TOKENS.ConfigurationService]
  );

  // AppleScript service - depends on data sanitizer and performance service
  container.registerSingleton(
    SERVICE_TOKENS.AppleScriptService,
    async (_serviceContainer) => {
      // The current AppleScriptService creates its own NetworkDataSanitizer
      // For now, we'll use the existing implementation but register it as a service
      return new AppleScriptService();
    },
    [] // No explicit dependencies for now to maintain backward compatibility
  );

  // Network service placeholder - would be implemented when needed
  // For now, network functionality is built into commands
  /*
  container.registerSingleton(
    SERVICE_TOKENS.NetworkService,
    async (serviceContainer) => {
      const [dataSanitizerResult, configResult] = await Promise.all([
        serviceContainer.resolve(SERVICE_TOKENS.DataSanitizer),
        serviceContainer.resolve(SERVICE_TOKENS.ConfigurationService)
      ]);
      
      if (!dataSanitizerResult.success || !configResult.success) {
        throw new Error('Failed to resolve NetworkService dependencies');
      }
      
      return new NetworkService(
        dataSanitizerResult.data,
        configResult.data.get('networkMonitoring')
      );
    },
    [SERVICE_TOKENS.DataSanitizer, SERVICE_TOKENS.ConfigurationService]
  );
  */
}

/**
 * Convert string log level to enum
 */
function getLogLevel(level?: string): number {
  const { LogLevel } = require('./ILoggerService.js');
  switch (level?.toUpperCase()) {
    case 'DEBUG': return LogLevel.DEBUG;
    case 'INFO': return LogLevel.INFO;
    case 'WARN': return LogLevel.WARN;
    case 'ERROR': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
}

/**
 * Get a configured service container with all services registered
 */
export async function createServiceContainer(): Promise<IServiceContainer> {
  const { ServiceContainer } = await import('./ServiceContainer.js');
  const container = new ServiceContainer();
  await registerServices(container);
  return container;
}
