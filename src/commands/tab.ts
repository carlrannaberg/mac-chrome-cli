/**
 * @fileoverview Tab command implementation with unified Result<T,E> pattern
 * 
 * This module provides comprehensive tab management functionality using the service-oriented
 * architecture with standardized error handling and result types. Supports all tab operations
 * including listing, focusing, creating, and closing tabs.
 * 
 * @example
 * ```typescript
 * // Focus tab by pattern
 * const result = await tabCmd.focus({ 
 *   match: 'Dashboard'
 * });
 * 
 * // List all tabs
 * const listResult = await tabCmd.list();
 * 
 * // Create new tab
 * const createResult = await tabCmd.create({ url: 'https://example.com' });
 * ```
 * 
 * @author mac-chrome-cli
 * @version 2.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { Result, ok, error } from '../core/Result.js';
import { ErrorCode } from '../core/ErrorCodes.js';

/**
 * Extended error interface with tab command specific properties
 */
interface TabCommandError extends Error {
  errorCode: ErrorCode;
  recoveryHint: string;
  metadata?: Record<string, unknown>;
}
import { 
  getTabs,
  activateTab,
  createTab,
  closeTab,
  switchToTab,
  getActiveTab
} from '../lib/tab-manager.js';

/**
 * Tab focus options supporting multiple targeting methods
 * Supports both legacy pattern-based interface and new multi-method interface
 */
export interface TabFocusOptions {
  /** Pattern to match against tab title or URL (legacy interface) */
  pattern?: string;
  /** Pattern to match against tab title or URL (new interface) */
  match?: string;
  /** Specific tab index to focus (1-based) */
  index?: number;
  /** Specific tab ID to focus */
  tabId?: number;
  /** Target window index (1-based) */
  windowIndex?: number;
  /** Whether to use exact match instead of substring matching */
  exactMatch?: boolean;
  /** Whether to use case sensitive matching */
  caseSensitive?: boolean;
  /** Regular expression pattern for advanced matching */
  regex?: boolean;
}

/**
 * Tab list options
 */
export interface TabListOptions {
  /** Target window index (1-based) */
  windowIndex?: number;
  /** Whether to only return active tabs */
  activeOnly?: boolean;
}

/**
 * Tab creation options
 */
export interface TabCreateOptions {
  /** URL to open in new tab */
  url?: string;
  /** Target window index (1-based) */
  windowIndex?: number;
  /** Whether to activate the new tab */
  activate?: boolean;
  /** Whether to open in background */
  background?: boolean;
}

/**
 * Tab close options supporting multiple targeting methods
 */
export interface TabCloseOptions {
  /** Pattern to match against tab title or URL */
  match?: string;
  /** Specific tab index to close (1-based) */
  index?: number;
  /** Specific tab ID to close */
  tabId?: number;
  /** Target window index (1-based) */
  windowIndex?: number;
  /** Whether to force close even if tab is modified */
  force?: boolean;
}

/**
 * Tab focus by index specific options
 */
export interface TabFocusIndexOptions {
  /** Tab index to focus (1-based) */
  tabIndex: number;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Enhanced tab information
 */
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  active?: boolean;
  loading?: boolean;
  windowId?: number;
}

/**
 * Tab command result data structure
 */
export interface TabCommandData {
  /** Action performed */
  action: string;
  /** Single tab data (for focus/create operations) */
  tab?: TabInfo;
  /** Target tab data (for focus operations) */
  targetTab?: TabInfo;
  /** Closed tab data (for close operations) */
  closedTab?: TabInfo;
  /** Array of tabs (for list operations) */
  tabs?: TabInfo[];
  /** Total number of tabs */
  totalTabs?: number;
  /** ID of active tab */
  activeTabId?: number;
  /** Pattern used for matching */
  pattern?: string;
  /** Match type used */
  matchType?: 'exact' | 'partial' | 'url' | 'regex' | 'id' | 'index' | 'active' | 'current';
  /** Window index targeted */
  windowIndex?: number;
  /** Whether force option was used */
  force?: boolean;
  /** Operation metadata */
  metadata: {
    /** Operation timestamp */
    timestamp: string;
    /** Operation duration in milliseconds */
    durationMs: number;
    /** Window index targeted */
    windowIndex?: number;
    /** Number of tabs searched */
    searchedTabs?: number;
    /** Whether operation was forced */
    forced?: boolean;
  };
}

/**
 * Tab command implementation with comprehensive functionality
 */
export class TabCommand extends BrowserCommandBase {

  /**
   * Focus a tab using various targeting methods
   * 
   * @param options Tab focus options
   * @returns Promise resolving to focused tab data or error
   */
  async focus(options: TabFocusOptions): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateFocusOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }

    return this.executeBrowserCommand(async () => {
      const windowIndex = options.windowIndex || 1;

      // Handle different targeting methods (support both legacy pattern and new interface)
      const pattern = options.pattern || options.match;
      
      if (options.tabId) {
        return await this.focusTabById(options.tabId, windowIndex, startTime);
      } else if (options.index) {
        return await this.focusTabByIndex(options.index, windowIndex, startTime);
      } else if (pattern) {
        return await this.focusTabByPattern(pattern, options, windowIndex, startTime);
      } else {
        const err = new Error('Must provide either match, index, or tabId to target a tab') as TabCommandError;
        err.errorCode = ErrorCode.MISSING_REQUIRED_PARAM;
        err.recoveryHint = 'user_action';
        err.metadata = { operation: 'focus' };
        throw err;
      }
    }, 'tab_focus');
  }

  /**
   * List all tabs in a window
   * 
   * @param options Tab list options
   * @returns Promise resolving to tab list data or error
   */
  async list(options: TabListOptions = {}): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateListOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }

    return this.executeBrowserCommand(async () => {
      const windowIndex = options.windowIndex || 1;
      const tabsResult = await getTabs(windowIndex);
      
      if (!tabsResult.success) {
        const err = new Error(tabsResult.error || 'Failed to get tabs') as TabCommandError;
        err.errorCode = tabsResult.code || ErrorCode.UNKNOWN_ERROR;
        err.recoveryHint = 'retry';
        err.metadata = { operation: 'list', windowIndex };
        throw err;
      }

      let tabs = tabsResult.data || [];
      
      // Apply activeOnly filter if requested
      if (options.activeOnly) {
        tabs = tabs.filter(tab => tab.active === true);
      }

      // Find active tab ID
      const activeTab = tabs.find(tab => tab.active === true);
      const activeTabId = activeTab ? activeTab.id : undefined;

      const duration = Date.now() - startTime;
      return {
        action: 'list',
        tabs: tabs,
        totalTabs: tabs.length,
        activeTabId: activeTabId,
        windowIndex: windowIndex,
        metadata: {
          timestamp: new Date().toISOString(),
          durationMs: duration,
          windowIndex: windowIndex,
          totalTabs: tabs.length
        }
      };
    }, 'tab_list');
  }

  /**
   * Create a new tab
   * 
   * @param options Tab creation options
   * @returns Promise resolving to created tab data or error
   */
  async create(options: TabCreateOptions = {}): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateCreateOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }

    return this.executeBrowserCommand(async () => {
      const windowIndex = options.windowIndex || 1;
      const shouldActivate = options.background ? false : (options.activate !== false);
      
      const createResult = await createTab(options.url, windowIndex, shouldActivate);
      
      if (!createResult.success) {
        throw error(
          createResult.error || 'Failed to create tab',
          createResult.code || ErrorCode.CHROME_NOT_RUNNING,
          {
            recoveryHint: this.getRecoveryHint(createResult.code),
            metadata: { operation: 'create', url: options.url, windowIndex }
          }
        );
      }

      const tabData = createResult.data;
      const duration = Date.now() - startTime;
      
      return {
        action: 'create',
        tab: tabData,
        windowIndex: windowIndex,
        metadata: {
          timestamp: new Date().toISOString(),
          durationMs: duration,
          windowIndex: windowIndex
        }
      };
    }, 'tab_create');
  }

  /**
   * Close a tab using various targeting methods
   * 
   * @param options Tab close options
   * @returns Promise resolving to closed tab data or error
   */
  async close(options: TabCloseOptions = {}): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    return this.executeBrowserCommand(async () => {
      const windowIndex = options.windowIndex || 1;

      // Handle different targeting methods
      if (options.tabId) {
        return await this.closeTabById(options.tabId, windowIndex, options.force, startTime);
      } else if (options.index) {
        return await this.closeTabByIndex(options.index, windowIndex, options.force, startTime);
      } else if (options.match) {
        return await this.closeTabByPattern(options.match, windowIndex, options.force, startTime);
      } else {
        // Close current active tab
        return await this.closeActiveTab(windowIndex, options.force, startTime);
      }
    }, 'tab_close');
  }

  /**
   * Focus tab by index (separate method for test compatibility)
   * 
   * @param options Tab focus index options
   * @returns Promise resolving to focused tab data or error
   */
  async focusByIndex(options: TabFocusIndexOptions): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateFocusIndexOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }

    return this.executeBrowserCommand(async () => {
      const windowIndex = options.windowIndex || 1;
      return await this.focusTabByIndex(options.tabIndex, windowIndex, startTime);
    }, 'tab_focus_index');
  }

  /**
   * Get active tab information (separate method for test compatibility)
   * 
   * @param options Window options
   * @returns Promise resolving to active tab data or error
   */
  async getActive(options: { windowIndex?: number } = {}): Promise<Result<TabCommandData, string>> {
    const startTime = Date.now();
    
    return this.executeBrowserCommand(async () => {
      const windowIndex = options.windowIndex || 1;
      const activeTabResult = await getActiveTab(windowIndex);
      
      if (!activeTabResult.success) {
        throw error(
          activeTabResult.error || 'Failed to get active tab',
          activeTabResult.code || ErrorCode.TARGET_NOT_FOUND,
          {
            recoveryHint: 'check_target',
            metadata: { operation: 'get_active', windowIndex }
          }
        );
      }

      const tabData = activeTabResult.data;
      const duration = Date.now() - startTime;
      
      return {
        action: 'get_active',
        tab: tabData,
        windowIndex: windowIndex,
        metadata: {
          timestamp: new Date().toISOString(),
          durationMs: duration,
          windowIndex: windowIndex
        }
      };
    }, 'tab_get_active');
  }

  // Private helper methods

  private async focusTabById(tabId: number, windowIndex: number, startTime: number): Promise<TabCommandData> {
    const activateResult = await activateTab(tabId, windowIndex);
    
    if (!activateResult.success) {
      throw error(
        activateResult.error || 'Failed to activate tab',
        activateResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry_with_delay',
          metadata: { operation: 'focus', tabId, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'focus',
      targetTab: activateResult.data,
      matchType: 'id',
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex
      }
    };
  }

  private async focusTabByIndex(tabIndex: number, windowIndex: number, startTime: number): Promise<TabCommandData> {
    const activateResult = await activateTab(tabIndex, windowIndex);
    
    if (!activateResult.success) {
      throw error(
        activateResult.error || 'Failed to activate tab',
        activateResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry_with_delay',
          metadata: { operation: 'focus', tabIndex, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'focus_index',
      targetTab: activateResult.data,
      pattern: tabIndex.toString(),
      matchType: 'index',
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex
      }
    };
  }

  private async focusTabByPattern(
    pattern: string, 
    options: TabFocusOptions, 
    windowIndex: number, 
    startTime: number
  ): Promise<TabCommandData> {
    // Get all tabs first
    const tabsResult = await getTabs(windowIndex);
    
    if (!tabsResult.success) {
      throw error(
        tabsResult.error || 'Failed to get tabs',
        tabsResult.code || ErrorCode.UNKNOWN_ERROR,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'focus', pattern, windowIndex }
        }
      );
    }

    const tabs = tabsResult.data || [];
    let matchedTab: TabInfo | undefined;
    let matchType: 'exact' | 'partial' | 'url' | 'regex' = 'partial';

    // Find matching tab
    if (options.regex) {
      try {
        const regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
        matchedTab = tabs.find(tab => regex.test(tab.title) || regex.test(tab.url));
        matchType = 'regex';
      } catch (err) {
        throw error(
          `Invalid regex pattern: ${pattern}`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { pattern, error: err }
          }
        );
      }
    } else {
      // Check for URL match first
      const urlMatch = tabs.find(tab => 
        options.caseSensitive ? 
          tab.url.includes(pattern) : 
          tab.url.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (urlMatch) {
        matchedTab = urlMatch;
        matchType = 'url';
      } else {
        // Then check for title match
        if (options.exactMatch) {
          matchedTab = tabs.find(tab => 
            options.caseSensitive ?
              tab.title === pattern :
              tab.title.toLowerCase() === pattern.toLowerCase()
          );
          matchType = 'exact';
        } else {
          matchedTab = tabs.find(tab => 
            options.caseSensitive ?
              tab.title.includes(pattern) :
              tab.title.toLowerCase().includes(pattern.toLowerCase())
          );
          matchType = 'partial';
        }
      }
    }

    if (!matchedTab) {
      throw error(
        `No tab found matching: ${pattern}`,
        ErrorCode.TARGET_NOT_FOUND,
        {
          recoveryHint: 'check_target',
          metadata: { 
            pattern, 
            searchedTabs: tabs.length,
            matchType: options.exactMatch ? 'exact' : 'partial'
          }
        }
      );
    }

    // Activate the matched tab
    const activateResult = await activateTab(matchedTab.id, windowIndex);
    
    if (!activateResult.success) {
      throw error(
        activateResult.error || 'Failed to activate tab',
        activateResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry_with_delay',
          metadata: { operation: 'focus', pattern, tabId: matchedTab.id, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'focus',
      targetTab: activateResult.data || matchedTab,
      pattern: pattern,
      matchType: matchType,
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex,
        searchedTabs: tabs.length
      }
    };
  }

  private async closeTabById(tabId: number, windowIndex: number, force: boolean = false, startTime: number): Promise<TabCommandData> {
    // Get tab info before closing
    const tabsResult = await getTabs(windowIndex);
    const targetTab = tabsResult.success ? tabsResult.data?.find(t => t.id === tabId) : undefined;

    const closeResult = await closeTab(tabId, windowIndex);
    
    if (!closeResult.success) {
      throw error(
        closeResult.error || 'Failed to close tab',
        closeResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'close', tabId, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'close',
      closedTab: targetTab,
      matchType: 'id',
      force: force,
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex,
        forced: force
      }
    };
  }

  private async closeTabByIndex(index: number, windowIndex: number, force: boolean = false, startTime: number): Promise<TabCommandData> {
    // Get tab info before closing
    const tabsResult = await getTabs(windowIndex);
    if (!tabsResult.success) {
      throw error(
        tabsResult.error || 'Failed to get tabs',
        tabsResult.code || ErrorCode.UNKNOWN_ERROR,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'close', index, windowIndex }
        }
      );
    }

    const tabs = tabsResult.data || [];
    if (index < 1 || index > tabs.length) {
      throw error(
        `Tab index ${index} is out of bounds. Available tabs: ${tabs.length}`,
        ErrorCode.TARGET_NOT_FOUND,
        {
          recoveryHint: 'check_target',
          metadata: { index, availableTabs: tabs.length, windowIndex }
        }
      );
    }

    const targetTab = tabs[index - 1]; // Convert to 0-based
    const closeResult = await closeTab(index, windowIndex);
    
    if (!closeResult.success) {
      throw error(
        closeResult.error || 'Failed to close tab',
        closeResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'close', index, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'close',
      closedTab: targetTab,
      matchType: 'index',
      force: force,
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex,
        forced: force
      }
    };
  }

  private async closeTabByPattern(pattern: string, windowIndex: number, force: boolean = false, startTime: number): Promise<TabCommandData> {
    // Get all tabs first
    const tabsResult = await getTabs(windowIndex);
    
    if (!tabsResult.success) {
      throw error(
        tabsResult.error || 'Failed to get tabs',
        tabsResult.code || ErrorCode.UNKNOWN_ERROR,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'close', pattern, windowIndex }
        }
      );
    }

    const tabs = tabsResult.data || [];
    const matchedTab = tabs.find(tab => 
      tab.title.toLowerCase().includes(pattern.toLowerCase()) ||
      tab.url.toLowerCase().includes(pattern.toLowerCase())
    );

    if (!matchedTab) {
      throw error(
        `No tab found matching: ${pattern}`,
        ErrorCode.TARGET_NOT_FOUND,
        {
          recoveryHint: 'check_target',
          metadata: { pattern, searchedTabs: tabs.length, windowIndex }
        }
      );
    }

    const closeResult = await closeTab(matchedTab.id, windowIndex);
    
    if (!closeResult.success) {
      throw error(
        closeResult.error || 'Failed to close tab',
        closeResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'close', pattern, tabId: matchedTab.id, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'close',
      closedTab: matchedTab,
      matchType: 'pattern',
      force: force,
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex,
        forced: force
      }
    };
  }

  private async closeActiveTab(windowIndex: number, force: boolean = false, startTime: number): Promise<TabCommandData> {
    const activeTabResult = await getActiveTab(windowIndex);
    
    if (!activeTabResult.success) {
      throw error(
        activeTabResult.error || 'Failed to get current active tab: No active tab found',
        activeTabResult.code || ErrorCode.TARGET_NOT_FOUND,
        {
          recoveryHint: 'check_target',
          metadata: { operation: 'close', windowIndex }
        }
      );
    }

    const activeTab = activeTabResult.data;
    const closeResult = await closeTab(activeTab.id, windowIndex);
    
    if (!closeResult.success) {
      throw error(
        closeResult.error || 'Failed to close tab',
        closeResult.code || ErrorCode.UI_AUTOMATION_FAILED,
        {
          recoveryHint: 'retry',
          metadata: { operation: 'close', tabId: activeTab.id, windowIndex }
        }
      );
    }

    const duration = Date.now() - startTime;
    return {
      action: 'close',
      closedTab: activeTab,
      matchType: 'active',
      force: force,
      windowIndex: windowIndex,
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
        windowIndex: windowIndex,
        forced: force
      }
    };
  }

  // Validation methods

  private validateFocusOptions(options: TabFocusOptions): Result<void, string> {
    const pattern = options.pattern || options.match;
    
    // Must provide at least one targeting method (support both pattern and match)
    if (!pattern && !options.index && !options.tabId) {
      return error(
        'Must provide either match, index, or tabId to target a tab',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'user_action',
          metadata: { operation: 'focus' }
        }
      );
    }

    // Validate pattern if provided (legacy pattern parameter)
    if (options.pattern !== undefined) {
      if (typeof options.pattern !== 'string') {
        return error(
          'Pattern is required and must be a string',
          ErrorCode.MISSING_REQUIRED_PARAM,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'pattern' }
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
    }

    // Validate pattern if provided (new match parameter)
    if (options.match !== undefined) {
      if (typeof options.match !== 'string') {
        return error(
          'Pattern is required and must be a string',
          ErrorCode.MISSING_REQUIRED_PARAM,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'match' }
          }
        );
      }

      if (options.match.trim().length === 0) {
        return error(
          'Pattern cannot be empty',
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'match', provided: options.match }
          }
        );
      }
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

  private validateListOptions(options: TabListOptions): Result<void, string> {
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

  private validateCreateOptions(options: TabCreateOptions): Result<void, string> {
    // Validate URL format if provided
    if (options.url) {
      try {
        new URL(options.url);
      } catch (err) {
        return error(
          `Invalid URL format: ${options.url}`,
          ErrorCode.INVALID_URL,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'url', provided: options.url }
          }
        );
      }
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

  private validateFocusIndexOptions(options: TabFocusIndexOptions): Result<void, string> {
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

  private getRecoveryHint(code?: number): 'retry' | 'permission' | 'check_target' | 'not_recoverable' | 'retry_with_delay' | 'user_action' {
    switch (code) {
      case ErrorCode.TARGET_NOT_FOUND:
        return 'check_target';
      case ErrorCode.PERMISSION_DENIED:
        return 'permission';
      case ErrorCode.TIMEOUT:
        return 'retry_with_delay';
      case ErrorCode.CHROME_NOT_RUNNING:
        return 'not_recoverable';
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.INVALID_URL:
        return 'user_action';
      default:
        return 'retry';
    }
  }

  /**
   * Create a custom error with error code and recovery hint
   * 
   * @private
   * @param message Error message
   * @param errorCode Error code
   * @param recoveryHint Recovery hint
   * @param metadata Additional metadata
   * @returns Custom error object
   */
  private createCustomError(
    message: string,
    errorCode: ErrorCode,
    recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' | 'retry_with_delay' | 'user_action',
    metadata?: Record<string, unknown>
  ): TabCommandError {
    const error = new Error(message) as TabCommandError;
    error.errorCode = errorCode;
    error.recoveryHint = recoveryHint;
    error.name = 'TabCommandError';
    if (metadata) {
      error.metadata = metadata;
    }
    return error;
  }

  /**
   * Create and throw error from failed result
   * @private
   */
  private throwFromResult(
    failedResult: { success: false; error?: string; code?: ErrorCode },
    defaultMessage: string,
    defaultCode: ErrorCode,
    recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' | 'retry_with_delay' | 'user_action',
    metadata?: Record<string, unknown>
  ): never {
    const err = new Error(failedResult.error || defaultMessage) as TabCommandError;
    err.errorCode = failedResult.code || defaultCode;
    err.recoveryHint = recoveryHint;
    err.metadata = metadata;
    throw err;
  }
}