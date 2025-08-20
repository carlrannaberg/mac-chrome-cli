/**
 * Unified Result<T,E> type for consistent error handling across the mac-chrome-cli codebase
 * 
 * This replaces 15+ inconsistent result interfaces with a unified pattern that provides:
 * - Type-safe success/error handling
 * - Functional programming support (map, flatMap, etc.)
 * - Error context tracking
 * - Recovery strategy hints
 */

import type { ErrorCode } from './ErrorCodes.js';

/**
 * Generic Result type representing either success with data T or failure with error E
 */
export type Result<T, E = Error> = 
  | { success: true; data: T; error?: never; code: ErrorCode; timestamp: string; context?: ResultContext }
  | { success: false; data?: never; error: E; code: ErrorCode; timestamp: string; context?: ResultContext };

/**
 * Additional context information for results
 */
export interface ResultContext {
  /** Recovery strategy hint for failed operations */
  recoveryHint?: RecoveryStrategy;
  /** Metadata about the operation */
  metadata?: Record<string, unknown>;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Stack trace for debugging (only in development) */
  stackTrace?: string;
}

/**
 * Recovery strategy hints for failed operations
 */
export type RecoveryStrategy = 
  | 'retry'           // Operation can be safely retried
  | 'retry_with_delay' // Retry after a delay
  | 'user_action'     // Requires user intervention
  | 'permission'      // Permission needs to be granted
  | 'not_recoverable' // Operation cannot be recovered
  | 'check_target';   // Target element/page needs to be verified

/**
 * Create a successful result
 */
export function ok<T>(data: T, code: ErrorCode = 0, context?: ResultContext): Result<T, never> {
  return {
    success: true,
    data,
    code,
    timestamp: new Date().toISOString(),
    ...(context !== undefined && { context })
  };
}

/**
 * Create an error result
 */
export function error<E>(
  error: E, 
  code: ErrorCode, 
  context?: ResultContext
): Result<never, E> {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
    ...(context !== undefined && { context })
  };
}

/**
 * Type guard to check if result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T; error?: never; code: ErrorCode; timestamp: string; context?: ResultContext } {
  return result.success;
}

/**
 * Type guard to check if result is an error
 */
export function isError<T, E>(result: Result<T, E>): result is { success: false; data?: never; error: E; code: ErrorCode; timestamp: string; context?: ResultContext } {
  return !result.success;
}

/**
 * Map the data of a successful result, or pass through error
 */
export function map<T, U, E>(
  result: Result<T, E>,
  mapper: (data: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(mapper(result.data), result.code, result.context);
  }
  const errorResult: Result<U, E> = {
    success: false,
    error: result.error,
    code: result.code,
    timestamp: result.timestamp
  };
  if (result.context !== undefined) {
    errorResult.context = result.context;
  }
  return errorResult;
}

/**
 * FlatMap for chaining Result operations (prevents Result<Result<T>>)
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  mapper: (data: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return mapper(result.data);
  }
  const errorResult: Result<U, E> = {
    success: false,
    error: result.error,
    code: result.code,
    timestamp: result.timestamp
  };
  if (result.context !== undefined) {
    errorResult.context = result.context;
  }
  return errorResult;
}

/**
 * Map the error of a failed result, or pass through success
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  mapper: (error: E) => F
): Result<T, F> {
  if (isError(result)) {
    return error(mapper(result.error), result.code, result.context);
  }
  const successResult: Result<T, F> = {
    success: true,
    data: result.data,
    code: result.code,
    timestamp: result.timestamp
  };
  if (result.context !== undefined) {
    successResult.context = result.context;
  }
  return successResult;
}

/**
 * Unwrap result data or throw error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(String(result.error));
}

/**
 * Unwrap result data or return default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Unwrap result data or compute default value from error
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  defaultFn: (error: E) => T
): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultFn(result.error);
}

/**
 * Convert Result to Promise (for compatibility with async/await)
 */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  if (isOk(result)) {
    return Promise.resolve(result.data);
  }
  const errorValue = result.error instanceof Error ? result.error : new Error(String(result.error));
  return Promise.reject(errorValue);
}

/**
 * Convert Promise to Result (catch errors as Result)
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  code: ErrorCode = 99 // UNKNOWN_ERROR
): Promise<Result<T, Error>> {
  try {
    const data = await promise;
    return ok(data);
  } catch (err) {
    const errorValue = err instanceof Error ? err : new Error(String(err));
    return error(errorValue, code);
  }
}

/**
 * Combine multiple Results into one (all must succeed)
 */
export function combine<T extends readonly unknown[], E>(
  results: { [K in keyof T]: Result<T[K], E> }
): Result<T, E> {
  const data: unknown[] = [];
  
  for (const result of results) {
    if (isError(result)) {
      return result as Result<T, E>;
    }
    data.push(result.data);
  }
  
  return ok(data as unknown as T);
}

/**
 * Execute operation with automatic Result wrapping
 */
export async function tryAsync<T>(
  operation: () => Promise<T>,
  code: ErrorCode = 99 // UNKNOWN_ERROR
): Promise<Result<T, Error>> {
  try {
    const data = await operation();
    return ok(data);
  } catch (err) {
    const errorValue = err instanceof Error ? err : new Error(String(err));
    return error(errorValue, code);
  }
}

/**
 * Execute synchronous operation with automatic Result wrapping
 */
export function trySync<T>(
  operation: () => T,
  code: ErrorCode = 99 // UNKNOWN_ERROR
): Result<T, Error> {
  try {
    const data = operation();
    return ok(data);
  } catch (err) {
    const errorValue = err instanceof Error ? err : new Error(String(err));
    return error(errorValue, code);
  }
}

/**
 * Add context to an existing result
 */
export function withContext<T, E>(
  result: Result<T, E>,
  context: ResultContext
): Result<T, E> {
  return {
    ...result,
    context: { ...result.context, ...context }
  };
}

/**
 * Add recovery hint to a failed result
 */
export function withRecoveryHint<T, E>(
  result: Result<T, E>,
  recoveryHint: RecoveryStrategy
): Result<T, E> {
  if (isError(result)) {
    return withContext(result, { 
      ...result.context,
      recoveryHint 
    }) as Result<T, E>;
  }
  return result;
}