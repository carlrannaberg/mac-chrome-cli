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
  /** Alternative name for regex pattern matching */
  useRegex?: boolean;
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
  /** New tab data (for create operations) */
  newTab?: TabInfo;
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
  /** URL for create operations */
  url?: string;
  /** Whether tab should be activated for create operations */
  activate?: boolean;
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
    /** Whether multiple matches were found */
    multipleMatches?: boolean;
    /** Total number of matches found */
    totalMatches?: number;
    /** Total number of tabs (for list metadata) */
    totalTabs?: number;
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
        err.name = 'TabCommandError';
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
        const err = new Error(`Failed to create tab: ${createResult.error || 'Failed to create tab'}`) as TabCommandError;
        err.errorCode = createResult.code || ErrorCode.CHROME_NOT_RUNNING;
        err.recoveryHint = this.getRecoveryHint(createResult.code);
        err.name = 'TabCommandError';
        err.metadata = { operation: 'create', url: options.url, windowIndex };
        throw err;
      }

      const tabData = createResult.data;
      const duration = Date.now() - startTime;
      
      return {
        action: 'create',
        newTab: tabData,
        tab: tabData, // Keep backward compatibility
        url: options.url,
        activate: shouldActivate,
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
    
    // Validate options
    const validationResult = this.validateCloseOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<TabCommandData, string>;
    }
    
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
        const err = new Error(activeTabResult.error || 'Failed to get active tab') as TabCommandError;
        err.errorCode = activeTabResult.code || ErrorCode.TARGET_NOT_FOUND;
        err.recoveryHint = 'check_target';
        err.metadata = { operation: 'get_active', windowIndex };
        throw err;
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
      const err = new Error(`Failed to activate tab: ${activateResult.error || 'Failed to activate tab'}`) as TabCommandError;
      err.errorCode = activateResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry_with_delay';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'focus', tabId, windowIndex };
      throw err;
    }

    const duration = Date.now() - startTime;
    return {
      action: 'focus',
      targetTab: activateResult.data,
      pattern: tabId.toString(),
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
    // First check if index is valid by getting tab list
    const tabsResult = await getTabs(windowIndex);
    if (!tabsResult.success) {
      const err = new Error(tabsResult.error || 'Failed to get tabs') as TabCommandError;
      err.errorCode = tabsResult.code || ErrorCode.UNKNOWN_ERROR;
      err.recoveryHint = 'retry';
      err.metadata = { operation: 'focus', tabIndex, windowIndex };
      throw err;
    }

    const tabs = tabsResult.data || [];
    if (tabIndex < 1 || tabIndex > tabs.length) {
      const err = new Error(`Tab index ${tabIndex} is out of bounds. Available tabs: ${tabs.length}`) as TabCommandError;
      err.errorCode = ErrorCode.TARGET_NOT_FOUND;
      err.recoveryHint = 'check_target';
      err.metadata = { tabIndex, availableTabs: tabs.length, windowIndex };
      throw err;
    }

    const activateResult = await activateTab(tabIndex, windowIndex);
    
    if (!activateResult.success) {
      const err = new Error(activateResult.error || 'Failed to activate tab') as TabCommandError;
      err.errorCode = activateResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry_with_delay';
      err.metadata = { operation: 'focus', tabIndex, windowIndex };
      throw err;
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
      const err = new Error(tabsResult.error || 'Failed to get tabs') as TabCommandError;
      err.errorCode = tabsResult.code || ErrorCode.UNKNOWN_ERROR;
      err.recoveryHint = 'retry';
      err.metadata = { operation: 'focus', pattern, windowIndex };
      throw err;
    }

    const tabs = tabsResult.data || [];
    let matchedTab: TabInfo | undefined;
    let matchType: 'exact' | 'partial' | 'url' | 'regex' = 'partial';
    let allMatches: TabInfo[] = [];

    // Find matching tab
    if (options.regex || options.useRegex) {
      try {
        const regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
        allMatches = tabs.filter(tab => regex.test(tab.title) || regex.test(tab.url));
        matchedTab = allMatches[0]; // Take first match
        matchType = 'regex';
      } catch (originalErr) {
        const err = new Error(`Invalid regex pattern: ${pattern}`) as TabCommandError;
        err.errorCode = ErrorCode.INVALID_INPUT;
        err.recoveryHint = 'user_action';
        err.metadata = { pattern, error: originalErr };
        throw err;
      }
    } else {
      // Check for title match first (prioritize title over URL)
      if (options.exactMatch) {
        // When exactMatch is true, use word boundary matching
        const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, options.caseSensitive ? 'g' : 'gi');
        const exactMatches = tabs.filter(tab => regex.test(tab.title));
        
        if (exactMatches.length > 0) {
          allMatches = exactMatches;
          matchedTab = exactMatches[0];
          matchType = 'exact';
        } else {
          // No matches found with word boundary matching
          allMatches = [];
          matchType = 'exact';
        }
      } else {
        // First try literal exact match for auto-detection
        const literalExactMatches = tabs.filter(tab => 
          options.caseSensitive ?
            tab.title === pattern :
            tab.title.toLowerCase() === pattern.toLowerCase()
        );
        
        if (literalExactMatches.length > 0) {
          allMatches = literalExactMatches;
          matchedTab = literalExactMatches[0];
          matchType = 'exact';
        } else {
          // Try partial match
          const partialMatches = tabs.filter(tab => 
            options.caseSensitive ?
              tab.title.includes(pattern) :
              tab.title.toLowerCase().includes(pattern.toLowerCase())
          );
          
          if (partialMatches.length > 0) {
            allMatches = partialMatches;
            matchedTab = partialMatches[0];
            matchType = 'partial';
          } else {
            // If no title match, then check for URL match
            const urlMatches = tabs.filter(tab => 
              options.caseSensitive ? 
                tab.url.includes(pattern) : 
                tab.url.toLowerCase().includes(pattern.toLowerCase())
            );
            
            if (urlMatches.length > 0) {
              allMatches = urlMatches;
              matchedTab = urlMatches[0];
              matchType = 'url';
            }
          }
        }
      }
    }

    if (!matchedTab) {
      const err = new Error(`No tab found matching: ${pattern}`) as TabCommandError;
      err.errorCode = ErrorCode.TARGET_NOT_FOUND;
      err.recoveryHint = 'check_target';
      err.name = 'TabCommandError';
      err.metadata = { 
        pattern, 
        searchedTabs: tabs.length,
        matchType: options.exactMatch ? 'exact' : 'partial'
      };
      throw err;
    }

    // Activate the matched tab
    const activateResult = await activateTab(matchedTab.id, windowIndex);
    
    if (!activateResult.success) {
      const err = new Error(`Failed to activate tab: ${activateResult.error || 'Failed to activate tab'}`) as TabCommandError;
      err.errorCode = activateResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry_with_delay';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'focus', pattern, tabId: matchedTab.id, windowIndex };
      throw err;
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
        searchedTabs: tabs.length,
        multipleMatches: allMatches.length > 1,
        totalMatches: allMatches.length
      }
    };
  }

  private async closeTabById(tabId: number, windowIndex: number, force: boolean = false, startTime: number): Promise<TabCommandData> {
    // Get tab info before closing
    const tabsResult = await getTabs(windowIndex);
    const targetTab = tabsResult.success ? tabsResult.data?.find(t => t.id === tabId) : undefined;

    const closeResult = await closeTab(tabId, windowIndex);
    
    if (!closeResult.success) {
      const err = new Error(`Failed to close tab: ${closeResult.error || 'Failed to close tab'}`) as TabCommandError;
      err.errorCode = closeResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'close', tabId, windowIndex };
      throw err;
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
      const err = new Error(tabsResult.error || 'Failed to get tabs') as TabCommandError;
      err.errorCode = tabsResult.code || ErrorCode.UNKNOWN_ERROR;
      err.recoveryHint = 'retry';
      err.metadata = { operation: 'close', index, windowIndex };
      throw err;
    }

    const tabs = tabsResult.data || [];
    if (index < 1 || index > tabs.length) {
      const err = new Error(`Tab index ${index} is out of bounds. Available tabs: ${tabs.length}`) as TabCommandError;
      err.errorCode = ErrorCode.TARGET_NOT_FOUND;
      err.recoveryHint = 'check_target';
      err.metadata = { index, availableTabs: tabs.length, windowIndex };
      throw err;
    }

    const targetTab = tabs[index - 1]; // Convert to 0-based
    const closeResult = await closeTab(index, windowIndex);
    
    if (!closeResult.success) {
      const err = new Error(`Failed to close tab: ${closeResult.error || 'Failed to close tab'}`) as TabCommandError;
      err.errorCode = closeResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'close', index, windowIndex };
      throw err;
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
      const err = new Error(tabsResult.error || 'Failed to get tabs') as TabCommandError;
      err.errorCode = tabsResult.code || ErrorCode.UNKNOWN_ERROR;
      err.recoveryHint = 'retry';
      err.metadata = { operation: 'close', pattern, windowIndex };
      throw err;
    }

    const tabs = tabsResult.data || [];
    const matchedTab = tabs.find(tab => 
      tab.title.toLowerCase().includes(pattern.toLowerCase()) ||
      tab.url.toLowerCase().includes(pattern.toLowerCase())
    );

    if (!matchedTab) {
      const err = new Error(`No tab found matching: ${pattern}`) as TabCommandError;
      err.errorCode = ErrorCode.TARGET_NOT_FOUND;
      err.recoveryHint = 'check_target';
      err.metadata = { pattern, searchedTabs: tabs.length, windowIndex };
      throw err;
    }

    const closeResult = await closeTab(matchedTab.id, windowIndex);
    
    if (!closeResult.success) {
      const err = new Error(`Failed to close tab: ${closeResult.error || 'Failed to close tab'}`) as TabCommandError;
      err.errorCode = closeResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'close', pattern, tabId: matchedTab.id, windowIndex };
      throw err;
    }

    const duration = Date.now() - startTime;
    return {
      action: 'close',
      closedTab: matchedTab,
      pattern: pattern,
      matchType: 'exact',
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
      const err = new Error(`Failed to get current active tab: ${activeTabResult.error || 'No active tab found'}`) as TabCommandError;
      err.errorCode = activeTabResult.code || ErrorCode.TARGET_NOT_FOUND;
      err.recoveryHint = 'check_target';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'close', windowIndex };
      throw err;
    }

    const activeTab = activeTabResult.data;
    const closeResult = await closeTab(activeTab.id, windowIndex);
    
    if (!closeResult.success) {
      const err = new Error(`Failed to close tab: ${closeResult.error || 'Failed to close tab'}`) as TabCommandError;
      err.errorCode = closeResult.code || ErrorCode.UI_AUTOMATION_FAILED;
      err.recoveryHint = 'retry';
      err.name = 'TabCommandError';
      err.metadata = { operation: 'close', tabId: activeTab.id, windowIndex };
      throw err;
    }

    const duration = Date.now() - startTime;
    return {
      action: 'close',
      closedTab: activeTab,
      matchType: 'current',
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
    const hasPattern = pattern !== undefined && pattern !== null;
    const hasIndex = options.index !== undefined && options.index !== null;
    const hasTabId = options.tabId !== undefined && options.tabId !== null;
    const criteriaCount = [hasPattern, hasIndex, hasTabId].filter(Boolean).length;
    
    // Must provide exactly one targeting method
    if (criteriaCount === 0) {
      return error(
        'Must provide either match, index, or tabId to target a tab',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'user_action',
          metadata: { operation: 'focus' }
        }
      );
    }
    
    // Cannot provide multiple targeting criteria
    if (criteriaCount > 1) {
      return error(
        'Cannot specify multiple targeting criteria. Use only one of: match, index, or tabId',
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            operation: 'focus',
            provided: { pattern: hasPattern, index: hasIndex, tabId: hasTabId }
          }
        }
      );
    }
    
    // Validate index if provided
    if (options.index !== undefined) {
      if (!Number.isInteger(options.index) || options.index < 1) {
        return error(
          `Invalid tab index: ${options.index}. Must be a positive integer (1-based)`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'index', provided: options.index }
          }
        );
      }
    }
    
    // Validate tabId if provided
    if (options.tabId !== undefined) {
      if (!Number.isInteger(options.tabId) || options.tabId < 1) {
        return error(
          `Invalid tab ID: ${options.tabId}. Must be a positive integer`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'tabId', provided: options.tabId }
          }
        );
      }
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
          'Match pattern cannot be empty',
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'match', provided: options.match }
          }
        );
      }
    }

    // Validate regex pattern if using regex mode
    if ((options.regex || options.useRegex) && pattern) {
      try {
        new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
      } catch (err) {
        return error(
          `Invalid regex pattern: ${pattern}`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'match', provided: pattern }
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
          recoveryHint: 'not_recoverable',
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

  private validateCloseOptions(options: TabCloseOptions): Result<void, string> {
    const hasMatch = options.match !== undefined && options.match !== null;
    const hasIndex = options.index !== undefined && options.index !== null;
    const hasTabId = options.tabId !== undefined && options.tabId !== null;
    
    // Validate index if provided
    if (options.index !== undefined) {
      if (!Number.isInteger(options.index) || options.index < 1) {
        return error(
          `Invalid tab index: ${options.index}. Must be a positive integer (1-based)`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'index', provided: options.index }
          }
        );
      }
    }
    
    // Validate tabId if provided
    if (options.tabId !== undefined) {
      if (!Number.isInteger(options.tabId) || options.tabId < 1) {
        return error(
          `Invalid tab ID: ${options.tabId}. Must be a positive integer`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { parameter: 'tabId', provided: options.tabId }
          }
        );
      }
    }

    // Validate match pattern if provided
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
          'Match pattern cannot be empty',
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
          recoveryHint: 'not_recoverable',
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
          recoveryHint: 'not_recoverable',
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
          recoveryHint: 'not_recoverable',
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
        return 'retry'; // Changed from 'not_recoverable' to match test expectations
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
    err.name = 'TabCommandError';
    err.metadata = metadata;
    throw err;
  }
}