/**
 * Error formatting utilities for consistent display across mac-chrome-cli
 * 
 * Provides standardized error formatting, recovery suggestions, and user-friendly
 * error messages for the unified Result<T,E> system.
 */

import { Result, isOk, isError, type ResultContext } from './Result.js';
import { 
  ErrorCode, 
  getErrorInfo, 
  getErrorCategory, 
  isRetryableError, 
  requiresUserAction,
  formatErrorMessage,
  type ErrorInfo 
} from './ErrorCodes.js';

/**
 * Error display options
 */
export interface ErrorDisplayOptions {
  /** Include detailed error information */
  detailed?: boolean;
  /** Include recovery suggestions */
  includeRecovery?: boolean;
  /** Include timestamp in output */
  includeTimestamp?: boolean;
  /** Include context metadata */
  includeContext?: boolean;
  /** Use colored output (if supported) */
  useColors?: boolean;
  /** Maximum width for text wrapping */
  maxWidth?: number;
}

/**
 * Formatted error information
 */
export interface FormattedError {
  /** Main error message */
  message: string;
  /** Error code and category */
  code: string;
  /** Recovery suggestion */
  recovery?: string;
  /** Additional details */
  details?: string;
  /** Timestamp */
  timestamp?: string;
  /** Context information */
  context?: string;
  /** Whether error is retryable */
  retryable: boolean;
  /** Whether user action is required */
  userAction: boolean;
}

/**
 * Format a Result error for display
 */
export function formatResultError<T, E>(
  result: Result<T, E>,
  options: ErrorDisplayOptions = {}
): FormattedError | null {
  if (isOk(result)) {
    return null; // No error to format
  }

  const errorCode = result.code;
  const errorInfo = getErrorInfo(errorCode);
  
  const formatted: FormattedError = {
    message: formatErrorMessage(errorCode, typeof result.error === 'string' ? result.error : String(result.error)),
    code: `${errorCode} (${errorInfo.category.toUpperCase()})`,
    retryable: errorInfo.retryable,
    userAction: errorInfo.userAction
  };

  if (options.includeRecovery && errorInfo.recoveryHint) {
    formatted.recovery = errorInfo.recoveryHint;
  }

  if (options.includeTimestamp && result.timestamp) {
    formatted.timestamp = result.timestamp;
  }

  if (options.detailed && errorInfo.description !== errorInfo.message) {
    formatted.details = errorInfo.description;
  }

  if (options.includeContext && result.context) {
    const contextParts = [];
    
    if (result.context.durationMs !== undefined) {
      contextParts.push(`Duration: ${result.context.durationMs}ms`);
    }
    
    if (result.context.recoveryHint) {
      contextParts.push(`Recovery: ${result.context.recoveryHint}`);
    }
    
    if (result.context.metadata) {
      const metadata = Object.entries(result.context.metadata)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .slice(0, 3); // Limit metadata display
      contextParts.push(...metadata);
    }
    
    if (contextParts.length > 0) {
      formatted.context = contextParts.join(', ');
    }
  }

  return formatted;
}

/**
 * Format error as human-readable text
 */
export function formatErrorText<T, E>(
  result: Result<T, E>,
  options: ErrorDisplayOptions = {}
): string {
  const formatted = formatResultError(result, options);
  if (!formatted) {
    return '';
  }

  const parts: string[] = [];
  
  // Main error message
  parts.push(`Error: ${formatted.message}`);
  
  // Error code
  if (options.detailed) {
    parts.push(`Code: ${formatted.code}`);
  }
  
  // Recovery suggestion
  if (formatted.recovery) {
    parts.push(`Recovery: ${formatted.recovery}`);
  }
  
  // Additional details
  if (formatted.details) {
    parts.push(`Details: ${formatted.details}`);
  }
  
  // Context information
  if (formatted.context) {
    parts.push(`Context: ${formatted.context}`);
  }
  
  // Timestamp
  if (formatted.timestamp) {
    parts.push(`Time: ${formatted.timestamp}`);
  }

  return parts.join(options.useColors ? '\n' : ' | ');
}

/**
 * Format error as JSON for API responses
 */
export function formatErrorJSON<T, E>(
  result: Result<T, E>,
  options: ErrorDisplayOptions = {}
): object {
  const formatted = formatResultError(result, options);
  if (!formatted) {
    return { success: true };
  }

  return {
    success: false,
    error: {
      message: formatted.message,
      code: result.code,
      category: getErrorCategory(result.code),
      retryable: formatted.retryable,
      userAction: formatted.userAction,
      ...(formatted.recovery && { recovery: formatted.recovery }),
      ...(formatted.details && { details: formatted.details }),
      ...(formatted.context && { context: formatted.context }),
      ...(result.timestamp && { timestamp: result.timestamp })
    }
  };
}

/**
 * Create user-friendly error message with actionable suggestions
 */
export function createUserFriendlyError(
  errorCode: ErrorCode,
  context?: string,
  suggestions?: string[]
): string {
  const errorInfo = getErrorInfo(errorCode);
  const parts: string[] = [];
  
  // Start with friendly message
  parts.push(`❌ ${errorInfo.message}`);
  
  if (context) {
    parts.push(`\nContext: ${context}`);
  }
  
  // Add description if different from message
  if (errorInfo.description !== errorInfo.message) {
    parts.push(`\n${errorInfo.description}`);
  }
  
  // Add recovery hint
  if (errorInfo.recoveryHint) {
    parts.push(`\n💡 Suggestion: ${errorInfo.recoveryHint}`);
  }
  
  // Add custom suggestions
  if (suggestions && suggestions.length > 0) {
    parts.push('\nNext steps:');
    suggestions.forEach((suggestion, index) => {
      parts.push(`  ${index + 1}. ${suggestion}`);
    });
  }
  
  // Add retry hint if applicable
  if (errorInfo.retryable) {
    parts.push('\n🔄 This operation can be retried.');
  }
  
  return parts.join('');
}

/**
 * Get recovery suggestions for an error code with enhanced context
 */
export function getRecoverySuggestions(errorCode: ErrorCode, context?: Record<string, unknown>): string[] {
  const suggestions: string[] = [];
  const errorInfo = getErrorInfo(errorCode);
  
  // Add general recovery hint
  if (errorInfo.recoveryHint) {
    suggestions.push(errorInfo.recoveryHint);
  }
  
  // Add specific suggestions based on error category
  switch (getErrorCategory(errorCode)) {
    case 'permission':
      suggestions.push('Check System Preferences > Privacy & Security');
      suggestions.push('Grant necessary permissions to Terminal or your application');
      if (errorCode === ErrorCode.ACCESSIBILITY_DENIED) {
        suggestions.push('Enable Accessibility for Terminal in System Preferences');
        suggestions.push('Restart Terminal after granting permissions');
      }
      if (errorCode === ErrorCode.SCREEN_RECORDING_DENIED) {
        suggestions.push('Enable Screen Recording for Terminal in System Preferences');
        suggestions.push('Run "tccutil reset ScreenCapture" to reset permissions if needed');
      }
      break;
      
    case 'browser':
      suggestions.push('Ensure Google Chrome is installed and running');
      suggestions.push('Try refreshing the page or restarting Chrome');
      if (errorCode === ErrorCode.CHROME_NOT_FOUND) {
        suggestions.push('Install Google Chrome from https://www.google.com/chrome/');
        suggestions.push('Verify Chrome is in /Applications/ directory');
      }
      if (errorCode === ErrorCode.TAB_NOT_FOUND) {
        suggestions.push('Check if the tab exists or create a new tab');
        suggestions.push('Try using tab focus commands first');
      }
      break;
      
    case 'target':
      suggestions.push('Verify the element exists on the page');
      suggestions.push('Check if the selector is correct');
      suggestions.push('Wait for the page to fully load');
      if (context?.selector) {
        suggestions.push(`Try inspecting the page to verify selector: ${context.selector}`);
      }
      if (errorCode === ErrorCode.ELEMENT_NOT_VISIBLE) {
        suggestions.push('Scroll to bring the element into view');
        suggestions.push('Check if element is hidden by CSS or JavaScript');
      }
      if (errorCode === ErrorCode.MULTIPLE_TARGETS_FOUND) {
        suggestions.push('Use a more specific selector (add ID or unique class)');
        suggestions.push('Consider using nth-child or nth-of-type selectors');
      }
      break;
      
    case 'network':
      suggestions.push('Check your internet connection');
      suggestions.push('Verify the URL is accessible');
      suggestions.push('Check for proxy or firewall issues');
      if (errorCode === ErrorCode.SSL_ERROR) {
        suggestions.push('Verify SSL certificate is valid');
        suggestions.push('Try accessing the site in a regular browser first');
      }
      break;
      
    case 'timeout':
      suggestions.push('Increase the timeout value');
      suggestions.push('Check for performance issues');
      if (context?.timeoutMs) {
        const timeout = context.timeoutMs as number;
        suggestions.push(`Consider increasing timeout from ${timeout}ms to ${timeout * 2}ms`);
      }
      if (errorCode === ErrorCode.LOAD_TIMEOUT) {
        suggestions.push('Check network speed and page complexity');
        suggestions.push('Try disabling browser extensions that might slow loading');
      }
      break;
      
    case 'filesystem':
      suggestions.push('Check file path and permissions');
      suggestions.push('Ensure sufficient disk space');
      if (context?.filePath) {
        suggestions.push(`Verify file exists: ${context.filePath}`);
        suggestions.push(`Check read/write permissions for: ${context.filePath}`);
      }
      if (errorCode === ErrorCode.DISK_FULL) {
        suggestions.push('Free up disk space before retrying');
        suggestions.push('Check available space with "df -h" command');
      }
      break;
      
    case 'input':
      suggestions.push('Verify input parameters are correct');
      suggestions.push('Check parameter format and types');
      if (context?.validationField) {
        suggestions.push(`Fix the '${context.validationField}' parameter`);
      }
      if (context?.providedValue !== undefined) {
        suggestions.push(`Provided value: ${String(context.providedValue)}`);
      }
      break;
      
    case 'system':
      suggestions.push('Check system resources and status');
      suggestions.push('Try restarting the application');
      if (errorCode === ErrorCode.MEMORY_ERROR) {
        suggestions.push('Close other applications to free memory');
        suggestions.push('Check memory usage with Activity Monitor');
      }
      break;
      
    case 'automation':
      suggestions.push('Check AppleScript permissions and syntax');
      suggestions.push('Verify accessibility settings are enabled');
      if (errorCode === ErrorCode.APPLESCRIPT_COMPILATION_FAILED) {
        suggestions.push('Review AppleScript syntax for errors');
        suggestions.push('Test the script manually in Script Editor');
      }
      break;
  }
  
  return suggestions;
}

/**
 * Get detailed troubleshooting guide for an error
 */
export function getTroubleshootingGuide(errorCode: ErrorCode, context?: Record<string, unknown>): {
  quickFix: string;
  detailedSteps: string[];
  preventionTips: string[];
  relatedDocs: string[];
} {
  const errorInfo = getErrorInfo(errorCode);
  const category = getErrorCategory(errorCode);
  
  const guide = {
    quickFix: errorInfo.recoveryHint,
    detailedSteps: [] as string[],
    preventionTips: [] as string[],
    relatedDocs: [] as string[]
  };
  
  switch (category) {
    case 'permission':
      guide.detailedSteps = [
        '1. Open System Preferences > Security & Privacy',
        '2. Click the Privacy tab',
        '3. Select the relevant permission type in the sidebar',
        '4. Unlock settings by clicking the lock icon',
        '5. Add Terminal (or your application) to the allowed list',
        '6. Restart Terminal and try again'
      ];
      guide.preventionTips = [
        'Run permission checks before starting automation',
        'Use the "doctor" command to verify system setup',
        'Keep permissions up to date when updating macOS'
      ];
      guide.relatedDocs = [
        'PERMISSIONS.md - Complete permission setup guide',
        'API.md#doctor - System diagnostics command'
      ];
      break;
      
    case 'browser':
      guide.detailedSteps = [
        '1. Verify Google Chrome is installed',
        '2. Launch Chrome manually to ensure it starts',
        '3. Check if Chrome is already running',
        '4. Try creating a new tab or window',
        '5. Restart Chrome if issues persist'
      ];
      guide.preventionTips = [
        'Always start with Chrome running',
        'Keep Chrome updated to latest version',
        'Avoid running multiple Chrome instances'
      ];
      guide.relatedDocs = [
        'API.md#browser-setup - Browser configuration',
        'CLAUDE.md#chrome-automation - Chrome automation tips'
      ];
      break;
      
    case 'target':
      guide.detailedSteps = [
        '1. Take a screenshot to see current page state',
        '2. Use browser dev tools to verify element exists',
        '3. Test the selector manually in browser console',
        '4. Check if element is dynamically loaded',
        '5. Wait for page load before targeting elements'
      ];
      guide.preventionTips = [
        'Use stable selectors (IDs, data-testid)',
        'Wait for page load before element interaction',
        'Use snapshot commands to verify page state'
      ];
      guide.relatedDocs = [
        'API.md#snapshot - Page inspection commands',
        'CLAUDE.md#element-targeting - Selector best practices'
      ];
      break;
  }
  
  return guide;
}

/**
 * Format multiple errors as a summary
 */
export function formatErrorSummary<T, E>(
  results: Result<T, E>[],
  options: ErrorDisplayOptions = {}
): string {
  const errors = results.filter(isError);
  if (errors.length === 0) {
    return 'All operations completed successfully';
  }
  
  const errorCounts = new Map<ErrorCode, number>();
  errors.forEach(error => {
    errorCounts.set(error.code, (errorCounts.get(error.code) || 0) + 1);
  });
  
  const summary: string[] = [];
  summary.push(`${errors.length} error(s) occurred:`);
  
  for (const [code, count] of errorCounts.entries()) {
    const errorInfo = getErrorInfo(code);
    const countStr = count > 1 ? ` (${count}x)` : '';
    summary.push(`  • ${errorInfo.message}${countStr}`);
  }
  
  // Add retry suggestion if any errors are retryable
  const retryableCount = errors.filter(e => isRetryableError(e.code)).length;
  if (retryableCount > 0) {
    summary.push(`\n${retryableCount} error(s) can be retried.`);
  }
  
  // Add user action hint
  const userActionCount = errors.filter(e => requiresUserAction(e.code)).length;
  if (userActionCount > 0) {
    summary.push(`${userActionCount} error(s) require user intervention.`);
  }
  
  return summary.join('\n');
}

/**
 * Create comprehensive error documentation with examples
 */
export function generateErrorDocumentation(errorCode: ErrorCode): {
  title: string;
  description: string;
  examples: Array<{ scenario: string; solution: string; code: string }>;
  commonCauses: string[];
  relatedErrors: ErrorCode[];
} {
  const errorInfo = getErrorInfo(errorCode);
  const category = getErrorCategory(errorCode);
  
  const doc = {
    title: errorInfo.message,
    description: errorInfo.description,
    examples: [] as Array<{ scenario: string; solution: string; code: string }>,
    commonCauses: [] as string[],
    relatedErrors: [] as ErrorCode[]
  };
  
  // Add category-specific examples and causes
  switch (errorCode) {
    case ErrorCode.TARGET_NOT_FOUND:
      doc.examples = [
        {
          scenario: 'Element selector not found on page',
          solution: 'Verify element exists and use correct selector',
          code: 'mac-chrome-cli snapshot outline --visible-only\nmac-chrome-cli mouse click --selector "#correct-id"'
        },
        {
          scenario: 'Dynamic content not yet loaded',
          solution: 'Wait for page load before targeting',
          code: 'mac-chrome-cli wait 2000\nmac-chrome-cli mouse click --selector ".dynamic-button"'
        }
      ];
      doc.commonCauses = [
        'Incorrect CSS selector syntax',
        'Element not yet loaded or rendered',
        'Element is in different frame or shadow DOM',
        'Typo in selector string'
      ];
      doc.relatedErrors = [ErrorCode.ELEMENT_NOT_VISIBLE, ErrorCode.MULTIPLE_TARGETS_FOUND];
      break;
      
    case ErrorCode.PERMISSION_DENIED:
      doc.examples = [
        {
          scenario: 'Accessibility permission not granted',
          solution: 'Enable accessibility permissions',
          code: 'mac-chrome-cli doctor\n# Follow permission setup instructions'
        }
      ];
      doc.commonCauses = [
        'Accessibility permissions not granted',
        'Screen recording permissions missing',
        'Apple Events permissions denied'
      ];
      doc.relatedErrors = [ErrorCode.ACCESSIBILITY_DENIED, ErrorCode.SCREEN_RECORDING_DENIED];
      break;
      
    case ErrorCode.TIMEOUT:
      doc.examples = [
        {
          scenario: 'Page load taking too long',
          solution: 'Increase timeout or check network',
          code: 'mac-chrome-cli nav go --url "https://example.com" --timeout 30000'
        }
      ];
      doc.commonCauses = [
        'Slow network connection',
        'Heavy page with many resources',
        'Server response delays',
        'Insufficient timeout value'
      ];
      doc.relatedErrors = [ErrorCode.NETWORK_TIMEOUT, ErrorCode.LOAD_TIMEOUT];
      break;
  }
  
  return doc;
}

/**
 * Legacy compatibility function for backward compatibility with existing formatJSONResult
 * @deprecated Use formatErrorJSON with Result<T,E> instead
 */
export function formatLegacyErrorResult<T = unknown>(
  data?: T,
  error?: string,
  code: ErrorCode = ErrorCode.OK
): {
  success: boolean;
  data?: T;
  error?: string;
  code: ErrorCode;
  timestamp: string;
} {
  return {
    success: code === ErrorCode.OK,
    code,
    timestamp: new Date().toISOString(),
    ...(code === ErrorCode.OK && data !== undefined && { data }),
    ...(code !== ErrorCode.OK && error !== undefined && { error })
  };
}