/**
 * Logger utilities for command implementations
 * Provides convenient access to structured logging outside of service-aware classes
 */

import { LoggerService } from '../di/services/LoggerService.js';
import type { ILoggerService } from '../di/ILoggerService.js';
import { LogLevel } from '../di/ILoggerService.js';

/**
 * Global logger instance for use in utility functions and commands
 * This is initialized during application startup
 */
let globalLogger: ILoggerService | null = null;

/**
 * Initialize the global logger instance
 * Should be called during application startup
 */
export function initializeLogger(logger: ILoggerService): void {
  globalLogger = logger;
}

/**
 * Get the global logger instance
 * Falls back to a console-based logger if not initialized
 */
export function getLogger(): ILoggerService {
  if (globalLogger) {
    return globalLogger;
  }
  
  // Fallback logger for early use before DI container is ready
  return new LoggerService({
    level: LogLevel.INFO,
    enableConsole: true,
    enableJson: false,
    enableCorrelationIds: false,
    enablePerformanceLogging: true
  });
}

/**
 * Create a child logger with context for a specific operation
 */
export function createCommandLogger(commandName: string, correlationId?: string): ILoggerService {
  const logger = getLogger().child(`command.${commandName}`);
  if (correlationId) {
    logger.setCorrelationId(correlationId);
  }
  return logger;
}

/**
 * Log a command execution start
 */
export function logCommandStart(commandName: string, args?: Record<string, unknown>): string {
  const correlationId = Math.random().toString(36).substring(2, 15);
  const logger = createCommandLogger(commandName, correlationId);
  
  logger.info(`Command started: ${commandName}`, 'execution', {
    command: commandName,
    arguments: args,
    correlationId
  });
  
  return correlationId;
}

/**
 * Log a command execution completion
 */
export function logCommandEnd(
  commandName: string, 
  correlationId: string, 
  success: boolean, 
  duration?: number,
  error?: Error
): void {
  const logger = createCommandLogger(commandName, correlationId);
  
  if (success) {
    if (duration !== undefined) {
      logger.performance(`${commandName}`, duration, 'execution', {
        command: commandName,
        correlationId
      });
    } else {
      logger.info(`Command completed: ${commandName}`, 'execution', {
        command: commandName,
        correlationId,
        success: true
      });
    }
  } else {
    logger.error(`Command failed: ${commandName}`, error, 'execution', {
      command: commandName,
      correlationId,
      success: false
    });
  }
}

/**
 * Log a security event
 */
export function logSecurityEvent(event: string, context?: string, metadata?: Record<string, unknown>): void {
  const logger = getLogger();
  logger.security(event, context, metadata);
}

/**
 * Log a performance metric
 */
export function logPerformance(operation: string, duration: number, context?: string, metadata?: Record<string, unknown>): void {
  const logger = getLogger();
  logger.performance(operation, duration, context, metadata);
}