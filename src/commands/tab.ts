/**
 * @fileoverview Tab command implementation with unified Result<T,E> pattern
 * 
 * This module provides tab management functionality using the service-oriented
 * architecture with standardized error handling and result types. Supports focusing
 * tabs by pattern matching and getting active tab information.
 * 
 * @example
 * ```typescript
 * // Focus tab by title pattern
 * const result = await tabCmd.focus({ 
 *   pattern: 'Dashboard'
 * });
 * 
 * // Get active tab info
 * const activeResult = await tabCmd.getActive();
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { Result, ok, error } from '../core/Result.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import { 
  focusTabByPattern,
  getCurrentPageInfo,
  type NavigationResult
} from '../lib/navigation.js';
import { getAllTabs, focusTabByIndex } from '../lib/apple.js';

/**
 * Tab focus options
 */
export interface TabFocusOptions {
  /** Pattern to match against tab title or URL */
  pattern: string;
  /** Target window index (1-based) */
  windowIndex?: number;
  /** Whether to use exact match instead of substring matching */
  exactMatch?: boolean;
}

/**
 * Tab focus by index options
 */
export interface TabFocusIndexOptions {
  /** Tab index to focus (1-based) */
  tabIndex: number;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Tab list options
 */
export interface TabListOptions {
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Tab information options  
 */
export interface TabInfoOptions {
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Tab operation result data with enhanced metadata
 */
export interface TabCommandData {
  /** Action performed (focus, get_active, list, focus_index) */
  action: string;
  /** Tab information (for single tab operations) */
  tab?: {
    /** Tab ID */
    id: number;
    /** Tab title */
    title: string;
    /** Tab URL */
    url: string;
    /** Whether tab is loading */
    loading?: boolean;
  };
  /** List of tabs (for list operations) */
  tabs?: Array<{
    /** Tab ID */
    id: number;
    /** Tab title */
    title: string;
    /** Tab URL */
    url: string;
    /** Whether tab is loading */
    loading: boolean;
    /** Window ID containing this tab */
    windowId: number;
  }>;
  /** Pattern used for matching (if applicable) */
  pattern?: string;
  /** Tab index used for focusing (if applicable) */
  tabIndex?: number;
  /** Whether exact matching was used */
  exactMatch?: boolean;
  /** Additional operation metadata */
  metadata: {
    /** Operation timestamp */
    timestamp: string;
    /** Window index targeted */
    windowIndex: number;
    /** Total number of tabs found (for list operations) */
    totalTabs?: number;
  };
}

/**
 * Tab command implementation with service-oriented architecture
 * 
 * Provides type-safe tab management methods with comprehensive error handling,
 * validation, and integration with the unified Result pattern.
 */
export class TabCommand extends BrowserCommandBase {
  
  /**
   * Focus a tab by pattern matching title or URL
   * 
   * @param options Tab focus options
   * @returns Promise resolving to tab action data or error
   * 
   * @example
   * ```typescript
   * // Focus tab with "GitHub" in title (substring match)
   * const result = await tabCmd.focus({
   *   pattern: 'GitHub'
   * });
   * 
   * // Focus tab by exact URL match
   * const urlResult = await tabCmd.focus({
   *   pattern: 'https://github.com',
   *   exactMatch: true,
   *   windowIndex: 2
   * });
   * ```
   */
  async focus(options: TabFocusOptions): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateFocusOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await focusTabByPattern(
        options.pattern,
        options.windowIndex || 1,
        options.exactMatch || false
      );
      
      return this.convertNavigationResult(libResult, 'focus', options, startTime);
    }, 'tab_focus');
  }
  
  /**
   * Get information about the currently active tab
   * 
   * @param options Tab information options
   * @returns Promise resolving to active tab data or error
   * 
   * @example
   * ```typescript
   * // Get active tab in first window
   * const result = await tabCmd.getActive();
   * 
   * if (result.success) {
   *   console.log('Active tab:', result.data.tab?.title);
   * }
   * ```
   */
  async getActive(options: TabInfoOptions = {}): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateInfoOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await getCurrentPageInfo(options.windowIndex || 1);
      return this.convertTabInfoResult(libResult, 'get_active', options, startTime);
    }, 'tab_get_active');
  }
  
  /**
   * Get all tabs in a Chrome window
   * 
   * @param options Tab list options
   * @returns Promise resolving to list of all tabs or error
   * 
   * @example
   * ```typescript
   * // Get all tabs in first window
   * const result = await tabCmd.list();
   * 
   * if (result.success) {
   *   console.log(`Found ${result.data.tabs?.length} tabs`);
   *   result.data.tabs?.forEach(tab => {
   *     console.log(`Tab ${tab.id}: ${tab.title}`);
   *   });
   * }
   * ```
   */
  async list(options: TabListOptions = {}): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateListOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await getAllTabs(options.windowIndex || 1);
      return this.convertTabListResult(libResult, 'list', options, startTime);
    }, 'tab_list');
  }
  
  /**
   * Focus a tab by its index in a Chrome window
   * 
   * @param options Tab focus index options
   * @returns Promise resolving to focused tab data or error
   * 
   * @example
   * ```typescript
   * // Focus the third tab in first window
   * const result = await tabCmd.focusByIndex({
   *   tabIndex: 3
   * });
   * 
   * if (result.success) {
   *   console.log('Focused tab:', result.data.tab?.title);
   * }
   * ```
   */
  async focusByIndex(options: TabFocusIndexOptions): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateFocusIndexOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await focusTabByIndex(
        options.tabIndex,
        options.windowIndex || 1
      );
      return this.convertAppleScriptTabResult(libResult, 'focus_index', options, startTime);
    }, 'tab_focus_index');
  }
  
  /**
   * Validate tab focus options
   * 
   * @private
   * @param options Options to validate for focusing
   * @returns Validated options or validation error
   */
  private validateFocusOptions(options: TabFocusOptions): Result<void, string> {
    // Validate pattern
    if (!options.pattern || typeof options.pattern !== 'string') {
      return error(
        'Pattern is required and must be a string',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'pattern', operation: 'focus' }
        }
      );
    }
    
    if (options.pattern.trim().length === 0) {
      return error(
        'Pattern cannot be empty',
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'pattern', provided: options.pattern }
        }
      );
    }
    
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Validate tab information options
   * 
   * @private
   * @param options Options to validate for tab info
   * @returns Validated options or validation error
   */
  private validateInfoOptions(options: TabInfoOptions): Result<void, string> {
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Validate tab list options
   * 
   * @private
   * @param options Options to validate for tab listing
   * @returns Validated options or validation error
   */
  private validateListOptions(options: TabListOptions): Result<void, string> {
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Validate tab focus index options
   * 
   * @private
   * @param options Options to validate for tab focusing by index
   * @returns Validated options or validation error
   */
  private validateFocusIndexOptions(options: TabFocusIndexOptions): Result<void, string> {
    // Validate tab index
    if (options.tabIndex < 1 || options.tabIndex > 100) {
      return error(
        `Invalid tabIndex: ${options.tabIndex}. Must be between 1 and 100`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'tabIndex',
            provided: options.tabIndex,
            range: '1-100'
          }
        }
      );
    }
    
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Convert navigation result to service Result pattern
   * 
   * @private
   * @param libResult Result from navigation library
   * @param action Action performed
   * @param options Original options for metadata
   * @param startTime Operation start time for duration calculation
   * @returns Converted result with unified error handling
   */
  private convertNavigationResult(
    libResult: NavigationResult,
    action: string,
    options: TabFocusOptions,
    startTime: number
  ): TabCommandData {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      throw error(
        libResult.error || 'Tab operation failed',
        libResult.code,
        {
          recoveryHint: this.getRecoveryHint(libResult.code),
          durationMs: duration,
          metadata: {
            operation: action,
            originalCode: libResult.code,
            pattern: options.pattern
          }
        }
      );
    }
    
    // Build successful result data
    const tabData: TabCommandData = {
      action,
      ...(options.pattern && { pattern: options.pattern }),
      ...(options.exactMatch !== undefined && { exactMatch: options.exactMatch }),
      ...(libResult.title && libResult.url && {
        tab: {
          id: 0, // Navigation result doesn't include tab ID
          title: libResult.title,
          url: libResult.url,
          ...(libResult.loading !== undefined && { loading: libResult.loading })
        }
      }),
      metadata: {
        timestamp: new Date().toISOString(),
        windowIndex: options.windowIndex || 1
      }
    };
    
    return tabData;
  }
  
  /**
   * Convert tab info result to service Result pattern
   * 
   * @private
   * @param libResult Result from navigation library
   * @param action Action performed
   * @param options Original options for metadata
   * @param startTime Operation start time for duration calculation
   * @returns Converted result with unified error handling
   */
  private convertTabInfoResult(
    libResult: NavigationResult,
    action: string,
    options: TabInfoOptions,
    startTime: number
  ): TabCommandData {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      throw error(
        libResult.error || 'Failed to get tab information',
        libResult.code,
        {
          recoveryHint: this.getRecoveryHint(libResult.code),
          durationMs: duration,
          metadata: {
            operation: action,
            originalCode: libResult.code
          }
        }
      );
    }
    
    // Build successful result data
    const tabData: TabCommandData = {
      action,
      ...(libResult.title && libResult.url && {
        tab: {
          id: 0, // NavigationResult doesn't include tab ID
          title: libResult.title,
          url: libResult.url,
          ...(libResult.loading !== undefined && { loading: libResult.loading })
        }
      }),
      metadata: {
        timestamp: new Date().toISOString(),
        windowIndex: options.windowIndex || 1
      }
    };
    
    return tabData;
  }
  
  /**
   * Convert tab list result to service Result pattern
   * 
   * @private
   * @param libResult Result from AppleScript service
   * @param action Action performed
   * @param options Original options for metadata
   * @param startTime Operation start time for duration calculation
   * @returns Converted result with unified error handling
   */
  private convertTabListResult(
    libResult: { success: boolean; data?: unknown; error?: string; code: number },
    action: string,
    options: TabListOptions,
    startTime: number
  ): TabCommandData {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      throw error(
        libResult.error || 'Failed to get tab list',
        libResult.code,
        {
          recoveryHint: this.getRecoveryHint(libResult.code),
          durationMs: duration,
          metadata: {
            operation: action,
            originalCode: libResult.code
          }
        }
      );
    }
    
    const tabs = (libResult.data || []) as Array<{
      id: number;
      title: string;
      url: string;
      loading: boolean;
      windowId: number;
    }>;
    
    // Build successful result data
    const tabData: TabCommandData = {
      action,
      tabs,
      metadata: {
        timestamp: new Date().toISOString(),
        windowIndex: options.windowIndex || 1,
        totalTabs: tabs.length
      }
    };
    
    return tabData;
  }
  
  /**
   * Convert AppleScript tab result to service Result pattern
   * 
   * @private
   * @param libResult Result from AppleScript service
   * @param action Action performed
   * @param options Original options for metadata
   * @param startTime Operation start time for duration calculation
   * @returns Converted result with unified error handling
   */
  private convertAppleScriptTabResult(
    libResult: { success: boolean; data?: unknown; error?: string; code: number },
    action: string,
    options: TabFocusIndexOptions,
    startTime: number
  ): TabCommandData {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      throw error(
        libResult.error || 'Tab operation failed',
        libResult.code,
        {
          recoveryHint: this.getRecoveryHint(libResult.code),
          durationMs: duration,
          metadata: {
            operation: action,
            originalCode: libResult.code,
            tabIndex: options.tabIndex
          }
        }
      );
    }
    
    const tabInfo = libResult.data as {
      id: number;
      title: string;
      url: string;
      loading: boolean;
      windowId: number;
    };
    
    // Build successful result data
    const tabData: TabCommandData = {
      action,
      tabIndex: options.tabIndex,
      tab: {
        id: tabInfo.id,
        title: tabInfo.title,
        url: tabInfo.url,
        loading: tabInfo.loading
      },
      metadata: {
        timestamp: new Date().toISOString(),
        windowIndex: options.windowIndex || 1
      }
    };
    
    return tabData;
  }
  
  /**
   * Get recovery hint based on error code
   * 
   * @private
   * @param code Error code from library
   * @returns Appropriate recovery strategy
   */
  private getRecoveryHint(code: number): 'retry' | 'permission' | 'check_target' | 'not_recoverable' {
    switch (code) {
      case 20: // TARGET_NOT_FOUND
        return 'check_target';
      case 30: // PERMISSION_DENIED
        return 'permission';
      case 40: // TIMEOUT
        return 'retry';
      case 50: // CHROME_NOT_FOUND
        return 'not_recoverable';
      default:
        return 'retry';
    }
  }
}