/**
 * Unified Result<T,E> type for consistent error handling across the mac-chrome-cli codebase
 *
 * This replaces 15+ inconsistent result interfaces with a unified pattern that provides:
 * - Type-safe success/error handling
 * - Functional programming support (map, flatMap, etc.)
 * - Error context tracking
 * - Recovery strategy hints
 */
/**
 * Create a successful result
 */
export function ok(data, code = 0, context) {
    return {
        success: true,
        data,
        code,
        timestamp: new Date().toISOString(),
        context
    };
}
/**
 * Create an error result
 */
export function error(error, code, context) {
    return {
        success: false,
        error,
        code,
        timestamp: new Date().toISOString(),
        context
    };
}
/**
 * Type guard to check if result is successful
 */
export function isOk(result) {
    return result.success;
}
/**
 * Type guard to check if result is an error
 */
export function isError(result) {
    return !result.success;
}
/**
 * Map the data of a successful result, or pass through error
 */
export function map(result, mapper) {
    if (isOk(result)) {
        return ok(mapper(result.data), result.code, result.context);
    }
    return result;
}
/**
 * FlatMap for chaining Result operations (prevents Result<Result<T>>)
 */
export function flatMap(result, mapper) {
    if (isOk(result)) {
        return mapper(result.data);
    }
    return result;
}
/**
 * Map the error of a failed result, or pass through success
 */
export function mapError(result, mapper) {
    if (isError(result)) {
        return error(mapper(result.error), result.code, result.context);
    }
    return result;
}
/**
 * Unwrap result data or throw error
 */
export function unwrap(result) {
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
export function unwrapOr(result, defaultValue) {
    if (isOk(result)) {
        return result.data;
    }
    return defaultValue;
}
/**
 * Unwrap result data or compute default value from error
 */
export function unwrapOrElse(result, defaultFn) {
    if (isOk(result)) {
        return result.data;
    }
    return defaultFn(result.error);
}
/**
 * Convert Result to Promise (for compatibility with async/await)
 */
export function toPromise(result) {
    if (isOk(result)) {
        return Promise.resolve(result.data);
    }
    const errorValue = result.error instanceof Error ? result.error : new Error(String(result.error));
    return Promise.reject(errorValue);
}
/**
 * Convert Promise to Result (catch errors as Result)
 */
export async function fromPromise(promise, code = 99 // UNKNOWN_ERROR
) {
    try {
        const data = await promise;
        return ok(data);
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return error(error, code);
    }
}
/**
 * Combine multiple Results into one (all must succeed)
 */
export function combine(results) {
    const data = [];
    for (const result of results) {
        if (isError(result)) {
            return result;
        }
        data.push(result.data);
    }
    return ok(data);
}
/**
 * Execute operation with automatic Result wrapping
 */
export async function tryAsync(operation, code = 99 // UNKNOWN_ERROR
) {
    try {
        const data = await operation();
        return ok(data);
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return error(error, code);
    }
}
/**
 * Execute synchronous operation with automatic Result wrapping
 */
export function trySync(operation, code = 99 // UNKNOWN_ERROR
) {
    try {
        const data = operation();
        return ok(data);
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return error(error, code);
    }
}
/**
 * Add context to an existing result
 */
export function withContext(result, context) {
    return {
        ...result,
        context: { ...result.context, ...context }
    };
}
/**
 * Add recovery hint to a failed result
 */
export function withRecoveryHint(result, recoveryHint) {
    if (isError(result)) {
        return withContext(result, {
            ...result.context,
            recoveryHint
        });
    }
    return result;
}
