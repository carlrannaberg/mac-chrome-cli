/**
 * Comprehensive error code system for mac-chrome-cli
 * 
 * This replaces the basic ERROR_CODES constant with a comprehensive system that includes:
 * - Standardized error codes grouped by category
 * - Error context and metadata
 * - Recovery strategy hints
 * - Human-readable descriptions
 */

/**
 * Error code enum with comprehensive categories
 * Maintains backward compatibility with existing ERROR_CODES
 */
export enum ErrorCode {
  // Success
  OK = 0,

  // Input/Validation Errors (10-19)
  INVALID_INPUT = 10,
  INVALID_SELECTOR = 11,
  INVALID_URL = 12,
  INVALID_FILE_PATH = 13,
  INVALID_COORDINATES = 14,
  VALIDATION_FAILED = 15,
  MISSING_REQUIRED_PARAM = 16,
  INVALID_JSON = 17,

  // Target/Element Errors (20-29)
  TARGET_NOT_FOUND = 20,
  ELEMENT_NOT_VISIBLE = 21,
  ELEMENT_NOT_INTERACTABLE = 22,
  MULTIPLE_TARGETS_FOUND = 23,
  TARGET_OUTSIDE_VIEWPORT = 24,
  ELEMENT_STALE = 25,

  // Permission/Security Errors (30-39)
  PERMISSION_DENIED = 30,
  ACCESSIBILITY_DENIED = 31,
  SCREEN_RECORDING_DENIED = 32,
  FILE_SYSTEM_DENIED = 33,
  APPLE_EVENTS_DENIED = 34,
  SECURITY_RESTRICTION = 35,

  // Timeout/Performance Errors (40-49)
  TIMEOUT = 40,
  NETWORK_TIMEOUT = 41,
  SCRIPT_TIMEOUT = 42,
  LOAD_TIMEOUT = 43,
  ANIMATION_TIMEOUT = 44,

  // Chrome/Browser Errors (50-59)
  CHROME_NOT_FOUND = 50,
  CHROME_NOT_RUNNING = 51,
  CHROME_CRASHED = 52,
  TAB_NOT_FOUND = 53,
  WINDOW_NOT_FOUND = 54,
  PAGE_LOAD_FAILED = 55,
  NAVIGATION_FAILED = 56,
  JAVASCRIPT_ERROR = 57,

  // Network/Connection Errors (60-69)
  NETWORK_ERROR = 60,
  CONNECTION_REFUSED = 61,
  DNS_RESOLUTION_FAILED = 62,
  SSL_ERROR = 63,
  PROXY_ERROR = 64,

  // File System Errors (70-79)
  FILE_NOT_FOUND = 70,
  FILE_READ_ERROR = 71,
  FILE_WRITE_ERROR = 72,
  DIRECTORY_NOT_FOUND = 73,
  DISK_FULL = 74,
  PATH_TOO_LONG = 75,

  // System/Resource Errors (80-89)
  MEMORY_ERROR = 80,
  CPU_LIMIT_EXCEEDED = 81,
  RESOURCE_UNAVAILABLE = 82,
  PROCESS_FAILED = 83,
  SYSTEM_ERROR = 84,
  RATE_LIMITED = 85,

  // AppleScript/Automation Errors (90-98)
  APPLESCRIPT_ERROR = 90,
  APPLESCRIPT_COMPILATION_FAILED = 91,
  UI_AUTOMATION_FAILED = 92,
  COORDINATE_CALCULATION_FAILED = 93,
  SCREEN_CAPTURE_FAILED = 94,
  MOUSE_CLICK_FAILED = 95,
  KEYBOARD_INPUT_FAILED = 96,

  // Unknown/Catch-all Error
  UNKNOWN_ERROR = 99
}

/**
 * Error category for grouping related error codes
 */
export enum ErrorCategory {
  SUCCESS = 'success',
  INPUT = 'input',
  TARGET = 'target',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  BROWSER = 'browser',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  SYSTEM = 'system',
  AUTOMATION = 'automation',
  UNKNOWN = 'unknown'
}

/**
 * Error information with context and recovery hints
 */
export interface ErrorInfo {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  description: string;
  recoveryHint: string;
  retryable: boolean;
  userAction: boolean; // Requires user intervention
}

/**
 * Mapping of error codes to their information
 */
export const ERROR_INFO: Record<ErrorCode, ErrorInfo> = {
  [ErrorCode.OK]: {
    code: ErrorCode.OK,
    category: ErrorCategory.SUCCESS,
    message: 'Success',
    description: 'Operation completed successfully',
    recoveryHint: 'No action needed',
    retryable: false,
    userAction: false
  },

  // Input/Validation Errors
  [ErrorCode.INVALID_INPUT]: {
    code: ErrorCode.INVALID_INPUT,
    category: ErrorCategory.INPUT,
    message: 'Invalid input provided',
    description: 'The input parameters are invalid or malformed',
    recoveryHint: 'Check input parameters and try again',
    retryable: false,
    userAction: true
  },
  [ErrorCode.INVALID_SELECTOR]: {
    code: ErrorCode.INVALID_SELECTOR,
    category: ErrorCategory.INPUT,
    message: 'Invalid CSS selector',
    description: 'The provided CSS selector is malformed or invalid',
    recoveryHint: 'Verify selector syntax and try again',
    retryable: false,
    userAction: true
  },
  [ErrorCode.INVALID_URL]: {
    code: ErrorCode.INVALID_URL,
    category: ErrorCategory.INPUT,
    message: 'Invalid URL',
    description: 'The provided URL is malformed or invalid',
    recoveryHint: 'Check URL format and try again',
    retryable: false,
    userAction: true
  },
  [ErrorCode.INVALID_FILE_PATH]: {
    code: ErrorCode.INVALID_FILE_PATH,
    category: ErrorCategory.INPUT,
    message: 'Invalid file path',
    description: 'The provided file path is invalid or inaccessible',
    recoveryHint: 'Check file path and permissions',
    retryable: false,
    userAction: true
  },
  [ErrorCode.INVALID_COORDINATES]: {
    code: ErrorCode.INVALID_COORDINATES,
    category: ErrorCategory.INPUT,
    message: 'Invalid coordinates',
    description: 'The provided coordinates are out of bounds or invalid',
    recoveryHint: 'Check coordinate values and screen bounds',
    retryable: false,
    userAction: true
  },
  [ErrorCode.VALIDATION_FAILED]: {
    code: ErrorCode.VALIDATION_FAILED,
    category: ErrorCategory.INPUT,
    message: 'Validation failed',
    description: 'Input validation failed for one or more parameters',
    recoveryHint: 'Review and correct input parameters',
    retryable: false,
    userAction: true
  },
  [ErrorCode.MISSING_REQUIRED_PARAM]: {
    code: ErrorCode.MISSING_REQUIRED_PARAM,
    category: ErrorCategory.INPUT,
    message: 'Missing required parameter',
    description: 'A required parameter is missing from the request',
    recoveryHint: 'Provide the missing required parameter',
    retryable: false,
    userAction: true
  },
  [ErrorCode.INVALID_JSON]: {
    code: ErrorCode.INVALID_JSON,
    category: ErrorCategory.INPUT,
    message: 'Invalid JSON',
    description: 'The provided JSON data is malformed or invalid',
    recoveryHint: 'Check JSON syntax and try again',
    retryable: false,
    userAction: true
  },

  // Target/Element Errors
  [ErrorCode.TARGET_NOT_FOUND]: {
    code: ErrorCode.TARGET_NOT_FOUND,
    category: ErrorCategory.TARGET,
    message: 'Target element not found',
    description: 'The specified element could not be found on the page',
    recoveryHint: 'Check if element exists and selector is correct',
    retryable: true,
    userAction: true
  },
  [ErrorCode.ELEMENT_NOT_VISIBLE]: {
    code: ErrorCode.ELEMENT_NOT_VISIBLE,
    category: ErrorCategory.TARGET,
    message: 'Element not visible',
    description: 'The target element exists but is not visible',
    recoveryHint: 'Scroll to element or wait for it to become visible',
    retryable: true,
    userAction: false
  },
  [ErrorCode.ELEMENT_NOT_INTERACTABLE]: {
    code: ErrorCode.ELEMENT_NOT_INTERACTABLE,
    category: ErrorCategory.TARGET,
    message: 'Element not interactable',
    description: 'The element exists but cannot be interacted with',
    recoveryHint: 'Wait for element to become interactable or check if it\'s enabled',
    retryable: true,
    userAction: false
  },
  [ErrorCode.MULTIPLE_TARGETS_FOUND]: {
    code: ErrorCode.MULTIPLE_TARGETS_FOUND,
    category: ErrorCategory.TARGET,
    message: 'Multiple targets found',
    description: 'The selector matched multiple elements when only one was expected',
    recoveryHint: 'Use a more specific selector to target a single element',
    retryable: false,
    userAction: true
  },
  [ErrorCode.TARGET_OUTSIDE_VIEWPORT]: {
    code: ErrorCode.TARGET_OUTSIDE_VIEWPORT,
    category: ErrorCategory.TARGET,
    message: 'Target outside viewport',
    description: 'The target element is outside the visible viewport',
    recoveryHint: 'Scroll to bring element into view',
    retryable: true,
    userAction: false
  },
  [ErrorCode.ELEMENT_STALE]: {
    code: ErrorCode.ELEMENT_STALE,
    category: ErrorCategory.TARGET,
    message: 'Element reference is stale',
    description: 'The element reference is no longer valid (page changed)',
    recoveryHint: 'Refresh element reference and try again',
    retryable: true,
    userAction: false
  },

  // Permission/Security Errors
  [ErrorCode.PERMISSION_DENIED]: {
    code: ErrorCode.PERMISSION_DENIED,
    category: ErrorCategory.PERMISSION,
    message: 'Permission denied',
    description: 'The requested operation requires permissions that have not been granted',
    recoveryHint: 'Grant necessary permissions in System Preferences',
    retryable: false,
    userAction: true
  },
  [ErrorCode.ACCESSIBILITY_DENIED]: {
    code: ErrorCode.ACCESSIBILITY_DENIED,
    category: ErrorCategory.PERMISSION,
    message: 'Accessibility permission denied',
    description: 'Accessibility permissions are required for UI automation',
    recoveryHint: 'Enable Accessibility permissions in System Preferences > Privacy & Security',
    retryable: false,
    userAction: true
  },
  [ErrorCode.SCREEN_RECORDING_DENIED]: {
    code: ErrorCode.SCREEN_RECORDING_DENIED,
    category: ErrorCategory.PERMISSION,
    message: 'Screen recording permission denied',
    description: 'Screen recording permissions are required for screenshots',
    recoveryHint: 'Enable Screen Recording permissions in System Preferences > Privacy & Security',
    retryable: false,
    userAction: true
  },
  [ErrorCode.FILE_SYSTEM_DENIED]: {
    code: ErrorCode.FILE_SYSTEM_DENIED,
    category: ErrorCategory.PERMISSION,
    message: 'File system access denied',
    description: 'File system permissions are required for this operation',
    recoveryHint: 'Grant file system access permissions',
    retryable: false,
    userAction: true
  },
  [ErrorCode.APPLE_EVENTS_DENIED]: {
    code: ErrorCode.APPLE_EVENTS_DENIED,
    category: ErrorCategory.PERMISSION,
    message: 'Apple Events permission denied',
    description: 'Apple Events permissions are required to control Chrome',
    recoveryHint: 'Enable Apple Events permissions for Terminal/application',
    retryable: false,
    userAction: true
  },
  [ErrorCode.SECURITY_RESTRICTION]: {
    code: ErrorCode.SECURITY_RESTRICTION,
    category: ErrorCategory.PERMISSION,
    message: 'Security restriction',
    description: 'The operation is blocked by system security restrictions',
    recoveryHint: 'Check system security settings and policies',
    retryable: false,
    userAction: true
  },

  // Timeout/Performance Errors
  [ErrorCode.TIMEOUT]: {
    code: ErrorCode.TIMEOUT,
    category: ErrorCategory.TIMEOUT,
    message: 'Operation timed out',
    description: 'The operation exceeded the specified timeout duration',
    recoveryHint: 'Increase timeout or check for performance issues',
    retryable: true,
    userAction: false
  },
  [ErrorCode.NETWORK_TIMEOUT]: {
    code: ErrorCode.NETWORK_TIMEOUT,
    category: ErrorCategory.TIMEOUT,
    message: 'Network timeout',
    description: 'Network request exceeded the timeout duration',
    recoveryHint: 'Check network connection and increase timeout if needed',
    retryable: true,
    userAction: false
  },
  [ErrorCode.SCRIPT_TIMEOUT]: {
    code: ErrorCode.SCRIPT_TIMEOUT,
    category: ErrorCategory.TIMEOUT,
    message: 'Script execution timeout',
    description: 'JavaScript execution exceeded the timeout duration',
    recoveryHint: 'Optimize script or increase timeout',
    retryable: true,
    userAction: false
  },
  [ErrorCode.LOAD_TIMEOUT]: {
    code: ErrorCode.LOAD_TIMEOUT,
    category: ErrorCategory.TIMEOUT,
    message: 'Page load timeout',
    description: 'Page loading exceeded the timeout duration',
    recoveryHint: 'Check network connection or increase timeout',
    retryable: true,
    userAction: false
  },
  [ErrorCode.ANIMATION_TIMEOUT]: {
    code: ErrorCode.ANIMATION_TIMEOUT,
    category: ErrorCategory.TIMEOUT,
    message: 'Animation timeout',
    description: 'Waiting for animation to complete exceeded timeout',
    recoveryHint: 'Increase timeout or check if element is animating',
    retryable: true,
    userAction: false
  },

  // Chrome/Browser Errors
  [ErrorCode.CHROME_NOT_FOUND]: {
    code: ErrorCode.CHROME_NOT_FOUND,
    category: ErrorCategory.BROWSER,
    message: 'Chrome not found',
    description: 'Google Chrome application could not be found',
    recoveryHint: 'Install Google Chrome or check installation path',
    retryable: false,
    userAction: true
  },
  [ErrorCode.CHROME_NOT_RUNNING]: {
    code: ErrorCode.CHROME_NOT_RUNNING,
    category: ErrorCategory.BROWSER,
    message: 'Chrome not running',
    description: 'Google Chrome is not currently running',
    recoveryHint: 'Start Google Chrome and try again',
    retryable: true,
    userAction: true
  },
  [ErrorCode.CHROME_CRASHED]: {
    code: ErrorCode.CHROME_CRASHED,
    category: ErrorCategory.BROWSER,
    message: 'Chrome crashed',
    description: 'Google Chrome has crashed or stopped responding',
    recoveryHint: 'Restart Chrome and try again',
    retryable: true,
    userAction: true
  },
  [ErrorCode.TAB_NOT_FOUND]: {
    code: ErrorCode.TAB_NOT_FOUND,
    category: ErrorCategory.BROWSER,
    message: 'Tab not found',
    description: 'The specified browser tab could not be found',
    recoveryHint: 'Check tab index or create a new tab',
    retryable: true,
    userAction: true
  },
  [ErrorCode.WINDOW_NOT_FOUND]: {
    code: ErrorCode.WINDOW_NOT_FOUND,
    category: ErrorCategory.BROWSER,
    message: 'Window not found',
    description: 'The specified browser window could not be found',
    recoveryHint: 'Check window index or create a new window',
    retryable: true,
    userAction: true
  },
  [ErrorCode.PAGE_LOAD_FAILED]: {
    code: ErrorCode.PAGE_LOAD_FAILED,
    category: ErrorCategory.BROWSER,
    message: 'Page load failed',
    description: 'The web page failed to load properly',
    recoveryHint: 'Check URL and network connection',
    retryable: true,
    userAction: false
  },
  [ErrorCode.NAVIGATION_FAILED]: {
    code: ErrorCode.NAVIGATION_FAILED,
    category: ErrorCategory.BROWSER,
    message: 'Navigation failed',
    description: 'Failed to navigate to the specified URL',
    recoveryHint: 'Check URL validity and network connection',
    retryable: true,
    userAction: false
  },
  [ErrorCode.JAVASCRIPT_ERROR]: {
    code: ErrorCode.JAVASCRIPT_ERROR,
    category: ErrorCategory.BROWSER,
    message: 'JavaScript execution error',
    description: 'An error occurred while executing JavaScript in the browser',
    recoveryHint: 'Check JavaScript syntax and browser console',
    retryable: true,
    userAction: true
  },

  // Network/Connection Errors
  [ErrorCode.NETWORK_ERROR]: {
    code: ErrorCode.NETWORK_ERROR,
    category: ErrorCategory.NETWORK,
    message: 'Network error',
    description: 'A network error occurred during the operation',
    recoveryHint: 'Check network connection and try again',
    retryable: true,
    userAction: false
  },
  [ErrorCode.CONNECTION_REFUSED]: {
    code: ErrorCode.CONNECTION_REFUSED,
    category: ErrorCategory.NETWORK,
    message: 'Connection refused',
    description: 'The network connection was refused by the server',
    recoveryHint: 'Check server availability and firewall settings',
    retryable: true,
    userAction: false
  },
  [ErrorCode.DNS_RESOLUTION_FAILED]: {
    code: ErrorCode.DNS_RESOLUTION_FAILED,
    category: ErrorCategory.NETWORK,
    message: 'DNS resolution failed',
    description: 'Failed to resolve the hostname to an IP address',
    recoveryHint: 'Check DNS settings and hostname validity',
    retryable: true,
    userAction: false
  },
  [ErrorCode.SSL_ERROR]: {
    code: ErrorCode.SSL_ERROR,
    category: ErrorCategory.NETWORK,
    message: 'SSL/TLS error',
    description: 'An SSL/TLS error occurred during the secure connection',
    recoveryHint: 'Check certificate validity and security settings',
    retryable: true,
    userAction: false
  },
  [ErrorCode.PROXY_ERROR]: {
    code: ErrorCode.PROXY_ERROR,
    category: ErrorCategory.NETWORK,
    message: 'Proxy error',
    description: 'An error occurred with the proxy connection',
    recoveryHint: 'Check proxy settings and connectivity',
    retryable: true,
    userAction: true
  },

  // File System Errors
  [ErrorCode.FILE_NOT_FOUND]: {
    code: ErrorCode.FILE_NOT_FOUND,
    category: ErrorCategory.FILESYSTEM,
    message: 'File not found',
    description: 'The specified file could not be found',
    recoveryHint: 'Check file path and ensure file exists',
    retryable: false,
    userAction: true
  },
  [ErrorCode.FILE_READ_ERROR]: {
    code: ErrorCode.FILE_READ_ERROR,
    category: ErrorCategory.FILESYSTEM,
    message: 'File read error',
    description: 'Failed to read the specified file',
    recoveryHint: 'Check file permissions and integrity',
    retryable: true,
    userAction: true
  },
  [ErrorCode.FILE_WRITE_ERROR]: {
    code: ErrorCode.FILE_WRITE_ERROR,
    category: ErrorCategory.FILESYSTEM,
    message: 'File write error',
    description: 'Failed to write to the specified file',
    recoveryHint: 'Check file permissions and available disk space',
    retryable: true,
    userAction: true
  },
  [ErrorCode.DIRECTORY_NOT_FOUND]: {
    code: ErrorCode.DIRECTORY_NOT_FOUND,
    category: ErrorCategory.FILESYSTEM,
    message: 'Directory not found',
    description: 'The specified directory could not be found',
    recoveryHint: 'Check directory path and ensure it exists',
    retryable: false,
    userAction: true
  },
  [ErrorCode.DISK_FULL]: {
    code: ErrorCode.DISK_FULL,
    category: ErrorCategory.FILESYSTEM,
    message: 'Disk full',
    description: 'Insufficient disk space to complete the operation',
    recoveryHint: 'Free up disk space and try again',
    retryable: true,
    userAction: true
  },
  [ErrorCode.PATH_TOO_LONG]: {
    code: ErrorCode.PATH_TOO_LONG,
    category: ErrorCategory.FILESYSTEM,
    message: 'Path too long',
    description: 'The file path exceeds the maximum allowed length',
    recoveryHint: 'Use a shorter path or reorganize directory structure',
    retryable: false,
    userAction: true
  },

  // System/Resource Errors
  [ErrorCode.MEMORY_ERROR]: {
    code: ErrorCode.MEMORY_ERROR,
    category: ErrorCategory.SYSTEM,
    message: 'Memory error',
    description: 'Insufficient memory to complete the operation',
    recoveryHint: 'Close other applications to free memory',
    retryable: true,
    userAction: true
  },
  [ErrorCode.CPU_LIMIT_EXCEEDED]: {
    code: ErrorCode.CPU_LIMIT_EXCEEDED,
    category: ErrorCategory.SYSTEM,
    message: 'CPU limit exceeded',
    description: 'The operation exceeded CPU resource limits',
    recoveryHint: 'Reduce system load and try again',
    retryable: true,
    userAction: true
  },
  [ErrorCode.RESOURCE_UNAVAILABLE]: {
    code: ErrorCode.RESOURCE_UNAVAILABLE,
    category: ErrorCategory.SYSTEM,
    message: 'Resource unavailable',
    description: 'A required system resource is unavailable',
    recoveryHint: 'Wait for resource to become available or restart application',
    retryable: true,
    userAction: false
  },
  [ErrorCode.PROCESS_FAILED]: {
    code: ErrorCode.PROCESS_FAILED,
    category: ErrorCategory.SYSTEM,
    message: 'Process failed',
    description: 'A system process failed to execute properly',
    recoveryHint: 'Check system logs and restart if necessary',
    retryable: true,
    userAction: true
  },
  [ErrorCode.SYSTEM_ERROR]: {
    code: ErrorCode.SYSTEM_ERROR,
    category: ErrorCategory.SYSTEM,
    message: 'System error',
    description: 'A general system error occurred',
    recoveryHint: 'Check system status and logs',
    retryable: true,
    userAction: true
  },
  [ErrorCode.RATE_LIMITED]: {
    code: ErrorCode.RATE_LIMITED,
    category: ErrorCategory.SYSTEM,
    message: 'Rate limit exceeded',
    description: 'Operation rate limit has been exceeded',
    recoveryHint: 'Wait before retrying or reduce operation frequency',
    retryable: true,
    userAction: false
  },

  // AppleScript/Automation Errors
  [ErrorCode.APPLESCRIPT_ERROR]: {
    code: ErrorCode.APPLESCRIPT_ERROR,
    category: ErrorCategory.AUTOMATION,
    message: 'AppleScript error',
    description: 'An error occurred during AppleScript execution',
    recoveryHint: 'Check AppleScript syntax and system permissions',
    retryable: true,
    userAction: true
  },
  [ErrorCode.APPLESCRIPT_COMPILATION_FAILED]: {
    code: ErrorCode.APPLESCRIPT_COMPILATION_FAILED,
    category: ErrorCategory.AUTOMATION,
    message: 'AppleScript compilation failed',
    description: 'Failed to compile the AppleScript code',
    recoveryHint: 'Check AppleScript syntax for errors',
    retryable: false,
    userAction: true
  },
  [ErrorCode.UI_AUTOMATION_FAILED]: {
    code: ErrorCode.UI_AUTOMATION_FAILED,
    category: ErrorCategory.AUTOMATION,
    message: 'UI automation failed',
    description: 'Failed to perform UI automation action',
    recoveryHint: 'Check element accessibility and system permissions',
    retryable: true,
    userAction: true
  },
  [ErrorCode.COORDINATE_CALCULATION_FAILED]: {
    code: ErrorCode.COORDINATE_CALCULATION_FAILED,
    category: ErrorCategory.AUTOMATION,
    message: 'Coordinate calculation failed',
    description: 'Failed to calculate screen coordinates for the element',
    recoveryHint: 'Check element position and viewport settings',
    retryable: true,
    userAction: false
  },
  [ErrorCode.SCREEN_CAPTURE_FAILED]: {
    code: ErrorCode.SCREEN_CAPTURE_FAILED,
    category: ErrorCategory.AUTOMATION,
    message: 'Screen capture failed',
    description: 'Failed to capture screenshot',
    recoveryHint: 'Check screen recording permissions',
    retryable: true,
    userAction: true
  },
  [ErrorCode.MOUSE_CLICK_FAILED]: {
    code: ErrorCode.MOUSE_CLICK_FAILED,
    category: ErrorCategory.AUTOMATION,
    message: 'Mouse click operation failed',
    description: 'Failed to perform mouse click for element focusing',
    recoveryHint: 'Check element visibility and accessibility permissions',
    retryable: true,
    userAction: false
  },
  [ErrorCode.KEYBOARD_INPUT_FAILED]: {
    code: ErrorCode.KEYBOARD_INPUT_FAILED,
    category: ErrorCategory.AUTOMATION,
    message: 'Keyboard input operation failed',
    description: 'Failed to input text using keyboard operations',
    recoveryHint: 'Check accessibility permissions and element focus',
    retryable: true,
    userAction: false
  },

  // Unknown/Catch-all Error
  [ErrorCode.UNKNOWN_ERROR]: {
    code: ErrorCode.UNKNOWN_ERROR,
    category: ErrorCategory.UNKNOWN,
    message: 'Unknown error',
    description: 'An unexpected error occurred',
    recoveryHint: 'Try again or contact support if the problem persists',
    retryable: true,
    userAction: false
  }
};

/**
 * Get error information for a specific error code
 */
export function getErrorInfo(code: ErrorCode): ErrorInfo {
  return ERROR_INFO[code] || ERROR_INFO[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Get error category for a specific error code
 */
export function getErrorCategory(code: ErrorCode): ErrorCategory {
  return getErrorInfo(code).category;
}

/**
 * Check if an error code represents a retryable error
 */
export function isRetryableError(code: ErrorCode): boolean {
  return getErrorInfo(code).retryable;
}

/**
 * Check if an error code requires user action
 */
export function requiresUserAction(code: ErrorCode): boolean {
  return getErrorInfo(code).userAction;
}

/**
 * Create a human-readable error message with context
 */
export function formatErrorMessage(code: ErrorCode, context?: string): string {
  const info = getErrorInfo(code);
  const baseMessage = `${info.message}: ${info.description}`;
  
  if (context) {
    return `${baseMessage} (${context})`;
  }
  
  return baseMessage;
}

/**
 * Legacy ERROR_CODES constant for backward compatibility
 * @deprecated Use ErrorCode enum instead
 */
export const ERROR_CODES = {
  OK: ErrorCode.OK,
  INVALID_INPUT: ErrorCode.INVALID_INPUT,
  INVALID_PARAMETER: ErrorCode.INVALID_INPUT, // Alias for backward compatibility
  TARGET_NOT_FOUND: ErrorCode.TARGET_NOT_FOUND,
  PERMISSION_DENIED: ErrorCode.PERMISSION_DENIED,
  TIMEOUT: ErrorCode.TIMEOUT,
  CHROME_NOT_FOUND: ErrorCode.CHROME_NOT_FOUND,
  CHROME_NOT_RUNNING: ErrorCode.CHROME_NOT_RUNNING,
  RESOURCE_BUSY: ErrorCode.RESOURCE_UNAVAILABLE, // Alias for resource conflicts
  RATE_LIMITED: ErrorCode.RATE_LIMITED,
  UNKNOWN_ERROR: ErrorCode.UNKNOWN_ERROR
} as const;

/**
 * Legacy ErrorCode type for backward compatibility
 * @deprecated Import ErrorCode directly instead
 */
export type LegacyErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];