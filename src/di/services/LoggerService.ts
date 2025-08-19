/**
 * Logger Service Implementation
 * Provides structured logging with configurable levels and outputs
 */

import type { ILoggerService, LogEntry, LogLevel, LoggerOptions } from '../ILoggerService.js';
import { LogLevel as LogLevelEnum } from '../ILoggerService.js';

/**
 * Generate a correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export class LoggerService implements ILoggerService {
  private entries: LogEntry[] = [];
  private options: LoggerOptions;
  private correlationId?: string;
  private baseContext?: string;
  private baseMetadata?: Record<string, unknown>;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: options.level ?? LogLevelEnum.INFO,
      enableConsole: options.enableConsole ?? true,
      enableFile: options.enableFile ?? false,
      maxEntries: options.maxEntries ?? 1000,
      enableCorrelationIds: options.enableCorrelationIds ?? true,
      enableJson: options.enableJson ?? false,
      enablePerformanceLogging: options.enablePerformanceLogging ?? true
    };
    
    // Only add filePath if it's provided to avoid undefined assignment
    if (options.filePath !== undefined) {
      this.options.filePath = options.filePath;
    }
    
    // Generate correlation ID if enabled
    if (this.options.enableCorrelationIds) {
      this.correlationId = generateCorrelationId();
    }
  }

  /**
   * Create a logger with a new correlation ID
   */
  static withCorrelationId(options: Partial<LoggerOptions> = {}): LoggerService {
    const logger = new LoggerService(options);
    logger.setCorrelationId(generateCorrelationId());
    return logger;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevelEnum.DEBUG, message, context, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevelEnum.INFO, message, context, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevelEnum.WARN, message, context, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevelEnum.ERROR, message, context, metadata, error);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: string, metadata?: Record<string, unknown>): void {
    if (!this.options.enablePerformanceLogging) {
      return;
    }
    
    const perfMetadata = {
      operation,
      duration,
      ...metadata
    };
    
    this.log(LogLevelEnum.INFO, `Performance: ${operation} completed in ${duration}ms`, context, perfMetadata, undefined, duration);
  }

  /**
   * Log security events
   */
  security(event: string, context?: string, metadata?: Record<string, unknown>): void {
    const securityMetadata = {
      securityEvent: true,
      ...metadata
    };
    
    this.log(LogLevelEnum.WARN, `Security: ${event}`, context, securityMetadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string, metadata?: Record<string, unknown>): ILoggerService {
    const childLogger = new LoggerService(this.options);
    childLogger.baseContext = context;
    childLogger.baseMetadata = metadata;
    childLogger.correlationId = this.correlationId;
    return childLogger;
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>,
    error?: Error,
    duration?: number
  ): void {
    // Check if log level is enabled
    if (level < this.options.level) {
      return;
    }

    // Merge context and metadata with base values
    const finalContext = this.baseContext ? 
      (context ? `${this.baseContext}.${context}` : this.baseContext) : 
      context;
    
    const finalMetadata = this.baseMetadata ? 
      { ...this.baseMetadata, ...metadata } : 
      metadata;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now()
    };
    
    // Add optional properties only if they are defined to avoid undefined assignment with exactOptionalPropertyTypes
    if (finalContext !== undefined) {
      entry.context = finalContext;
    }
    if (finalMetadata !== undefined) {
      entry.metadata = finalMetadata;
    }
    if (error !== undefined) {
      entry.error = error;
    }
    if (this.correlationId !== undefined && this.options.enableCorrelationIds) {
      entry.correlationId = this.correlationId;
    }
    if (duration !== undefined) {
      entry.duration = duration;
    }

    // Add to entries collection
    this.entries.push(entry);
    
    // Prevent memory leaks by limiting entries
    if (this.entries.length > (this.options.maxEntries || 1000)) {
      this.entries = this.entries.slice(-(this.options.maxEntries || 1000));
    }

    // Output to console if enabled
    if (this.options.enableConsole) {
      this.outputToConsole(entry);
    }

    // TODO: Output to file if enabled
    // File logging could be implemented here
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    if (this.options.enableJson) {
      this.outputJsonFormat(entry);
    } else {
      this.outputTextFormat(entry);
    }
  }

  /**
   * Output log entry in JSON format
   */
  private outputJsonFormat(entry: LogEntry): void {
    const jsonEntry = {
      timestamp: new Date(entry.timestamp).toISOString(),
      level: LogLevelEnum[entry.level],
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.correlationId && { correlationId: entry.correlationId }),
      ...(entry.duration !== undefined && { duration: entry.duration }),
      ...(entry.metadata && { metadata: entry.metadata }),
      ...(entry.error && { 
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        }
      })
    };

    switch (entry.level) {
      case LogLevelEnum.DEBUG:
        console.debug(JSON.stringify(jsonEntry));
        break;
      case LogLevelEnum.INFO:
        console.info(JSON.stringify(jsonEntry));
        break;
      case LogLevelEnum.WARN:
        console.warn(JSON.stringify(jsonEntry));
        break;
      case LogLevelEnum.ERROR:
        console.error(JSON.stringify(jsonEntry));
        break;
    }
  }

  /**
   * Output log entry in human-readable text format
   */
  private outputTextFormat(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevelEnum[entry.level];
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    const correlationStr = entry.correlationId ? ` (${entry.correlationId})` : '';
    const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';
    
    const logMessage = `[${timestamp}] ${levelName}${contextStr}${correlationStr}${durationStr}: ${entry.message}`;

    switch (entry.level) {
      case LogLevelEnum.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevelEnum.INFO:
        console.info(logMessage);
        break;
      case LogLevelEnum.WARN:
        console.warn(logMessage);
        break;
      case LogLevelEnum.ERROR:
        console.error(logMessage);
        if (entry.error) {
          console.error('  Error details:', entry.error.stack || entry.error.message);
        }
        break;
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.debug('  Metadata:', JSON.stringify(entry.metadata, null, 2));
    }
  }

  /**
   * Get recent log entries
   */
  getEntries(limit?: number): LogEntry[] {
    if (limit && limit > 0) {
      return this.entries.slice(-limit);
    }
    return [...this.entries];
  }

  /**
   * Clear all log entries
   */
  clearEntries(): void {
    this.entries = [];
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.options.level;
  }
}
