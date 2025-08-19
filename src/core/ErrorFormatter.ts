/**
 * Error formatting utilities for consistent display across mac-chrome-cli
 * 
 * Provides standardized error formatting, recovery suggestions, and user-friendly
 * error messages for the unified Result<T,E> system.
 */

import { Result, isOk, isError } from './Result.js';
import { 
  ErrorCode, 
  getErrorCategory, 
  isRetryableError, 
  requiresUserAction,
  type ErrorCategory
} from './ErrorCodes.js';

/**
 * Error display options
 */
export interface ErrorDisplayOptions {
  /** Show detailed error context */
  detailed?: boolean;
  /** Include recovery suggestions */
  includeRecovery?: boolean;
  /** Include timestamp in output */
  includeTimestamp?: boolean;
  /** Include context information */
  includeContext?: boolean;
  /** Use colors in terminal output */
  colors?: boolean;
  /** Format as JSON */
  json?: boolean;
}

/**
 * Formatted error information
 */
export interface FormattedError {
  message: string;
  code: string;
  timestamp?: string;
  recovery?: string;
  details?: string;
  context?: Record<string, unknown>;
  retryable: boolean;
  userAction: boolean;
}


/**
 * Format Result error for display
 */
export function formatResultError(
  result: Result<unknown, unknown>,
  options: ErrorDisplayOptions = {}
): string {
  if (isOk(result)) {
    return ''; // No error to format
  }

  
  let message = String(result.error);
  
  if (options.colors) {
    message = `\x1b[31m${message}\x1b[0m`; // Red text
  }
  
  let output = message;
  
  if (options.includeRecovery && result.context?.recoveryHint) {
    output += `\nRecovery: ${result.context.recoveryHint}`;
  }
  
  if (options.includeTimestamp && result.timestamp) {
    output += `\nTime: ${result.timestamp}`;
  }
  
  if (options.includeContext && result.context?.metadata) {
    output += `\nContext: ${JSON.stringify(result.context.metadata)}`;
  }
  
  return output;
}

/**
 * Format error as JSON
 */
export function formatErrorJSON(
  result: Result<unknown, unknown>,
  _options: ErrorDisplayOptions = {}
): Record<string, unknown> {
  if (isOk(result)) {
    return { success: true, data: result.data };
  }

  const category = getErrorCategory(result.code);
  const retryable = isRetryableError(result.code);
  const userAction = requiresUserAction(result.code);

  const formatted: Record<string, unknown> = {
    success: false,
    error: String(result.error),
    code: result.code,
    timestamp: result.timestamp,
    category,
    retryable,
    userAction
  };

  if (result.context?.recoveryHint) {
    formatted.recoveryHint = result.context.recoveryHint;
  }

  if (result.context?.metadata) {
    formatted.context = result.context.metadata;
  }

  if (result.context?.durationMs) {
    formatted.durationMs = result.context.durationMs;
  }

  return formatted;
}

/**
 * Format error as plain text
 */
export function formatErrorText(
  result: Result<unknown, unknown>,
  options: ErrorDisplayOptions = {}
): string {
  if (isOk(result)) {
    return '';
  }

  let output = String(result.error);
  
  if (options.colors) {
    output = `\x1b[31mError:\x1b[0m ${output}`;
  } else {
    output = `Error: ${output}`;
  }
  
  if (result.context?.recoveryHint) {
    output += `\n\x1b[33mSuggestion:\x1b[0m ${result.context.recoveryHint}`;
  }
  
  return output;
}

/**
 * Get error category string
 */
export function getErrorCategoryString(code: ErrorCode): ErrorCategory {
  return getErrorCategory(code);
}

/**
 * Create user-friendly error message
 */
export function createUserFriendlyMessage(
  code: ErrorCode,
  error: string
): string {
  const category = getErrorCategory(code);
  
  switch (category) {
    case 'permission':
      return `Permission denied: ${error}. Check your system settings.`;
    case 'browser':
      return `Chrome error: ${error}. Make sure Chrome is running.`;
    case 'input':
      return `Invalid input: ${error}. Please check your parameters.`;
    case 'network':
      return `Network error: ${error}. Check your connection.`;
    default:
      return error;
  }
}

/**
 * Simple error display for CLI
 */
export function displayError(
  result: Result<unknown, unknown>, 
  _options: ErrorDisplayOptions = {}
): void {
  if (isError(result)) {
    console.error(formatErrorText(result, { colors: true }));
  }
}

/**
 * Format exception for display
 */
export function formatException(
  exception: unknown,
  _context?: string
): string {
  if (exception instanceof Error) {
    return exception.message;
  }
  return String(exception);
}