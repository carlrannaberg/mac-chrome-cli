/**
 * Compatibility layer for transitioning from legacy result interfaces to unified Result<T,E>
 * 
 * This module provides adapter functions to maintain backward compatibility during the migration
 * to the unified Result<T,E> system. These functions should be gradually phased out as the
 * codebase is fully updated.
 */

import { Result, ok, error, isOk } from './Result.js';
import { ErrorCode, ERROR_CODES } from './ErrorCodes.js';

/**
 * Convert Result<T,E> to legacy format for backward compatibility
 */
export function toLegacyResult<T>(result: Result<T, string>): {
  success: boolean;
  data?: T;
  error?: string;
  code: ErrorCode;
  timestamp: string;
} {
  if (isOk(result)) {
    return {
      success: true,
      data: result.data,
      code: result.code,
      timestamp: result.timestamp
    };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code,
      timestamp: result.timestamp
    };
  }
}

/**
 * Convert legacy format to Result<T,E>
 */
export function fromLegacyResult<T>(legacy: {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
}): Result<T, string> {
  if (legacy.success && legacy.data !== undefined) {
    return ok(legacy.data, legacy.code || ErrorCode.OK);
  } else {
    return error(legacy.error || 'Unknown error', legacy.code || ErrorCode.UNKNOWN_ERROR);
  }
}

/**
 * Legacy ExecResult adapter
 */
export function toLegacyExecResult(result: Result<{ stdout: string; stderr: string; command?: string }, string>): {
  success: boolean;
  stdout: string;
  stderr: string;
  code: ErrorCode;
  command?: string;
} {
  if (isOk(result)) {
    return {
      success: true,
      stdout: result.data.stdout,
      stderr: result.data.stderr,
      code: result.code,
      command: result.data.command
    };
  } else {
    return {
      success: false,
      stdout: '',
      stderr: result.error,
      code: result.code,
      command: undefined
    };
  }
}

/**
 * Legacy JavaScriptResult adapter
 */
export function toLegacyJavaScriptResult<T>(result: Result<T, string>): {
  success: boolean;
  result?: T;
  error?: string;
  code: ErrorCode;
} {
  if (isOk(result)) {
    return {
      success: true,
      result: result.data,
      code: result.code
    };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Legacy AppleScriptResult adapter - maintains the 'result' property name
 */
export function toLegacyAppleScriptResult<T>(result: Result<T, string>): {
  success: boolean;
  result?: T;
  error?: string;
  code: ErrorCode;
} {
  return toLegacyJavaScriptResult(result);
}

/**
 * Legacy FileUploadResult adapter
 */
export function toLegacyFileUploadResult(result: Result<{ filesUploaded: string[]; totalFiles: number }, string>): {
  success: boolean;
  filesUploaded: string[];
  totalFiles: number;
  error?: string;
  code: ErrorCode;
} {
  if (isOk(result)) {
    return {
      success: true,
      filesUploaded: result.data.filesUploaded,
      totalFiles: result.data.totalFiles,
      code: result.code
    };
  } else {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: 0,
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Legacy UIResult adapter
 */
export function toLegacyUIResult(result: Result<{ action: string; coordinates?: { x: number; y: number } }, string>): {
  success: boolean;
  action: string;
  coordinates?: { x: number; y: number };
  error?: string;
  code: ErrorCode;
} {
  if (isOk(result)) {
    return {
      success: true,
      action: result.data.action,
      coordinates: result.data.coordinates,
      code: result.code
    };
  } else {
    return {
      success: false,
      action: 'failed',
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Create a Result from legacy error-first callback pattern
 */
export function fromErrorFirst<T>(err: Error | null | undefined, data: T, code?: ErrorCode): Result<T, string> {
  if (err) {
    return error(err.message, code || ErrorCode.UNKNOWN_ERROR);
  }
  return ok(data, code || ErrorCode.OK);
}

/**
 * Temporary adapter for formatJSONResult backward compatibility
 */
export function adaptFormatJSONResult<T>(
  data?: T,
  errorMessage?: string,
  code: ErrorCode = ERROR_CODES.OK
): {
  success: boolean;
  data?: T;
  error?: string;
  code: ErrorCode;
  timestamp: string;
} {
  return {
    success: code === ERROR_CODES.OK,
    code,
    timestamp: new Date().toISOString(),
    ...(code === ERROR_CODES.OK && data !== undefined && { data }),
    ...(code !== ERROR_CODES.OK && errorMessage && { error: errorMessage })
  };
}