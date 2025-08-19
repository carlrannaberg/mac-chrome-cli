/**
 * Service Tokens for Dependency Injection
 * Defines all service contracts and their tokens for type-safe resolution
 */

import { createServiceToken } from './ServiceContainer.js';
import type { IAppleScriptService } from '../services/IAppleScriptService.js';
import type { IDataSanitizer } from '../security/IDataSanitizer.js';
import type { ISecurePathValidator } from '../security/ISecurePathValidator.js';
import type { ICacheService } from './ICacheService.js';
import type { INetworkService } from './INetworkService.js';
import type { IPerformanceService } from './IPerformanceService.js';
import type { ILoggerService } from './ILoggerService.js';
import type { IConfigurationService } from './IConfigurationService.js';
import type { IRateLimiterService } from './IRateLimiterService.js';

// Core service tokens
export const SERVICE_TOKENS = {
  // AppleScript automation service
  AppleScriptService: createServiceToken<IAppleScriptService>('AppleScriptService'),
  
  // Security services
  DataSanitizer: createServiceToken<IDataSanitizer>('DataSanitizer'),
  PathValidator: createServiceToken<ISecurePathValidator>('PathValidator'),
  
  // Infrastructure services
  CacheService: createServiceToken<ICacheService>('CacheService'),
  NetworkService: createServiceToken<INetworkService>('NetworkService'),
  PerformanceService: createServiceToken<IPerformanceService>('PerformanceService'),
  LoggerService: createServiceToken<ILoggerService>('LoggerService'),
  ConfigurationService: createServiceToken<IConfigurationService>('ConfigurationService'),
  RateLimiterService: createServiceToken<IRateLimiterService>('RateLimiterService')
} as const;

// Export individual tokens for convenience
export const {
  AppleScriptService,
  DataSanitizer,
  PathValidator,
  CacheService,
  NetworkService,
  PerformanceService,
  LoggerService,
  ConfigurationService,
  RateLimiterService
} = SERVICE_TOKENS;
