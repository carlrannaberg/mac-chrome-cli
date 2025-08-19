/**
 * @fileoverview Navigation commands for browser navigation operations
 * 
 * This module provides navigation functionality including URL navigation, page reloading,
 * and browser history navigation (back/forward) with comprehensive error handling
 * and type safety using the unified Result<T,E> pattern.
 * 
 * @example
 * ```typescript
 * // Navigate to a URL
 * const navResult = await navigationCmd.go('https://example.com', {
 *   waitForLoad: true,
 *   timeoutMs: 30000
 * });
 * 
 * // Reload current page
 * const reloadResult = await navigationCmd.reload({
 *   hardReload: true
 * });
 * 
 * // Navigate back in history
 * const backResult = await navigationCmd.back();
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { Result, ok, error, withRecoveryHint } from '../core/Result.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import { 
  navigateToURL, 
  reloadPage, 
  navigateBack, 
  navigateForward,
  waitForPageLoad
} from '../lib/navigation.js';

/**
 * Configuration options for navigation operations.
 * 
 * @interface NavigationOptions
 * @example
 * ```typescript
 * const options: NavigationOptions = {
 *   windowIndex: 1,
 *   waitForLoad: true,
 *   timeoutMs: 30000,
 *   hardReload: false
 * };
 * ```
 */
export interface NavigationOptions {
  /** Target window index (1-based, default: 1) */
  windowIndex?: number;
  /** Whether to wait for page load completion (default: false) */
  waitForLoad?: boolean;
  /** Operation timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Whether to perform hard reload bypassing cache (for reload command only) */
  hardReload?: boolean;
}

/**
 * Navigation result data structure containing page information.
 * 
 * @interface NavigationData
 * @example
 * ```typescript
 * const data: NavigationData = {
 *   url: 'https://example.com',
 *   title: 'Example Domain',
 *   loading: false,
 *   canGoBack: true,
 *   canGoForward: false,
 *   timestamp: '2023-06-15T10:30:00.000Z'
 * };
 * ```
 */
export interface NavigationData {
  /** Current page URL */
  url: string;
  /** Current page title */
  title: string;
  /** Whether the page is still loading */
  loading: boolean;
  /** Whether browser can navigate back */
  canGoBack: boolean;
  /** Whether browser can navigate forward */
  canGoForward: boolean;
  /** Timestamp when navigation completed */
  timestamp: string;
}

/**
 * Navigation command class providing browser navigation operations.
 * 
 * Extends BrowserCommandBase to inherit consistent error handling,
 * validation patterns, and result formatting capabilities.
 * 
 * @class NavigationCommand
 * @extends BrowserCommandBase
 * @example
 * ```typescript
 * const navigationCmd = new NavigationCommand();
 * 
 * // Navigate to URL with options
 * const result = await navigationCmd.go('https://example.com', {
 *   waitForLoad: true,
 *   timeoutMs: 15000
 * });
 * 
 * if (result.success) {
 *   console.log(`Navigated to: ${result.data.url}`);
 * }
 * ```
 */
export class NavigationCommand extends BrowserCommandBase {
  
  /**
   * Navigate to the specified URL.
   * 
   * Navigates the browser to the given URL with optional loading wait
   * and timeout configuration. Automatically adds protocol if missing.
   * 
   * @param url - Target URL to navigate to
   * @param options - Navigation configuration options
   * @returns Promise resolving to navigation result with page data
   * 
   * @throws {INVALID_URL} When URL is empty, malformed, or uses unsupported protocol
   * @throws {VALIDATION_FAILED} When windowIndex or timeoutMs parameters are invalid
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {NAVIGATION_FAILED} When navigation to URL fails (network, server errors)
   * @throws {PAGE_LOAD_FAILED} When page fails to load properly (when waitForLoad is true)
   * @throws {LOAD_TIMEOUT} When page loading exceeds timeout duration (when waitForLoad is true)
   * @throws {NETWORK_TIMEOUT} When network request times out during navigation
   * @throws {NETWORK_ERROR} When network connectivity issues prevent navigation
   * @throws {DNS_RESOLUTION_FAILED} When hostname cannot be resolved to IP address
   * @throws {SSL_ERROR} When SSL/TLS certificate or connection issues occur
   * @throws {PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during navigation validation
   * @throws {SYSTEM_ERROR} When system-level errors prevent operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during navigation
   * 
   * @example
   * ```typescript
   * // Basic navigation with error handling
   * try {
   *   const result = await navigationCmd.go('https://example.com');
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.INVALID_URL:
   *         console.log('Check URL format and try again');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Please start Chrome browser');
   *         break;
   *       case ErrorCode.NETWORK_ERROR:
   *         console.log('Check network connection and retry');
   *         break;
   *       case ErrorCode.LOAD_TIMEOUT:
   *         console.log('Page loading timed out - may still be accessible');
   *         break;
   *     }
   *   } else {
   *     console.log(`Successfully navigated to: ${result.data.url}`);
   *   }
   * } catch (error) {
   *   console.error('Unexpected navigation error:', error);
   * }
   * 
   * // Navigation with load waiting and custom timeout
   * const result = await navigationCmd.go('https://slow-site.com', {
   *   waitForLoad: true,
   *   timeoutMs: 60000
   * });
   * 
   * // Navigation to specific window
   * const result = await navigationCmd.go('https://example.com', {
   *   windowIndex: 2
   * });
   * ```
   */
  async go(url: string, options: NavigationOptions = {}): Promise<Result<NavigationData, string>> {
    // Validate inputs
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return error(
        'URL is required and cannot be empty',
        ErrorCode.INVALID_URL
      );
    }

    // Normalize and validate URL
    const normalizedUrl = this.normalizeUrl(url.trim());
    const urlValidation = this.validateUrl(normalizedUrl);
    if (!urlValidation.success) {
      return error(urlValidation.error, ErrorCode.INVALID_URL);
    }

    const { windowIndex = 1, waitForLoad = false, timeoutMs = 30000 } = options;

    // Validate options
    const optionsValidation = this.validateBaseOptions({ windowIndex, timeoutMs });
    if (!optionsValidation.success) {
      return error(optionsValidation.error, ErrorCode.VALIDATION_FAILED);
    }

    return this.executeBrowserCommand(async () => {
      // Execute navigation with normalized URL
      const navResult = await navigateToURL(normalizedUrl, windowIndex);
      
      if (!navResult.success) {
        const error = new Error(navResult.error || 'Navigation failed');
        // Add recovery strategy based on error type
        if (navResult.error?.includes('timeout')) {
          error.message = 'Navigation timed out - page may still be loading';
        } else if (navResult.error?.includes('network') || navResult.error?.includes('connection')) {
          error.message = 'Network error during navigation - check connectivity';
        }
        throw error;
      }

      let finalResult = navResult;

      // Wait for page load if requested
      if (waitForLoad) {
        const loadResult = await waitForPageLoad(windowIndex, timeoutMs);
        if (!loadResult.success && loadResult.code !== ErrorCode.TIMEOUT) {
          // Only throw on non-timeout errors - timeout is acceptable for waitForLoad
          throw new Error(loadResult.error || 'Failed to wait for page load');
        }
        // Use load result if successful, otherwise keep navigation result
        finalResult = loadResult.success ? loadResult : navResult;
      }

      // Get additional page information
      const pageInfo = await this.getNavigationCapabilities(windowIndex);

      return {
        url: finalResult.url || url,
        title: finalResult.title || '',
        loading: finalResult.loading || false,
        canGoBack: pageInfo.canGoBack,
        canGoForward: pageInfo.canGoForward,
        timestamp: new Date().toISOString()
      };
    }, 'navigation').then(result => {
      // Add recovery hints for specific error conditions
      if (!result.success) {
        if (result.error?.includes('timeout')) {
          return withRecoveryHint(result, 'retry_with_delay');
        } else if (result.error?.includes('network') || result.error?.includes('connection')) {
          return withRecoveryHint(result, 'retry');
        } else if (result.error?.includes('Chrome not running')) {
          return withRecoveryHint(result, 'user_action');
        }
        return withRecoveryHint(result, 'check_target');
      }
      return result;
    });
  }

  /**
   * Reload the current page.
   * 
   * Reloads the currently active page with option for hard reload
   * that bypasses browser cache.
   * 
   * @param options - Reload configuration options
   * @returns Promise resolving to navigation result with page data
   * 
   * @throws {VALIDATION_FAILED} When windowIndex or timeoutMs parameters are invalid
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {PAGE_LOAD_FAILED} When page fails to reload properly
   * @throws {LOAD_TIMEOUT} When page reloading exceeds timeout duration (when waitForLoad is true)
   * @throws {NETWORK_TIMEOUT} When network request times out during reload
   * @throws {NETWORK_ERROR} When network connectivity issues prevent reload
   * @throws {PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during reload validation
   * @throws {SYSTEM_ERROR} When system-level errors prevent operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during reload
   * 
   * @example
   * ```typescript
   * // Normal reload with error handling
   * try {
   *   const result = await navigationCmd.reload();
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome is not running - please start it first');
   *         break;
   *       case ErrorCode.TAB_NOT_FOUND:
   *         console.log('No active tab found to reload');
   *         break;
   *       case ErrorCode.NETWORK_ERROR:
   *         console.log('Network error during reload - check connectivity');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected reload error:', error);
   * }
   * 
   * // Hard reload bypassing cache
   * const result = await navigationCmd.reload({
   *   hardReload: true
   * });
   * 
   * // Reload with load waiting
   * const result = await navigationCmd.reload({
   *   waitForLoad: true,
   *   timeoutMs: 45000
   * });
   * ```
   */
  async reload(options: NavigationOptions = {}): Promise<Result<NavigationData, string>> {
    const { 
      windowIndex = 1, 
      waitForLoad = false, 
      timeoutMs = 30000, 
      hardReload = false 
    } = options;

    // Validate options
    const optionsValidation = this.validateBaseOptions({ windowIndex, timeoutMs });
    if (!optionsValidation.success) {
      return error(optionsValidation.error, ErrorCode.VALIDATION_FAILED);
    }

    return this.executeBrowserCommand(async () => {
      // Execute reload
      const reloadResult = await reloadPage(hardReload, windowIndex);
      
      if (!reloadResult.success) {
        throw new Error(reloadResult.error || 'Page reload failed');
      }

      let finalResult = reloadResult;

      // Wait for page load if requested
      if (waitForLoad) {
        const loadResult = await waitForPageLoad(windowIndex, timeoutMs);
        if (!loadResult.success && loadResult.code !== ErrorCode.TIMEOUT) {
          throw new Error(loadResult.error || 'Failed to wait for page load after reload');
        }
        finalResult = loadResult.success ? loadResult : reloadResult;
      }

      // Get additional page information
      const pageInfo = await this.getNavigationCapabilities(windowIndex);

      return {
        url: finalResult.url || '',
        title: finalResult.title || '',
        loading: finalResult.loading || false,
        canGoBack: pageInfo.canGoBack,
        canGoForward: pageInfo.canGoForward,
        timestamp: new Date().toISOString()
      };
    }, 'page-reload').then(result => {
      // Add recovery hints for reload operations
      if (!result.success) {
        if (result.error?.includes('timeout')) {
          return withRecoveryHint(result, 'retry_with_delay');
        } else if (result.error?.includes('permission') || result.error?.includes('Chrome not running')) {
          return withRecoveryHint(result, 'user_action');
        }
        return withRecoveryHint(result, 'retry');
      }
      return result;
    });
  }

  /**
   * Navigate back in browser history.
   * 
   * Navigates to the previous page in the browser's history stack.
   * 
   * @param options - Navigation configuration options
   * @returns Promise resolving to navigation result with page data
   * 
   * @throws {VALIDATION_FAILED} When windowIndex or timeoutMs parameters are invalid
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {NAVIGATION_FAILED} When back navigation fails (no history available)
   * @throws {PAGE_LOAD_FAILED} When previous page fails to load properly
   * @throws {LOAD_TIMEOUT} When page loading exceeds timeout duration (when waitForLoad is true)
   * @throws {NETWORK_TIMEOUT} When network request times out during back navigation
   * @throws {PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during navigation validation
   * @throws {SYSTEM_ERROR} When system-level errors prevent operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during back navigation
   * 
   * @example
   * ```typescript
   * // Basic back navigation with error handling
   * try {
   *   const result = await navigationCmd.back();
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.NAVIGATION_FAILED:
   *         console.log('Cannot go back - no previous page in history');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome is not running - please start it first');
   *         break;
   *       case ErrorCode.TAB_NOT_FOUND:
   *         console.log('No active tab found for back navigation');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected back navigation error:', error);
   * }
   * 
   * // Back navigation with load waiting
   * const result = await navigationCmd.back({
   *   waitForLoad: true
   * });
   * 
   * // Back navigation in specific window
   * const result = await navigationCmd.back({
   *   windowIndex: 2
   * });
   * ```
   */
  async back(options: NavigationOptions = {}): Promise<Result<NavigationData, string>> {
    const { windowIndex = 1, waitForLoad = false, timeoutMs = 30000 } = options;

    // Validate options
    const optionsValidation = this.validateBaseOptions({ windowIndex, timeoutMs });
    if (!optionsValidation.success) {
      return error(optionsValidation.error, ErrorCode.VALIDATION_FAILED);
    }

    return this.executeBrowserCommand(async () => {
      // Execute back navigation
      const backResult = await navigateBack(windowIndex);
      
      if (!backResult.success) {
        throw new Error(backResult.error || 'Back navigation failed');
      }

      let finalResult = backResult;

      // Wait for page load if requested
      if (waitForLoad) {
        const loadResult = await waitForPageLoad(windowIndex, timeoutMs);
        if (!loadResult.success && loadResult.code !== ErrorCode.TIMEOUT) {
          throw new Error(loadResult.error || 'Failed to wait for page load after back navigation');
        }
        finalResult = loadResult.success ? loadResult : backResult;
      }

      // Get additional page information
      const pageInfo = await this.getNavigationCapabilities(windowIndex);

      return {
        url: finalResult.url || '',
        title: finalResult.title || '',
        loading: finalResult.loading || false,
        canGoBack: pageInfo.canGoBack,
        canGoForward: pageInfo.canGoForward,
        timestamp: new Date().toISOString()
      };
    }, 'back-navigation').then(result => {
      // Add recovery hints for back navigation
      if (!result.success) {
        if (result.error?.includes('no history') || result.error?.includes('cannot go back')) {
          return withRecoveryHint(result, 'not_recoverable');
        } else if (result.error?.includes('timeout')) {
          return withRecoveryHint(result, 'retry_with_delay');
        }
        return withRecoveryHint(result, 'retry');
      }
      return result;
    });
  }

  /**
   * Navigate forward in browser history.
   * 
   * Navigates to the next page in the browser's history stack.
   * 
   * @param options - Navigation configuration options
   * @returns Promise resolving to navigation result with page data
   * 
   * @throws {VALIDATION_FAILED} When windowIndex or timeoutMs parameters are invalid
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {NAVIGATION_FAILED} When forward navigation fails (no forward history available)
   * @throws {PAGE_LOAD_FAILED} When next page fails to load properly
   * @throws {LOAD_TIMEOUT} When page loading exceeds timeout duration (when waitForLoad is true)
   * @throws {NETWORK_TIMEOUT} When network request times out during forward navigation
   * @throws {PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during navigation validation
   * @throws {SYSTEM_ERROR} When system-level errors prevent operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during forward navigation
   * 
   * @example
   * ```typescript
   * // Basic forward navigation with error handling
   * try {
   *   const result = await navigationCmd.forward();
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.NAVIGATION_FAILED:
   *         console.log('Cannot go forward - no next page in history');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome is not running - please start it first');
   *         break;
   *       case ErrorCode.TAB_NOT_FOUND:
   *         console.log('No active tab found for forward navigation');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected forward navigation error:', error);
   * }
   * 
   * // Forward navigation with load waiting
   * const result = await navigationCmd.forward({
   *   waitForLoad: true
   * });
   * 
   * // Forward navigation in specific window
   * const result = await navigationCmd.forward({
   *   windowIndex: 2
   * });
   * ```
   */
  async forward(options: NavigationOptions = {}): Promise<Result<NavigationData, string>> {
    const { windowIndex = 1, waitForLoad = false, timeoutMs = 30000 } = options;

    // Validate options
    const optionsValidation = this.validateBaseOptions({ windowIndex, timeoutMs });
    if (!optionsValidation.success) {
      return error(optionsValidation.error, ErrorCode.VALIDATION_FAILED);
    }

    return this.executeBrowserCommand(async () => {
      // Execute forward navigation
      const forwardResult = await navigateForward(windowIndex);
      
      if (!forwardResult.success) {
        throw new Error(forwardResult.error || 'Forward navigation failed');
      }

      let finalResult = forwardResult;

      // Wait for page load if requested
      if (waitForLoad) {
        const loadResult = await waitForPageLoad(windowIndex, timeoutMs);
        if (!loadResult.success && loadResult.code !== ErrorCode.TIMEOUT) {
          throw new Error(loadResult.error || 'Failed to wait for page load after forward navigation');
        }
        finalResult = loadResult.success ? loadResult : forwardResult;
      }

      // Get additional page information
      const pageInfo = await this.getNavigationCapabilities(windowIndex);

      return {
        url: finalResult.url || '',
        title: finalResult.title || '',
        loading: finalResult.loading || false,
        canGoBack: pageInfo.canGoBack,
        canGoForward: pageInfo.canGoForward,
        timestamp: new Date().toISOString()
      };
    }, 'forward-navigation').then(result => {
      // Add recovery hints for forward navigation
      if (!result.success) {
        if (result.error?.includes('no forward history') || result.error?.includes('cannot go forward')) {
          return withRecoveryHint(result, 'not_recoverable');
        } else if (result.error?.includes('timeout')) {
          return withRecoveryHint(result, 'retry_with_delay');
        }
        return withRecoveryHint(result, 'retry');
      }
      return result;
    });
  }

  /**
   * Normalize URL by adding protocol if missing.
   * 
   * Handles various URL formats:
   * - Plain domains: 'example.com' → 'https://example.com'
   * - With protocol: 'https://example.com' → 'https://example.com' 
   * - Special protocols: 'file://', 'data:', 'chrome://' preserved
   * 
   * @private
   * @param url - Raw URL input
   * @returns Normalized URL string
   */
  private normalizeUrl(url: string): string {
    const trimmedUrl = url.trim();
    
    // Already has protocol
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl)) {
      return trimmedUrl;
    }
    
    // Looks like a file path
    if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
      return `file://${trimmedUrl}`;
    }
    
    // Default to HTTPS for domain names
    return `https://${trimmedUrl}`;
  }

  /**
   * Validate URL format and protocol support.
   * 
   * @private
   * @param url - Normalized URL to validate
   * @returns Validation result
   */
  private validateUrl(url: string): Result<void, string> {
    try {
      const parsedUrl = new URL(url);
      
      // Check for supported protocols
      const supportedProtocols = ['http:', 'https:', 'file:', 'data:', 'chrome:', 'chrome-extension:'];
      if (!supportedProtocols.includes(parsedUrl.protocol)) {
        return error(
          `Unsupported protocol: ${parsedUrl.protocol}. Supported: ${supportedProtocols.join(', ')}`,
          ErrorCode.INVALID_URL
        );
      }
      
      // Additional validation for HTTP/HTTPS
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
          return error('Invalid hostname in URL', ErrorCode.INVALID_URL);
        }
      }
      
      return ok(undefined);
    } catch (urlError) {
      return error(
        `Invalid URL format: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`,
        ErrorCode.INVALID_URL
      );
    }
  }

  /**
   * Get current page navigation capabilities (internal helper).
   * 
   * Determines whether the browser can navigate back or forward
   * by executing JavaScript to check history state.
   * 
   * @private
   * @param windowIndex - Target window index
   * @returns Promise resolving to navigation capabilities
   */
  private async getNavigationCapabilities(windowIndex: number): Promise<{
    canGoBack: boolean;
    canGoForward: boolean;
  }> {
    try {
      const javascript = `
(function() {
  return {
    canGoBack: window.history.length > 1,
    canGoForward: false // Cannot reliably detect forward capability in browsers
  };
})();
`;

      const result = await this.executeJavaScript<{
        canGoBack: boolean;
        canGoForward: boolean;
      }>(javascript, 1, windowIndex, 5000, 'navigation-capabilities');

      if (result.success) {
        return result.data;
      }
    } catch (error) {
      // Ignore errors and return default values
    }

    // Return conservative defaults if detection fails
    return {
      canGoBack: true,  // Assume back is available
      canGoForward: false  // Cannot reliably detect forward capability
    };
  }
}