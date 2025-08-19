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
  correlationId?: string;
  duration?: number;
}

export interface LoggerOptions {
  level: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxEntries?: number;
  enableCorrelationIds?: boolean;
  enableJson?: boolean;
  enablePerformanceLogging?: boolean;
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
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: string, metadata?: Record<string, unknown>): void;
  
  /**
   * Log security events
   */
  security(event: string, context?: string, metadata?: Record<string, unknown>): void;
  
  /**
   * Create a child logger with additional context
   */
  child(context: string, metadata?: Record<string, unknown>): ILoggerService;
  
  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(correlationId: string): void;
  
  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined;
  
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
