/**
 * Logger Service Implementation
 * Provides structured logging with configurable levels and outputs
 */

import type { ILoggerService, LogEntry, LogLevel, LoggerOptions } from '../ILoggerService.js';
import { LogLevel as LogLevelEnum } from '../ILoggerService.js';

export class LoggerService implements ILoggerService {
  private entries: LogEntry[] = [];
  private options: LoggerOptions;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: options.level ?? LogLevelEnum.INFO,
      enableConsole: options.enableConsole ?? true,
      enableFile: options.enableFile ?? false,
      filePath: options.filePath,
      maxEntries: options.maxEntries ?? 1000
    };
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
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): void {
    // Check if log level is enabled
    if (level < this.options.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      metadata,
      error
    };

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
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevelEnum[entry.level];
    const prefix = `[${timestamp}] ${levelName}`;
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    const logMessage = `${prefix}${contextStr}: ${entry.message}`;

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
          console.error(entry.error.stack);
        }
        break;
    }

    if (entry.metadata) {
      console.debug('Metadata:', entry.metadata);
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
