/**
 * Logger Service Interface
 * Provides structured logging functionality
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerOptions {
  level: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxEntries?: number;
}

export interface ILoggerService {
  /**
   * Log debug message
   */
  debug(message: string, context?: string, metadata?: Record<string, unknown>): void;
  
  /**
   * Log info message
   */
  info(message: string, context?: string, metadata?: Record<string, unknown>): void;
  
  /**
   * Log warning message
   */
  warn(message: string, context?: string, metadata?: Record<string, unknown>): void;
  
  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: string, metadata?: Record<string, unknown>): void;
  
  /**
   * Get recent log entries
   */
  getEntries(limit?: number): LogEntry[];
  
  /**
   * Clear all log entries
   */
  clearEntries(): void;
  
  /**
   * Set log level
   */
  setLevel(level: LogLevel): void;
  
  /**
   * Get current log level
   */
  getLevel(): LogLevel;
}
