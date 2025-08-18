/**
 * Dependency Injection System
 * Exports all DI-related types and utilities
 */

// Core container
export {
  ServiceContainer,
  ServiceLifetime,
  createServiceToken,
  type IServiceContainer,
  type ServiceToken,
  type ServiceDescriptor,
  type ServiceFactory,
  type ContainerStats
} from './ServiceContainer.js';

// Service tokens
export { SERVICE_TOKENS } from './ServiceTokens.js';

// Service interfaces
export type { ICacheService, CacheEntry, CacheStats } from './ICacheService.js';
export type { INetworkService, NetworkEvent, NetworkStats, NetworkMonitoringOptions } from './INetworkService.js';
export type { IPerformanceService, PerformanceBenchmark, PerformanceStats } from './IPerformanceService.js';
export type { ILoggerService, LogEntry, LogLevel, LoggerOptions } from './ILoggerService.js';
export type { IConfigurationService, GlobalConfiguration } from './IConfigurationService.js';

// Service implementations
export { CacheService } from './services/CacheService.js';
export { PerformanceService } from './services/PerformanceService.js';
export { LoggerService } from './services/LoggerService.js';
export { ConfigurationService } from './services/ConfigurationService.js';

// Service registry
export { registerServices, createServiceContainer } from './ServiceRegistry.js';

// Service-aware command base
export { ServiceAwareCommand, createServiceAwareCommand } from './ServiceAwareCommand.js';
