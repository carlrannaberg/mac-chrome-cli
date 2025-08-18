/**
 * Base class for commands to eliminate duplication and ensure consistent patterns
 * 
 * Provides:
 * - Standardized error handling
 * - Common validation patterns
 * - Consistent result formatting
 * - Retry logic integration
 */

import { Result, ok, error, ErrorCode } from './Result.js';
import { ErrorUtils, validateInputParam, executeWithContext } from './ErrorUtils.js';
import { withRetry, type RetryOptions } from './RetryHandler.js';

/**
 * Base options for all commands
 */
export interface BaseCommandOptions {
  tabIndex?: number;
  windowIndex?: number;
  timeoutMs?: number;
}

/**
 * Validation schema for command parameters
 */
export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: readonly string[];
  };
}

/**
 * Base command class with common functionality
 */
export abstract class CommandBase {
  /**
   * Validate command parameters against schema
   */
  protected validateParams(
    params: Record<string, unknown>,
    schema: ValidationSchema
  ): Result<void, string> {
    for (const [key, rules] of Object.entries(schema)) {
      const value = params[key];
      
      // Check required parameters
      const validation = validateInputParam(value, key, rules.type, rules.required ?? false);
      if (!validation.success) {
        return validation;
      }
      
      // Skip further validation if value is undefined/null and not required
      if (value === undefined || value === null) {
        continue;
      }
      
      // Additional validations based on type
      if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          return ErrorUtils.validationError(
            `${key} must be at least ${rules.min}`,
            key,
            value
          );
        }
        if (rules.max !== undefined && value > rules.max) {
          return ErrorUtils.validationError(
            `${key} must be at most ${rules.max}`,
            key,
            value
          );
        }
      }
      
      if (rules.type === 'string' && typeof value === 'string') {
        if (rules.pattern && !rules.pattern.test(value)) {
          return ErrorUtils.validationError(
            `${key} format is invalid`,
            key,
            value
          );
        }
        if (rules.enum && !rules.enum.includes(value)) {
          return ErrorUtils.validationError(
            `${key} must be one of: ${rules.enum.join(', ')}`,
            key,
            value
          );
        }
      }
    }
    
    return ok(undefined);
  }
  
  /**
   * Validate base command options
   */
  protected validateBaseOptions(options: BaseCommandOptions): Result<void, string> {
    return this.validateParams(options, {
      tabIndex: { type: 'number', min: 1, max: 100 },
      windowIndex: { type: 'number', min: 1, max: 50 },
      timeoutMs: { type: 'number', min: 1000, max: 300000 } // 1s to 5min
    });
  }
  
  /**
   * Execute command with standard error handling and retry logic
   */
  protected async executeCommand<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryOptions?: RetryOptions
  ): Promise<Result<T, string>> {
    if (retryOptions) {
      return withRetry(
        () => executeWithContext(operation, operationName),
        retryOptions,
        operationName
      );
    }
    
    return executeWithContext(operation, operationName);
  }
  
  /**
   * Execute command with automatic retry for browser operations
   */
  protected async executeBrowserCommand<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<Result<T, string>> {
    return this.executeCommand(
      operation,
      operationName,
      {
        maxAttempts: 2,
        initialDelayMs: 500,
        retryCondition: (errorCode) => {
          // Retry for common browser issues
          return errorCode === ErrorCode.TARGET_NOT_FOUND ||
                 errorCode === ErrorCode.ELEMENT_NOT_VISIBLE ||
                 errorCode === ErrorCode.JAVASCRIPT_ERROR ||
                 errorCode === ErrorCode.TIMEOUT;
        }
      }
    );
  }
  
  /**
   * Create selector not found error with helpful context
   */
  protected createSelectorError(selector: string, context?: string): Result<never, string> {
    return ErrorUtils.targetNotFoundError(selector, context || 'element');
  }
  
  /**
   * Create timeout error with operation context
   */
  protected createTimeoutError(
    operation: string,
    timeoutMs: number,
    actualMs?: number
  ): Result<never, string> {
    return ErrorUtils.timeoutError(operation, timeoutMs, actualMs);
  }
  
  /**
   * Normalize tab and window indices with validation
   */
  protected normalizeIndices(options: BaseCommandOptions): {
    tabIndex: number;
    windowIndex: number;
    timeoutMs: number;
  } {
    return {
      tabIndex: options.tabIndex ?? 1,
      windowIndex: options.windowIndex ?? 1,
      timeoutMs: options.timeoutMs ?? 30000
    };
  }
}

/**
 * Browser command base class with Chrome-specific functionality
 */
export abstract class BrowserCommandBase extends CommandBase {
  /**
   * Execute JavaScript with error handling and result validation
   */
  protected async executeJavaScript<T>(
    javascript: string,
    tabIndex: number = 1,
    windowIndex: number = 1,
    timeoutMs: number = 30000,
    operationName: string = 'javascript-execution'
  ): Promise<Result<T, string>> {
    return this.executeBrowserCommand(async () => {
      const { execChromeJS } = await import('../lib/apple.js');
      const result = await execChromeJS<T>(javascript, tabIndex, windowIndex, timeoutMs);
      
      if (!result.success) {
        if (result.error?.includes('Element not found')) {
          throw new Error(`Element not found: ${result.error}`);
        }
        if (result.error?.includes('timeout')) {
          throw new Error(`Operation timed out: ${result.error}`);
        }
        throw new Error(result.error || 'JavaScript execution failed');
      }
      
      return result.result as T;
    }, operationName);
  }
  
  /**
   * Validate CSS selector format
   */
  protected validateSelector(selector: string): Result<void, string> {
    if (!selector || typeof selector !== 'string') {
      return ErrorUtils.validationError('Selector is required', 'selector', selector);
    }
    
    if (selector.trim().length === 0) {
      return ErrorUtils.validationError('Selector cannot be empty', 'selector', selector);
    }
    
    // Basic CSS selector validation
    try {
      // This will throw if selector is invalid
      if (typeof document !== 'undefined') {
        document.querySelector(selector);
      }
    } catch {
      return ErrorUtils.validationError(
        'Invalid CSS selector syntax',
        'selector',
        selector
      );
    }
    
    return ok(undefined);
  }
}

/**
 * Utility functions for command implementations
 */
export const CommandUtils = {
  /**
   * Create standardized command result
   */
  createCommandResult<T>(
    data: T,
    commandName: string,
    metadata?: Record<string, unknown>
  ): Result<T, string> {
    return ok(data, ErrorCode.OK, {
      metadata: {
        command: commandName,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  },
  
  /**
   * Extract error message from various error types
   */
  extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  },
  
  /**
   * Check if error indicates element not found
   */
  isElementNotFoundError(error: unknown): boolean {
    const message = this.extractErrorMessage(error).toLowerCase();
    return message.includes('element not found') ||
           message.includes('not found') ||
           message.includes('no element');
  },
  
  /**
   * Check if error indicates timeout
   */
  isTimeoutError(error: unknown): boolean {
    const message = this.extractErrorMessage(error).toLowerCase();
    return message.includes('timeout') ||
           message.includes('timed out');
  }
};
