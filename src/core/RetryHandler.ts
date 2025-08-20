/**
 * Enhanced retry handler with exponential backoff and contextual error recovery
 * 
 * Provides intelligent retry logic for transient failures with:
 * - Exponential backoff with jitter
 * - Context-aware retry strategies  
 * - Stack trace preservation
 * - Metadata tracking across retries
 */

import { Result, ok, error, isOk, withContext, type ResultContext, type RecoveryStrategy } from './Result.js';
import { ErrorCode, isRetryableError, requiresUserAction } from './ErrorCodes.js';
import { sleep } from '../lib/util.js';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay between retries */
  maxDelayMs?: number;
  /** Backoff multiplier (exponential backoff) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd */
  jitter?: boolean;
  /** Custom retry condition function */
  retryCondition?: (error: ErrorCode, attempt: number) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (errorCode: ErrorCode) => isRetryableError(errorCode),
  onRetry: () => {}
};

/**
 * Retry context tracking
 */
export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: unknown;
  startTime: number;
  delayHistory: number[];
  errorHistory: ErrorCode[];
}

/**
 * Execute an operation with intelligent retry logic
 */
export async function withRetry<T, E>(
  operation: () => Promise<Result<T, E>>,
  options: RetryOptions = {},
  context?: string
): Promise<Result<T, E>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();
  const retryContext: RetryContext = {
    attempt: 0,
    totalAttempts: opts.maxAttempts,
    startTime,
    delayHistory: [],
    errorHistory: []
  };

  let lastResult: Result<T, E> | null = null;
  let stackTrace: string | undefined;

  // Capture initial stack trace for debugging
  if (process.env.NODE_ENV === 'development') {
    stackTrace = new Error().stack;
  }

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    retryContext.attempt = attempt;
    
    try {
      const result = await operation();
      
      if (isOk(result)) {
        // Success! Add retry context if there were previous attempts
        if (attempt > 1) {
          return withContext(result, {
            ...result.context,
            metadata: {
              ...result.context?.metadata,
              retryAttempts: attempt - 1,
              totalDurationMs: Date.now() - startTime,
              retryDelayHistory: retryContext.delayHistory,
              recoveryStrategy: 'retry_successful'
            }
          }) as Result<T, E>;
        }
        return result;
      }
      
      // Operation failed, check if we should retry
      lastResult = result;
      retryContext.lastError = result.error;
      retryContext.errorHistory.push(result.code);
      
      // Check if error is retryable
      const shouldRetry = opts.retryCondition(result.code, attempt) && 
                         attempt < opts.maxAttempts &&
                         !requiresUserAction(result.code);
      
      if (!shouldRetry) {
        // Not retryable or max attempts reached
        // Preserve original recovery hint if it was explicitly set, otherwise use default logic
        const originalRecoveryHint = result.context?.recoveryHint;
        const defaultRecoveryHint = attempt >= opts.maxAttempts ? 'not_recoverable' : 'user_action';
        
        const finalContext: ResultContext = {
          ...result.context,
          recoveryHint: originalRecoveryHint || defaultRecoveryHint,
          metadata: {
            ...result.context?.metadata,
            retryAttempts: attempt - 1,
            totalDurationMs: Date.now() - startTime,
            retryDelayHistory: retryContext.delayHistory,
            errorHistory: retryContext.errorHistory,
            finalAttempt: true,
            ...(stackTrace && { originalStackTrace: stackTrace }),
            ...(context && { operationContext: context })
          },
          ...(stackTrace && { stackTrace })
        };
        
        return withContext(result, finalContext) as Result<T, E>;
      }
      
      // Calculate delay for next attempt
      const delayMs = calculateDelay(attempt - 1, opts);
      retryContext.delayHistory.push(delayMs);
      
      // Call retry callback
      opts.onRetry(result.error, attempt, delayMs);
      
      // Wait before next attempt
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      
    } catch (unexpectedError) {
      // Unexpected error during retry attempt
      const errorResult = error(
        unexpectedError instanceof Error ? unexpectedError : new Error(String(unexpectedError)),
        ErrorCode.UNKNOWN_ERROR,
        {
          recoveryHint: 'not_recoverable',
          metadata: {
            retryAttempts: attempt - 1,
            totalDurationMs: Date.now() - startTime,
            unexpectedError: true,
            ...(stackTrace && { originalStackTrace: stackTrace }),
            ...(context && { operationContext: context })
          },
          ...(stackTrace && { stackTrace })
        }
      );
      
      return errorResult as Result<T, E>;
    }
  }
  
  // This should never be reached, but handle it gracefully
  return lastResult || error(
    'Unknown retry error' as E,
    ErrorCode.UNKNOWN_ERROR,
    {
      recoveryHint: 'not_recoverable',
      metadata: {
        retryAttempts: opts.maxAttempts,
        totalDurationMs: Date.now() - startTime,
        unexpectedEnd: true,
        ...(context && { operationContext: context })
      }
    }
  );
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  
  if (!options.jitter) {
    return cappedDelay;
  }
  
  // Add jitter: random value between 0.5 and 1.5 times the delay
  const jitterFactor = 0.5 + Math.random();
  return Math.round(cappedDelay * jitterFactor);
}

/**
 * Retry an operation with specific retry strategy based on error type
 */
export async function retryWithStrategy<T, E>(
  operation: () => Promise<Result<T, E>>,
  strategy: RecoveryStrategy,
  context?: string
): Promise<Result<T, E>> {
  const options: RetryOptions = {
    onRetry: (error, attempt, delayMs) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Retry attempt ${attempt}, waiting ${delayMs}ms. Error: ${error}`);
      }
    }
  };
  
  switch (strategy) {
    case 'retry':
      options.maxAttempts = 2;
      options.initialDelayMs = 500;
      break;
      
    case 'retry_with_delay':
      options.maxAttempts = 3;
      options.initialDelayMs = 2000;
      options.maxDelayMs = 10000;
      break;
      
    case 'user_action':
    case 'permission':
    case 'not_recoverable':
      // Don't retry for these strategies
      options.maxAttempts = 1;
      break;
      
    case 'check_target':
      options.maxAttempts = 3;
      options.initialDelayMs = 1000;
      options.retryCondition = (errorCode) => {
        return errorCode === ErrorCode.TARGET_NOT_FOUND ||
               errorCode === ErrorCode.ELEMENT_NOT_VISIBLE ||
               errorCode === ErrorCode.ELEMENT_STALE;
      };
      break;
  }
  
  return withRetry(operation, options, context);
}

/**
 * Wrapper for synchronous operations that may benefit from retry
 */
export async function retrySyncOperation<T>(
  operation: () => T,
  errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  options: RetryOptions = {},
  context?: string
): Promise<Result<T, Error>> {
  const asyncOperation = async (): Promise<Result<T, Error>> => {
    try {
      const result = operation();
      return ok(result);
    } catch (err) {
      const errorValue = err instanceof Error ? err : new Error(String(err));
      return error(errorValue, errorCode);
    }
  };
  
  return withRetry(asyncOperation, options, context);
}

/**
 * Create a retry-aware version of an async function
 */
export function withRetrySupport<Args extends any[], T, E>(
  fn: (...args: Args) => Promise<Result<T, E>>,
  defaultOptions: RetryOptions = {},
  context?: string
) {
  return async (...args: Args): Promise<Result<T, E>> => {
    return withRetry(() => fn(...args), defaultOptions, context);
  };
}

/**
 * Check if an error should trigger a specific recovery strategy
 */
export function getRecoveryStrategy(errorCode: ErrorCode): RecoveryStrategy {
  
  if (requiresUserAction(errorCode)) {
    return 'user_action';
  }
  
  if (errorCode >= ErrorCode.PERMISSION_DENIED && errorCode <= ErrorCode.SECURITY_RESTRICTION) {
    return 'permission';
  }
  
  if (errorCode >= ErrorCode.TARGET_NOT_FOUND && errorCode <= ErrorCode.ELEMENT_STALE) {
    return 'check_target';
  }
  
  if (isRetryableError(errorCode)) {
    return 'retry_with_delay';
  }
  
  return 'not_recoverable';
}
