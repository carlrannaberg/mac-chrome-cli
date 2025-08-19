/**
 * @fileoverview AppleScript service interface definitions
 * 
 * This module defines the service contract for AppleScript execution,
 * providing type-safe interfaces for Chrome browser automation via AppleScript.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import type { ErrorCode, Result } from '../core/index.js';

/**
 * AppleScript execution result using the unified Result<T,E> pattern.
 * Provides type-safe error handling for all AppleScript operations.
 * 
 * @template T - The type of the success result data
 */
export type AppleScriptResult<T = unknown> = Result<T, string>;

/**
 * Legacy AppleScript result interface maintained for backward compatibility.
 * 
 * @deprecated Use AppleScriptResult (Result<T, string>) instead
 * @template T - The type of the result data
 */
export interface LegacyAppleScriptResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data (if successful) */
  result?: T;
  /** Error message (if failed) */
  error?: string;
  /** Error code for categorization */
  code: ErrorCode;
}

/**
 * Window bounds information for Chrome windows.
 * Coordinates are in screen pixels from the top-left corner.
 * 
 * @interface WindowBounds
 * @example
 * ```typescript
 * const bounds: WindowBounds = {
 *   x: 100,        // Left edge from screen left
 *   y: 50,         // Top edge from screen top  
 *   width: 1200,   // Window width in pixels
 *   height: 800    // Window height in pixels
 * };
 * ```
 */
export interface WindowBounds {
  /** X coordinate of the window's left edge */
  x: number;
  /** Y coordinate of the window's top edge */
  y: number;
  /** Width of the window in pixels */
  width: number;
  /** Height of the window in pixels */
  height: number;
}

/**
 * Chrome window metadata and properties.
 * Contains window identification, title, bounds, and visibility state.
 * 
 * @interface ChromeWindow
 * @example
 * ```typescript
 * const window: ChromeWindow = {
 *   id: 1,
 *   title: 'Google Chrome',
 *   bounds: { x: 100, y: 50, width: 1200, height: 800 },
 *   visible: true
 * };
 * ```
 */
export interface ChromeWindow {
  /** Unique window identifier */
  id: number;
  /** Window title as displayed in the title bar */
  title: string;
  /** Window position and size information */
  bounds: WindowBounds;
  /** Whether the window is currently visible */
  visible: boolean;
}

/**
 * Chrome tab metadata and properties.
 * Contains tab identification, content information, and loading state.
 * 
 * @interface ChromeTab
 * @example
 * ```typescript
 * const tab: ChromeTab = {
 *   id: 123,
 *   title: 'Example Page',
 *   url: 'https://example.com',
 *   loading: false,
 *   windowId: 1
 * };
 * ```
 */
export interface ChromeTab {
  /** Unique tab identifier */
  id: number;
  /** Tab title (usually page title) */
  title: string;
  /** Current URL of the tab */
  url: string;
  /** Whether the tab is currently loading */
  loading: boolean;
  /** ID of the window containing this tab */
  windowId: number;
}

/**
 * Options for configuring AppleScript execution behavior.
 * Controls timeouts, targeting, and performance optimizations.
 * 
 * @interface ScriptExecutionOptions
 * @example
 * ```typescript
 * const options: ScriptExecutionOptions = {
 *   timeout: 15000,     // 15 second timeout
 *   tabIndex: 2,        // Target second tab
 *   windowIndex: 1,     // In first window
 *   useCache: true      // Enable result caching
 * };
 * ```
 */
export interface ScriptExecutionOptions {
  /** Execution timeout in milliseconds (default varies by operation) */
  timeout?: number;
  /** Target tab index (1-based, default: active tab) */
  tabIndex?: number;
  /** Target window index (1-based, default: frontmost window) */
  windowIndex?: number;
  /** Whether to use caching for performance (default: true) */
  useCache?: boolean;
}

/**
 * Service interface for AppleScript-based Chrome browser automation.
 * 
 * This interface defines the contract for executing AppleScript commands,
 * JavaScript in browser contexts, and managing Chrome windows and tabs.
 * Implementations should provide caching, connection pooling, and security features.
 * 
 * @interface IAppleScriptService
 * @example
 * ```typescript
 * class MyAppleScriptService implements IAppleScriptService {
 *   async executeScript(script: string) {
 *     // Implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface IAppleScriptService {
  /**
   * Executes raw AppleScript code with comprehensive error handling and data sanitization.
   * 
   * This method provides direct AppleScript execution capabilities with security
   * measures to prevent malicious code execution and data leaks.
   * 
   * @param script - The AppleScript code to execute
   * @param timeout - Optional execution timeout in milliseconds
   * @returns Promise resolving to the script output or error details
   * 
   * @example
   * ```typescript
   * const result = await service.executeScript(`
   *   tell application "Google Chrome"
   *     get URL of active tab of first window
   *   end tell
   * `, 5000);
   * 
   * if (result.success) {
   *   console.log('Current URL:', result.data);
   * }
   * ```
   */
  executeScript(script: string, timeout?: number): Promise<AppleScriptResult<string>>;
  
  /**
   * Executes JavaScript code in a Chrome tab via AppleScript bridge.
   * 
   * This method provides a secure way to run JavaScript in browser contexts,
   * with automatic result serialization and type-safe return handling.
   * 
   * @template T - The expected type of the JavaScript result
   * @param javascript - JavaScript code to execute in the browser
   * @param options - Execution options including timeout and targeting
   * @returns Promise resolving to the JavaScript execution result
   * 
   * @example
   * ```typescript
   * // Simple DOM query
   * const title = await service.executeJavaScript<string>(
   *   'document.title'
   * );
   * 
   * // Complex operation with options
   * const elements = await service.executeJavaScript<Array<{id: string}>>(
   *   'Array.from(document.querySelectorAll("[id]")).map(el => ({id: el.id}))',
   *   { timeout: 10000, tabIndex: 2 }
   * );
   * ```
   */
  executeJavaScript<T = unknown>(
    javascript: string, 
    options?: ScriptExecutionOptions
  ): Promise<AppleScriptResult<T>>;
  
  /**
   * Retrieves Chrome window bounds and metadata information.
   * 
   * @param windowIndex - Optional window index (1-based, default: frontmost)
   * @returns Promise resolving to window information including bounds and visibility
   * 
   * @example
   * ```typescript
   * const windowInfo = await service.getChromeWindowBounds(1);
   * if (windowInfo.success) {
   *   const { bounds, title, visible } = windowInfo.data;
   *   console.log(`Window "${title}" is at ${bounds.x},${bounds.y}`);
   * }
   * ```
   */
  getChromeWindowBounds(windowIndex?: number): Promise<AppleScriptResult<ChromeWindow>>;
  
  /**
   * Retrieves information about the currently active Chrome tab.
   * 
   * @param windowIndex - Optional window index (1-based, default: frontmost)
   * @returns Promise resolving to active tab information
   * 
   * @example
   * ```typescript
   * const tabInfo = await service.getActiveTab();
   * if (tabInfo.success) {
   *   console.log(`Active tab: ${tabInfo.data.title} - ${tabInfo.data.url}`);
   * }
   * ```
   */
  getActiveTab(windowIndex?: number): Promise<AppleScriptResult<ChromeTab>>;
  
  /**
   * Checks if Google Chrome is currently running and accessible.
   * 
   * This method performs a lightweight check to determine Chrome availability
   * without triggering permissions dialogs or launching Chrome.
   * 
   * @returns Promise resolving to true if Chrome is running and accessible
   * 
   * @example
   * ```typescript
   * if (await service.isChromeRunning()) {
   *   console.log('Chrome is available for automation');
   * } else {
   *   console.log('Please launch Chrome first');
   * }
   * ```
   */
  isChromeRunning(): Promise<boolean>;
  
  /**
   * Brings a Chrome window to the foreground and gives it focus.
   * 
   * @param windowIndex - Optional window index (1-based, default: frontmost)
   * @returns Promise resolving to true if the window was successfully focused
   * 
   * @example
   * ```typescript
   * const focused = await service.focusChromeWindow(2);
   * if (focused.success && focused.data) {
   *   console.log('Successfully focused Chrome window');
   * }
   * ```
   */
  focusChromeWindow(windowIndex?: number): Promise<AppleScriptResult<boolean>>;
  
  /**
   * Retrieves all tabs in a Chrome window.
   * 
   * @param windowIndex - Optional window index (1-based, default: frontmost)
   * @returns Promise resolving to array of all tabs in the specified window
   * 
   * @example
   * ```typescript
   * const tabsResult = await service.getAllTabs(1);
   * if (tabsResult.success) {
   *   tabsResult.data.forEach(tab => {
   *     console.log(`Tab ${tab.id}: ${tab.title} - ${tab.url}`);
   *   });
   * }
   * ```
   */
  getAllTabs(windowIndex?: number): Promise<AppleScriptResult<ChromeTab[]>>;
  
  /**
   * Focuses a specific tab by its index in a Chrome window.
   * 
   * @param tabIndex - Tab index to focus (1-based)
   * @param windowIndex - Optional window index (1-based, default: frontmost)
   * @returns Promise resolving to the focused tab information
   * 
   * @example
   * ```typescript
   * const focusResult = await service.focusTabByIndex(3, 1);
   * if (focusResult.success) {
   *   console.log(`Focused tab: ${focusResult.data.title}`);
   * }
   * ```
   */
  focusTabByIndex(tabIndex: number, windowIndex?: number): Promise<AppleScriptResult<ChromeTab>>;
  
  /**
   * Executes multiple AppleScript operations in batch for improved performance.
   * 
   * This method optimizes multiple operations by reducing IPC overhead
   * and connection management when executing related commands.
   * 
   * @template T - The expected type of the batch results
   * @param operations - Array of operations to execute in batch
   * @returns Promise resolving to array of results for each operation
   * 
   * @example
   * ```typescript
   * const operations = [
   *   { script: 'tell app "Chrome" to get URL of tab 1' },
   *   { script: 'tell app "Chrome" to get title of tab 1' },
   *   { script: 'tell app "Chrome" to get loading of tab 1' }
   * ];
   * 
   * const results = await service.executeBatch(operations);
   * results.forEach((result, index) => {
   *   console.log(`Operation ${index}:`, result.success ? result.data : result.error);
   * });
   * ```
   */
  executeBatch<T = unknown>(
    operations: Array<{
      script: string;
      options?: ScriptExecutionOptions;
    }>
  ): Promise<AppleScriptResult<T>[]>;
  
  /**
   * Clears all internal caches and resets the connection pool.
   * 
   * This method should be called when you want to ensure fresh data
   * or after significant Chrome state changes that might invalidate cached data.
   * 
   * @example
   * ```typescript
   * // After Chrome restart or significant changes
   * service.clearCaches();
   * ```
   */
  clearCaches(): void;
  
  /**
   * Retrieves performance statistics for monitoring and optimization.
   * 
   * These statistics help monitor the effectiveness of caching and
   * connection pooling optimizations.
   * 
   * @returns Object containing performance metrics
   * 
   * @example
   * ```typescript
   * const stats = service.getPerformanceStats();
   * console.log(`Cache hit rate: ${stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100}%`);
   * console.log(`Total executions: ${stats.executionCount}`);
   * ```
   */
  getPerformanceStats(): {
    /** Number of cache hits for compiled scripts */
    cacheHits: number;
    /** Number of cache misses requiring compilation */
    cacheMisses: number;
    /** Number of active connections in the pool */
    activeConnections: number;
    /** Total number of script executions */
    executionCount: number;
  };
}
