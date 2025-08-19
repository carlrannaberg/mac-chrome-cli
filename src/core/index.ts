/**
 * Core utilities for mac-chrome-cli
 * 
 * This module exports the unified Result<T,E> system and comprehensive error handling
 * that replaces 15+ inconsistent result interfaces across the codebase.
 * 
 * Enhanced with Task 30 improvements:
 * - Intelligent retry handler with exponential backoff
 * - Error utilities for eliminating code duplication
 * - Context-aware error tracking and recovery
 */

export * from './Result.js';
export * from './ErrorCodes.js';
export { 
  formatResultError, 
  formatErrorJSON, 
  formatErrorText, 
  getErrorCategoryString,
  createUserFriendlyMessage,
  displayError,
  formatException,
  type ErrorDisplayOptions,
  type FormattedError
} from './ErrorFormatter.js';
export * from './RetryHandler.js';
export * from './ErrorUtils.js';
export * from './CommandBase.js';