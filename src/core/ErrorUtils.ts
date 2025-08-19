/**
 * Enhanced error utilities for eliminating code duplication across mac-chrome-cli
 * 
 * Provides:
 * - Unified error handling patterns
 * - Context-aware error creation
 * - Error transformation utilities
 * - Legacy compatibility adapters
 */

import { Result, ok, error, isOk, withContext, type ResultContext } from './Result.js';
import { ErrorCode } from './ErrorCodes.js';
import { formatErrorJSON, formatErrorText, type ErrorDisplayOptions } from './ErrorFormatter.js';
import { withRetry, type RetryOptions } from './RetryHandler.js';

/**
 * Interface for custom errors with error code information
 */
interface CustomError extends Error {
  errorCode: ErrorCode;
  recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable';
  metadata?: Record<string, unknown>;
}

/**
 * Type guard to check if an error is a custom error with error code
 */
function isCustomError(error: Error): error is CustomError {
  return 'errorCode' in error && 'recoveryHint' in error && (error.name === 'ScreenshotError' || error.name === 'TabCommandError');
}

/**
 * Type guard to check if an error has an error code
 */
function hasErrorCode(error: Error): error is Error & { errorCode: number } {
  return 'errorCode' in error && typeof (error as Error & { errorCode: unknown }).errorCode === 'number';
}

/**
 * Common error creation patterns
 */
export class ErrorUtils {
  /**
   * Create a validation error with context
   */
  static validationError<E = string>(
    message: string, 
    field?: string,
    value?: unknown
  ): Result<never, E> {
    const context: ResultContext = {
      recoveryHint: 'user_action',
      metadata: {
        validationField: field,
        providedValue: value,
        timestamp: new Date().toISOString()
      }
    };
    
    return error(message as E, ErrorCode.INVALID_INPUT, context);
  }
  
  /**
   * Create a target not found error with context
   */
  static targetNotFoundError<E = string>(
    selector: string,
    elementType?: string
  ): Result<never, E> {
    const context: ResultContext = {
      recoveryHint: 'check_target',
      metadata: {
        selector,
        elementType: elementType || 'element',
        suggestion: 'Verify element exists and selector is correct'
      }
    };
    
    return error(`Element not found: ${selector}` as E, ErrorCode.TARGET_NOT_FOUND, context);
  }
  
  /**
   * Create a timeout error with context
   */
  static timeoutError<E = string>(
    operation: string,
    timeoutMs: number,
    actualDurationMs?: number
  ): Result<never, E> {
    const context: ResultContext = {
      recoveryHint: 'retry_with_delay',
      metadata: {
        operation,
        timeoutMs,
        actualDurationMs,
        suggestion: 'Increase timeout or check for performance issues'
      }
    };
    
    return error(`Operation timed out: ${operation}` as E, ErrorCode.TIMEOUT, context);
  }
  
  /**
   * Create a permission error with context
   */
  static permissionError<E = string>(
    requiredPermission: string,
    instructions?: string
  ): Result<never, E> {
    const context: ResultContext = {
      recoveryHint: 'permission',
      metadata: {
        requiredPermission,
        instructions: instructions || 'Check System Preferences > Privacy & Security',
        needsUserAction: true
      }
    };
    
    return error(`Permission required: ${requiredPermission}` as E, ErrorCode.PERMISSION_DENIED, context);
  }
  
  /**
   * Create a Chrome-related error with context
   */
  static chromeError<E = string>(
    issue: string,
    errorCode: ErrorCode = ErrorCode.CHROME_NOT_RUNNING
  ): Result<never, E> {
    const context: ResultContext = {
      recoveryHint: 'user_action',
      metadata: {
        chromeIssue: issue,
        suggestion: 'Ensure Google Chrome is installed and running'
      }
    };
    
    return error(`Chrome error: ${issue}` as E, errorCode, context);
  }
  
  /**
   * Transform a caught exception into a Result
   */
  static fromException<T>(
    exception: unknown,
    operation: string,
    defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
  ): Result<T, Error> {
    const err = exception instanceof Error ? exception : new Error(String(exception));
    
    // Check if this is a custom error with error code information
    let errorCode = defaultCode;
    let recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' | 'retry_with_delay' | 'user_action' = 'retry';
    let customMetadata: Record<string, unknown> = {};
    
    if (isCustomError(err)) {
      errorCode = err.errorCode;
      recoveryHint = err.recoveryHint;
      customMetadata = err.metadata || {};
    } else if (hasErrorCode(err)) {
      errorCode = err.errorCode;
      // Use appropriate recovery hint based on error code
      switch (errorCode) {
        case ErrorCode.ELEMENT_NOT_INTERACTABLE:
        case ErrorCode.TARGET_NOT_FOUND:
          recoveryHint = 'check_target';
          break;
        case ErrorCode.ELEMENT_NOT_VISIBLE:
        case ErrorCode.TARGET_OUTSIDE_VIEWPORT:
          recoveryHint = 'retry';
          break;
        case ErrorCode.MOUSE_CLICK_FAILED:
        case ErrorCode.KEYBOARD_INPUT_FAILED:
          recoveryHint = 'retry_with_delay';
          break;
        case ErrorCode.PERMISSION_DENIED:
        case ErrorCode.ACCESSIBILITY_DENIED:
          recoveryHint = 'permission';
          break;
        default:
          recoveryHint = 'retry';
      }
    }
    
    const context: ResultContext = {
      recoveryHint,
      metadata: {
        operation,
        originalMessage: err.message,
        exceptionType: exception?.constructor.name || 'unknown',
        ...customMetadata
      },
      ...(err.stack && { stackTrace: err.stack })
    };
    
    return error(err, errorCode, context);
  }
  
  /**
   * Add operation context to an existing error result
   */
  static addOperationContext<T, E>(
    result: Result<T, E>,
    operation: string,
    startTime?: number
  ): Result<T, E> {
    if (isOk(result)) {
      return result;
    }
    
    const additionalContext: Partial<ResultContext> = {
      metadata: {
        ...result.context?.metadata,
        operation,
        ...(startTime && { durationMs: Date.now() - startTime })
      }
    };
    
    return withContext(result, additionalContext);
  }
  
  /**
   * Chain multiple operations and collect errors
   */
  static async chainOperations<T>(
    operations: Array<() => Promise<Result<T, unknown>>>,
    stopOnFirstError: boolean = true
  ): Promise<Result<T[], unknown[]>> {
    const results: T[] = [];
    const errors: unknown[] = [];
    
    for (const operation of operations) {
      try {
        const result = await operation();
        
        if (isOk(result)) {
          results.push(result.data as T);
        } else {
          errors.push(result.error);
          
          if (stopOnFirstError) {
            return error(errors, ErrorCode.UNKNOWN_ERROR, {
              recoveryHint: 'check_target',
              metadata: {
                completedOperations: results.length,
                totalOperations: operations.length,
                failedAtOperation: results.length + 1
              }
            });
          }
        }
      } catch (exception) {
        const err = exception instanceof Error ? exception : new Error(String(exception));
        errors.push(err);
        
        if (stopOnFirstError) {
          return error(errors, ErrorCode.UNKNOWN_ERROR, {
            recoveryHint: 'not_recoverable',
            metadata: {
              completedOperations: results.length,
              totalOperations: operations.length,
              exceptionAtOperation: results.length + 1
            }
          });
        }
      }
    }
    
    if (errors.length > 0 && !stopOnFirstError) {
      return error(errors, ErrorCode.UNKNOWN_ERROR, {
        recoveryHint: 'check_target',
        metadata: {
          completedOperations: results.length,
          totalOperations: operations.length,
          totalErrors: errors.length
        }
      });
    }
    
    return ok(results);
  }
}

/**
 * Utility functions for common error handling patterns
 */

/**
 * Validate input and return appropriate error
 */
export function validateInputParam(
  value: unknown,
  name: string,
  type: 'string' | 'number' | 'boolean' | 'object',
  required: boolean = true
): Result<void, string> {
  if (required && (value === undefined || value === null)) {
    return ErrorUtils.validationError(`Missing required parameter: ${name}`, name, value);
  }
  
  if (value === undefined || value === null) {
    return ok(undefined); // Optional parameter
  }
  
  let isValid = false;
  
  switch (type) {
    case 'string':
      isValid = typeof value === 'string' && value.trim().length > 0;
      break;
    case 'number':
      isValid = typeof value === 'number' && !isNaN(value);
      break;
    case 'boolean':
      isValid = typeof value === 'boolean';
      break;
    case 'object':
      isValid = typeof value === 'object' && value !== null;
      break;
  }
  
  if (!isValid) {
    return ErrorUtils.validationError(
      `Invalid ${name}: expected ${type}, got ${typeof value}`,
      name,
      value
    );
  }
  
  return ok(undefined);
}

/**
 * Execute operation with automatic error context
 */
export async function executeWithContext<T>(
  operation: () => Promise<T>,
  operationName: string,
  retryOptions?: RetryOptions
): Promise<Result<T, Error>> {
  const startTime = Date.now();
  
  const wrappedOperation = async (): Promise<Result<T, Error>> => {
    try {
      const result = await operation();
      return ok(result, ErrorCode.OK, {
        durationMs: Date.now() - startTime,
        metadata: { operation: operationName }
      });
    } catch (exception) {
      return ErrorUtils.fromException(exception, operationName);
    }
  };
  
  if (retryOptions) {
    return withRetry(wrappedOperation, retryOptions, operationName);
  }
  
  return wrappedOperation();
}

/**
 * Execute sync operation with automatic error context
 */
export function executeSyncWithContext<T>(
  operation: () => T,
  operationName: string
): Result<T, Error> {
  const startTime = Date.now();
  
  try {
    const result = operation();
    return ok(result, ErrorCode.OK, {
      durationMs: Date.now() - startTime,
      metadata: { operation: operationName }
    });
  } catch (exception) {
    const errorResult = ErrorUtils.fromException<T>(exception, operationName);
    return {
      ...errorResult,
      context: {
        ...errorResult.context,
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Create a formatted response for CLI output
 */
export function createFormattedResponse<T>(
  result: Result<T, unknown>,
  options: ErrorDisplayOptions = {}
): { output: string; exitCode: number; isError: boolean } {
  if (isOk(result)) {
    return {
      output: options.json ? 
        JSON.stringify({ success: true, data: result.data }, null, 2) :
        typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
      exitCode: 0,
      isError: false
    };
  }
  
  const errorOutput = options.json ?
    JSON.stringify(formatErrorJSON(result, options), null, 2) :
    formatErrorText(result, options);
    
  return {
    output: errorOutput,
    exitCode: result.code,
    isError: true
  };
}

/**
 * Legacy compatibility helpers
 */
export namespace LegacyCompatibility {
  /**
   * Convert new Result to legacy format for backward compatibility
   */
  export function toLegacyFormat<T>(
    result: Result<T, unknown>
  ): { success: boolean; data?: T; error?: string; code: number; timestamp: string } {
    return {
      success: isOk(result),
      ...(isOk(result) && { data: result.data }),
      ...(!isOk(result) && { error: String(result.error) }),
      code: result.code,
      timestamp: result.timestamp
    };
  }
  
  /**
   * Convert legacy format to new Result
   */
  export function fromLegacyFormat<T>(
    legacy: { success: boolean; data?: T; error?: string; code: number }
  ): Result<T, string> {
    if (legacy.success && legacy.data !== undefined) {
      return ok(legacy.data, legacy.code as ErrorCode);
    }
    
    return error(
      legacy.error || 'Unknown error',
      legacy.code as ErrorCode
    );
  }
}
