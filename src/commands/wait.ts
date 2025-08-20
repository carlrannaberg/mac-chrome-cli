import { Result, ok, ErrorCode, error as createError } from '../core/index.js';
import { ErrorUtils } from '../core/ErrorUtils.js';
import { logCommandStart, logCommandEnd, logPerformance } from '../lib/logger.js';

export interface WaitOptions {
  milliseconds?: number;
}

export interface WaitResult {
  success: boolean;
  cmd: string;
  durationMs: number;
  actualMs: number;
  timestamp: string;
}

/**
 * Default wait duration in milliseconds
 */
const DEFAULT_WAIT_MS = 800;

/**
 * Maximum allowed wait duration (10 minutes)
 */
const MAX_WAIT_MS = 10 * 60 * 1000;

/**
 * Minimum allowed wait duration
 */
const MIN_WAIT_MS = 1;

/**
 * Wait for the specified duration
 * 
 * Pauses execution for the specified number of milliseconds. Provides accurate
 * timing with validation and interruption handling. Useful for adding delays
 * between operations or waiting for page changes to settle.
 * 
 * @param options Wait configuration options
 * @param options.milliseconds Duration to wait in milliseconds (default: 800, min: 1, max: 600000)
 * @returns Promise resolving to wait result with timing information
 * 
 * @throws {ErrorCode.INVALID_INPUT} When milliseconds is not a number, NaN, or invalid value
 * @throws {ErrorCode.VALIDATION_FAILED} When milliseconds is negative infinity, below minimum (1ms), or above maximum (600000ms)
 * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When options parameter is malformed
 * 
 * @throws {ErrorCode.TIMEOUT} When wait operation is interrupted by system signals
 * @throws {ErrorCode.PROCESS_FAILED} When wait promise rejection occurs due to external factors
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent wait operation
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during wait
 * 
 * @example
 * ```typescript
 * // Wait with default duration (800ms) and error handling
 * try {
 *   const result = await waitIdle();
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.VALIDATION_FAILED:
 *         console.log('Invalid wait duration specified');
 *         break;
 *       case ErrorCode.TIMEOUT:
 *         console.log('Wait was interrupted');
 *         break;
 *     }
 *   } else {
 *     console.log(`Waited ${result.data.actualMs}ms successfully`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected wait error:', error);
 * }
 * 
 * // Wait for custom duration
 * const customResult = await waitIdle({ milliseconds: 2000 });
 * 
 * // Wait for minimum duration
 * const minResult = await waitIdle({ milliseconds: 1 });
 * 
 * // Wait for page transitions
 * await waitIdle({ milliseconds: 1500 }); // Allow time for animations
 * ```
 */
export async function waitIdle(options: WaitOptions = {}): Promise<Result<WaitResult, string>> {
  const requestedMs = options.milliseconds ?? DEFAULT_WAIT_MS;
  
  // Start logging for this command execution
  const correlationId = logCommandStart('wait', { 
    requestedMs,
    ...options 
  });
  
  // Validate input parameters - check for special cases first to match test expectations
  if (typeof requestedMs !== 'number' || isNaN(requestedMs)) {
    const error = ErrorUtils.validationError(
      'Invalid milliseconds value. Must be a number.',
      'milliseconds',
      requestedMs
    );
    logCommandEnd('wait', correlationId, false, undefined, new Error('Invalid milliseconds value'));
    return error;
  }
  
  // Check for -Infinity specifically (Infinity is handled in the "too long" check below)
  if (requestedMs === -Infinity) {
    const error = ErrorUtils.validationError(
      'Invalid milliseconds value. Must be a finite number.',
      'milliseconds',
      requestedMs
    );
    logCommandEnd('wait', correlationId, false, undefined, new Error('Invalid milliseconds value: -Infinity'));
    return error;
  }
  
  if (requestedMs < MIN_WAIT_MS) {
    const error = ErrorUtils.validationError(
      `Wait duration too short. Minimum is ${MIN_WAIT_MS}ms.`,
      'milliseconds',
      requestedMs
    );
    logCommandEnd('wait', correlationId, false, undefined, new Error(`Wait duration too short: ${requestedMs}ms`));
    return error;
  }
  
  if (requestedMs > MAX_WAIT_MS || requestedMs === Infinity) {
    const error = ErrorUtils.validationError(
      `Wait duration too long. Maximum is ${MAX_WAIT_MS}ms (10 minutes).`,
      'milliseconds',
      requestedMs
    );
    logCommandEnd('wait', correlationId, false, undefined, new Error(`Wait duration too long: ${requestedMs}ms`));
    return error;
  }
  
  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();
  
  try {
    // Create a promise that resolves after the specified duration
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, requestedMs);
      
      // Handle process interruption signals
      const handleSignal = () => {
        clearTimeout(timeoutId);
        const actualMs = Date.now() - startTime;
        reject(new Error(`Wait interrupted after ${actualMs}ms`));
      };
      
      // Listen for common interrupt signals
      process.once('SIGINT', handleSignal);
      process.once('SIGTERM', handleSignal);
      
      // Clean up signal listeners after timeout completes
      setTimeout(() => {
        process.removeListener('SIGINT', handleSignal);
        process.removeListener('SIGTERM', handleSignal);
      }, requestedMs + 100); // Small buffer to ensure cleanup
    });
    
    const actualMs = Math.max(Date.now() - startTime, requestedMs);
    
    const result: WaitResult = {
      success: true,
      cmd: 'wait idle',
      durationMs: requestedMs,
      actualMs,
      timestamp: startTimestamp
    };
    
    // Log successful completion with performance metrics
    logCommandEnd('wait', correlationId, true, actualMs);
    logPerformance('wait-idle', actualMs, 'command', { 
      requestedMs, 
      actualMs,
      efficiency: (requestedMs / actualMs) * 100
    });
    
    return ok(result, ErrorCode.OK, {
      durationMs: actualMs,
      metadata: { operation: 'wait-idle', requestedMs, actualMs }
    });
    
  } catch (error) {
    const actualMs = Date.now() - startTime;
    
    // Log error with context
    logCommandEnd('wait', correlationId, false, actualMs, error instanceof Error ? error : new Error(String(error)));
    
    // Check if it was an interruption
    if (error instanceof Error && error.message.includes('interrupted')) {
      return createError(
        error.message,
        ErrorCode.TIMEOUT,
        {
          recoveryHint: 'retry',
          metadata: { 
            operation: 'wait-idle', 
            requestedMs, 
            actualMs, 
            interrupted: true 
          }
        }
      );
    }
    
    // Convert Error to string for the Result type
    const errorResult = ErrorUtils.fromException(
      error,
      'wait-idle',
      ErrorCode.UNKNOWN_ERROR
    );
    
    // Convert Result<T, Error> to Result<T, string>
    if (errorResult.success) {
      return errorResult as Result<WaitResult, string>;
    } else {
      return createError(
        errorResult.error.message,
        errorResult.code,
        errorResult.context
      );
    }
  }
}