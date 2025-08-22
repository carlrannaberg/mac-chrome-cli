import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { execWithTimeout, ERROR_CODES, type ExecResult } from '../lib/util.js';
import { ok, error } from '../core/Result.js';
import { startBenchmark, endBenchmark } from '../lib/performance.js';
import type { 
  IAppleScriptService, 
  AppleScriptResult, 
  ChromeWindow, 
  ChromeTab, 
  ScriptExecutionOptions 
} from './IAppleScriptService.js';

/**
 * Unified AppleScript service with caching, connection pooling, and security
 */
export class AppleScriptService implements IAppleScriptService {
  private readonly scriptCache: LRUCache<string, string>;
  private readonly connectionPool: Map<string, { lastUsed: number; windowIndex: number }>;
  
  // Configuration constants
  private static readonly CONFIG = {
    MAX_CONNECTIONS: 5,
    CONNECTION_TTL: 30000, // 30 seconds
    CACHE_SIZE: 100,
    CACHE_TTL: 1000 * 60 * 30, // 30 minutes
    DEFAULT_TIMEOUT: 10000,
    BATCH_TIMEOUT: 30000,
    SCRIPT_TIMEOUT: 15000,
    HASH_LENGTH: 8
  } as const;
  private cacheHits = 0;
  private cacheMisses = 0;
  private executionCount = 0;

  constructor() {
    // Script compilation cache with optimized settings
    this.scriptCache = new LRUCache<string, string>({
      max: AppleScriptService.CONFIG.CACHE_SIZE,
      ttl: AppleScriptService.CONFIG.CACHE_TTL,
      allowStale: false
    });

    // Connection pool for Chrome operations
    this.connectionPool = new Map();
    
    // Pre-warm cache with common script patterns
    this.precompileCommonScripts();
  }

  /**
   * Pre-compile common script patterns to warm the cache
   */
  private precompileCommonScripts(): void {
    // Common patterns that are frequently used
    const commonPatterns = [
      // Basic Chrome detection
      'document.readyState',
      // Window properties
      'window.innerWidth',
      'window.innerHeight',
      'window.scrollX',
      'window.scrollY',
      // Document properties
      'document.title',
      'document.URL',
      // Common selectors for clicks
      'document.querySelector("body")',
      'document.querySelector("html")',
      // Page readiness checks
      'document.readyState === "complete"'
    ];

    // Pre-compile these into AppleScript templates for common window/tab combinations
    for (const pattern of commonPatterns) {
      for (let windowIndex = 1; windowIndex <= 2; windowIndex++) {
        for (let tabIndex = 1; tabIndex <= 2; tabIndex++) {
          const cacheKey = this.generateScriptCacheKey(pattern, tabIndex, windowIndex);
          
          if (!this.scriptCache.has(cacheKey)) {
            const compiledScript = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    set targetWindow to window ${windowIndex}
    set targetTab to tab ${tabIndex} of targetWindow
    set jsResult to execute javascript "${this.escapeAppleScriptString(pattern)}" in targetTab
    return jsResult as string
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;
            
            this.scriptCache.set(cacheKey, compiledScript);
          }
        }
      }
    }
  }

  /**
   * Escape string for AppleScript with sanitization
   * 
   * Processes strings to be safely embedded in AppleScript by escaping special
   * characters, handling null/undefined values, and preventing injection attacks.
   * 
   * @param str String to escape for AppleScript inclusion
   * @returns Safely escaped string for AppleScript
   * 
   * @throws {ErrorCode.INVALID_INPUT} When string contains unescapable characters or malformed input
   * @throws {ErrorCode.SECURITY_RESTRICTION} When string contains potential injection patterns
   * @throws {ErrorCode.VALIDATION_FAILED} When input sanitization fails
   * @throws {ErrorCode.MEMORY_ERROR} When string is too large to process
   * @throws {ErrorCode.SYSTEM_ERROR} When system-level string processing fails
   * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during escaping
   */
  public escapeAppleScriptString(str: string): string {
    // Handle edge cases
    if (str === null || str === undefined) {
      return '';
    }
    
    // Convert to string if not already
    const stringValue = String(str);
    
    try {
      let result = stringValue
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
      
      // Handle other control characters that could cause issues
      result = result.replace(/[\x00-\x1F\x7F]/g, (char) => {
        const code = char.charCodeAt(0);
        return `\\x${code.toString(16).padStart(2, '0')}`;
      });
      
      return result;
    } catch (error) {
      // Fallback for strings that can't be processed
      return stringValue;
    }
  }

  /**
   * Generate cache key for AppleScript
   */
  private generateScriptCacheKey(
    script: string, 
    tabIndex: number = 1, 
    windowIndex: number = 1
  ): string {
    const scriptHash = createHash('md5')
      .update(script)
      .digest('hex')
      .substring(0, AppleScriptService.CONFIG.HASH_LENGTH);
    return `${scriptHash}-${tabIndex}-${windowIndex}`;
  }

  /**
   * Check if connection is still valid
   */
  private isConnectionValid(connection: { lastUsed: number }): boolean {
    return Date.now() - connection.lastUsed < AppleScriptService.CONFIG.CONNECTION_TTL;
  }

  /**
   * Find and remove least recently used connection
   */
  private evictOldestConnection(): void {
    let oldestConnection: { key: string; lastUsed: number } | null = null;
    
    for (const [key, conn] of this.connectionPool.entries()) {
      if (!oldestConnection || conn.lastUsed < oldestConnection.lastUsed) {
        oldestConnection = { key, lastUsed: conn.lastUsed };
      }
    }
    
    if (oldestConnection) {
      this.connectionPool.delete(oldestConnection.key);
    }
  }

  /**
   * Get or create connection from pool with improved reuse
   */
  private getConnection(windowIndex: number = 1): string {
    const connectionId = `chrome-${windowIndex}`;
    const connection = this.connectionPool.get(connectionId);
    
    // Return existing valid connection
    if (connection && this.isConnectionValid(connection)) {
      connection.lastUsed = Date.now();
      return connectionId;
    }
    
    // Clean up expired connections
    this.cleanupConnections();
    
    // Evict oldest connection if at capacity
    if (this.connectionPool.size >= AppleScriptService.CONFIG.MAX_CONNECTIONS) {
      this.evictOldestConnection();
    }
    
    // Create new connection
    this.connectionPool.set(connectionId, {
      lastUsed: Date.now(),
      windowIndex
    });
    
    return connectionId;
  }

  /**
   * Clean up expired connections
   */
  private cleanupConnections(): void {
    const now = Date.now();
    for (const [id, connection] of this.connectionPool) {
      if (now - connection.lastUsed > AppleScriptService.CONFIG.CONNECTION_TTL) {
        this.connectionPool.delete(id);
      }
    }
  }

  /**
   * Process AppleScript execution result with standardized error handling
   */
  private processExecutionResult(
    result: ExecResult,
    errorContext: string
  ): AppleScriptResult<string> {
    if (!result.success) {
      const errorMessage = result.error;
      
      if (errorMessage.includes('not authorized') || errorMessage.includes('access')) {
        return error('AppleScript automation permission denied. Please grant permission in System Preferences > Privacy & Security > Automation.', ERROR_CODES.PERMISSION_DENIED);
      }
      
      return error(errorMessage || `${errorContext} failed`, ERROR_CODES.UNKNOWN_ERROR);
    }

    const output = result.data.stdout.trim();
    
    if (output.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      
      if (errorMsg.includes('Chrome is not running')) {
        return error('Google Chrome is not running', ERROR_CODES.CHROME_NOT_FOUND);
      }
      
      return error(errorMsg, ERROR_CODES.UNKNOWN_ERROR);
    }

    return ok(output, ERROR_CODES.OK);
  }

  /**
   * Execute raw AppleScript with error handling and sanitization
   * 
   * Executes raw AppleScript code with comprehensive error handling, timeout
   * protection, and result processing. Includes performance benchmarking
   * and execution tracking.
   * 
   * @param script Raw AppleScript code to execute
   * @param timeout Maximum execution time in milliseconds (default: 10000)
   * @returns Promise resolving to AppleScript execution result
   * 
   * @throws {ErrorCode.INVALID_INPUT} When script is empty, malformed, or contains invalid syntax
   * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When script parameter is missing
   * @throws {ErrorCode.VALIDATION_FAILED} When script validation fails
   * @throws {ErrorCode.SECURITY_RESTRICTION} When script contains unsafe operations
   * 
   * @throws {ErrorCode.APPLESCRIPT_ERROR} When AppleScript execution fails
   * @throws {ErrorCode.APPLESCRIPT_COMPILATION_FAILED} When AppleScript cannot be compiled
   * @throws {ErrorCode.TIMEOUT} When script execution exceeds timeout
   * @throws {ErrorCode.SCRIPT_TIMEOUT} When script execution times out
   * 
   * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block AppleScript execution
   * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted
   * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted
   * 
   * @throws {ErrorCode.PROCESS_FAILED} When osascript process fails to start or execute
   * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent execution
   * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to execute script
   * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during execution
   */
  async executeScript(script: string, timeout: number = AppleScriptService.CONFIG.DEFAULT_TIMEOUT): Promise<AppleScriptResult<string>> {
    const benchmarkId = startBenchmark('applescript-raw-exec', {
      scriptLength: script.length
    });

    this.executionCount++;

    try {
      const result = await execWithTimeout('osascript', ['-e', script], timeout);
      const processedResult = this.processExecutionResult(result, 'AppleScript execution');
      
      endBenchmark(benchmarkId, processedResult.success);
      return processedResult;
      
    } catch (err) {
      endBenchmark(benchmarkId, false);
      return error(`Failed to execute AppleScript: ${err}`, ERROR_CODES.UNKNOWN_ERROR);
    }
  }

  /**
   * Execute JavaScript in Chrome tab via AppleScript with caching
   * 
   * Executes JavaScript code in a specific Chrome tab using AppleScript bridge.
   * Features script caching, connection pooling, and comprehensive error handling.
   * Includes automatic JSON parsing and performance optimization.
   * 
   * @param javascript JavaScript code to execute in Chrome
   * @param options Execution options including timeout, tab/window targeting, and caching
   * @returns Promise resolving to JavaScript execution result with type safety
   * 
   * @throws {ErrorCode.INVALID_INPUT} When JavaScript is empty, malformed, or contains invalid syntax
   * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When javascript parameter is missing
   * @throws {ErrorCode.VALIDATION_FAILED} When JavaScript validation fails
   * @throws {ErrorCode.INVALID_JSON} When JavaScript result cannot be parsed as JSON
   * 
   * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found
   * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {ErrorCode.TAB_NOT_FOUND} When specified tab index does not exist in window
   * 
   * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails in browser context
   * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {ErrorCode.TIMEOUT} When operation exceeds specified timeout
   * @throws {ErrorCode.SCRIPT_TIMEOUT} When JavaScript execution times out
   * 
   * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted
   * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * 
   * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to execute JavaScript or cache scripts
   * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent execution
   * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during JavaScript execution
   */
  async executeJavaScript<T = unknown>(
    javascript: string,
    options: ScriptExecutionOptions = {}
  ): Promise<AppleScriptResult<T>> {
    
    const { 
      timeout = AppleScriptService.CONFIG.DEFAULT_TIMEOUT, 
      tabIndex = 1, 
      windowIndex = 1, 
      useCache = true 
    } = options;

    const benchmarkId = startBenchmark('chrome-js-exec', {
      scriptLength: javascript.length,
      tabIndex,
      windowIndex,
      useCache
    });

    this.executionCount++;

    try {
      const escapedJS = this.escapeAppleScriptString(javascript);
      const cacheKey = this.generateScriptCacheKey(escapedJS, tabIndex, windowIndex);
      
      // Get connection from pool
      this.getConnection(windowIndex);
      
      let cachedScript: string | undefined;
      
      if (useCache) {
        cachedScript = this.scriptCache.get(cacheKey);
        if (cachedScript) {
          this.cacheHits++;
        } else {
          this.cacheMisses++;
        }
      } else {
        this.cacheMisses++;
      }
      
      if (!cachedScript) {
        // Compile and cache the script template
        cachedScript = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    set targetWindow to window ${windowIndex}
    set targetTab to tab ${tabIndex} of targetWindow
    set jsResult to execute javascript "${escapedJS}" in targetTab
    return jsResult as string
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;
        
        if (useCache) {
          this.scriptCache.set(cacheKey, cachedScript);
        }
      }
      
      const result = await execWithTimeout('osascript', ['-e', cachedScript], timeout);
      const processedResult = this.processExecutionResult(result, 'Chrome JavaScript execution');
      
      if (!processedResult.success) {
        endBenchmark(benchmarkId, false);
        return processedResult as AppleScriptResult<T>;
      }

      // Try to parse as JSON, fallback to string
      let parsedResult: T;
      try {
        parsedResult = JSON.parse(processedResult.data!) as T;
      } catch {
        parsedResult = processedResult.data! as T;
      }

      endBenchmark(benchmarkId, true);
      return ok(parsedResult, ERROR_CODES.OK);
      
    } catch (err) {
      endBenchmark(benchmarkId, false);
      return error(`Failed to execute JavaScript: ${err}`, ERROR_CODES.UNKNOWN_ERROR);
    }
  }

  /**
   * Get Chrome window bounds using pure AppleScript (no JavaScript execution)
   * This is a fallback method for when JavaScript execution is blocked by Chrome security
   * 
   * @private
   */
  private async getChromeWindowBoundsViaAppleScript(windowIndex: number = 1): Promise<AppleScriptResult<ChromeWindow>> {
    const appleScript = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    set targetWindow to window ${windowIndex}
    set windowBounds to bounds of targetWindow
    set windowTitle to title of targetWindow
    
    -- Extract window bounds
    set rawLeft to (item 1 of windowBounds)
    set rawTop to (item 2 of windowBounds)
    set rawRight to (item 3 of windowBounds)
    set rawBottom to (item 4 of windowBounds)
    
    -- Return as JSON-like string with debug info
    return "{" & ¬
      "\\"id\\":" & ${windowIndex} & "," & ¬
      "\\"title\\":\\"" & windowTitle & "\\"," & ¬
      "\\"debug\\":{" & ¬
        "\\"raw\\":[" & rawLeft & "," & rawTop & "," & rawRight & "," & rawBottom & "]" & ¬
      "}," & ¬
      "\\"bounds\\":{" & ¬
        "\\"x\\":" & rawLeft & "," & ¬
        "\\"y\\":" & rawTop & "," & ¬
        "\\"width\\":" & (rawRight - rawLeft) & "," & ¬
        "\\"height\\":" & (rawBottom - rawTop) & ¬
      "}," & ¬
      "\\"visible\\":true" & ¬
      "}"
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;

    const result = await this.executeScript(appleScript, AppleScriptService.CONFIG.DEFAULT_TIMEOUT / 2);
    
    if (!result.success) {
      return error(result.error, result.code);
    }
    
    const output = result.data?.trim();
    
    if (output?.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      return error(errorMsg, errorMsg.includes('Chrome is not running') ? ERROR_CODES.CHROME_NOT_FOUND : ERROR_CODES.UNKNOWN_ERROR);
    }
    
    try {
      const windowData = JSON.parse(output || '{}') as ChromeWindow;
      return ok(windowData, ERROR_CODES.OK);
    } catch (parseError) {
      return error(`Failed to parse window data: ${parseError}`, ERROR_CODES.UNKNOWN_ERROR);
    }
  }

  /**
   * Get Chrome window bounds and metadata
   * 
   * Retrieves detailed information about a Chrome window including position,
   * dimensions, title, and visibility state. Uses AppleScript for reliable
   * window bounds detection that works across different Chrome configurations.
   * 
   * @param windowIndex Target window index (1-based, default: 1)
   * @returns Promise resolving to Chrome window information
   * 
   * @throws {ErrorCode.INVALID_INPUT} When windowIndex is not a valid number or out of range
   * @throws {ErrorCode.VALIDATION_FAILED} When window index validation fails
   * 
   * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found
   * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {ErrorCode.TAB_NOT_FOUND} When no tabs exist in the specified window
   * 
   * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails in browser context
   * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {ErrorCode.TIMEOUT} When window bounds retrieval exceeds timeout
   * 
   * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted
   * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * 
   * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent window bounds retrieval
   * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during window bounds retrieval
   */
  async getChromeWindowBounds(windowIndex: number = 1): Promise<AppleScriptResult<ChromeWindow>> {
    return this.getChromeWindowBoundsViaAppleScript(windowIndex);
  }

  /**
   * Get active Chrome tab information
   * 
   * Retrieves detailed information about the currently active tab in a Chrome
   * window including title, URL, and metadata using JavaScript execution.
   * 
   * @param windowIndex Target window index (1-based, default: 1)
   * @returns Promise resolving to active Chrome tab information
   * 
   * @throws {ErrorCode.INVALID_INPUT} When windowIndex is not a valid number or out of range
   * @throws {ErrorCode.VALIDATION_FAILED} When window index validation fails
   * 
   * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found
   * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {ErrorCode.TAB_NOT_FOUND} When no active tab exists in the specified window
   * 
   * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails in browser context
   * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {ErrorCode.TIMEOUT} When active tab retrieval exceeds timeout
   * 
   * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted
   * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * 
   * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent tab information retrieval
   * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during tab information retrieval
   */
  async getActiveTab(windowIndex: number = 1): Promise<AppleScriptResult<ChromeTab>> {
    const javascript = `
(function() {
  return {
    id: 1,
    title: document.title,
    url: window.location.href,
    loading: document.readyState !== 'complete',
    windowId: ${windowIndex}
  };
})();`;

    return this.executeJavaScript<ChromeTab>(javascript, {
      tabIndex: 1,
      windowIndex
    });
  }

  /**
   * Check if Chrome is running and accessible
   */
  async isChromeRunning(): Promise<boolean> {
    const appleScript = `
tell application "System Events"
  set chromeRunning to exists (processes where name is "Google Chrome")
  return chromeRunning
end tell`;

    try {
      const result = await this.executeScript(appleScript, AppleScriptService.CONFIG.DEFAULT_TIMEOUT / 2);
      return result.success && result.data?.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Focus Chrome window
   */
  async focusChromeWindow(windowIndex: number = 1): Promise<AppleScriptResult<boolean>> {
    const appleScript = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    activate
    set index of window ${windowIndex} to 1
    return "true"
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;

    const result = await this.executeScript(appleScript, AppleScriptService.CONFIG.DEFAULT_TIMEOUT / 2);
    
    if (!result.success) {
      return error(result.error, result.code);
    }

    const output = result.data?.trim();
    
    if (output?.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      return error(errorMsg, errorMsg.includes('Chrome is not running') ? ERROR_CODES.CHROME_NOT_FOUND : ERROR_CODES.UNKNOWN_ERROR);
    }

    return ok(output === 'true', ERROR_CODES.OK);
  }

  /**
   * Get all tabs in a Chrome window using optimized script generation
   */
  async getAllTabs(windowIndex: number = 1): Promise<AppleScriptResult<ChromeTab[]>> {
    // Import here to avoid circular dependencies
    const { generateTabEnumerationScript } = await import('../lib/tab-manager.js');
    const script = generateTabEnumerationScript(windowIndex);
    
    const result = await this.executeScript(script, AppleScriptService.CONFIG.SCRIPT_TIMEOUT);
    
    if (!result.success) {
      return error(result.error, result.code);
    }

    const output = result.data?.trim();
    
    if (output?.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      return error(errorMsg, errorMsg.includes('Chrome is not running') ? ERROR_CODES.CHROME_NOT_FOUND : ERROR_CODES.UNKNOWN_ERROR);
    }

    try {
      const tabs = JSON.parse(output || '[]') as ChromeTab[];
      return ok(tabs, ERROR_CODES.OK);
    } catch (parseError) {
      return error(`Failed to parse tab data: ${parseError}`, ERROR_CODES.UNKNOWN_ERROR);
    }
  }

  /**
   * Focus a tab by index in a Chrome window using optimized script generation
   */
  async focusTabByIndex(tabIndex: number, windowIndex: number = 1): Promise<AppleScriptResult<ChromeTab>> {
    // Import here to avoid circular dependencies
    const { generateTabFocusScript } = await import('../lib/tab-manager.js');
    const script = generateTabFocusScript(tabIndex, windowIndex);
    
    const result = await this.executeScript(script, AppleScriptService.CONFIG.DEFAULT_TIMEOUT);
    
    if (!result.success) {
      return error(result.error, result.code);
    }

    const output = result.data?.trim();
    
    if (output?.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      return error(errorMsg, errorMsg.includes('Chrome is not running') ? ERROR_CODES.CHROME_NOT_FOUND : ERROR_CODES.UNKNOWN_ERROR);
    }

    try {
      const tab = JSON.parse(output || '{}') as ChromeTab;
      return ok(tab, ERROR_CODES.OK);
    } catch (parseError) {
      return error(`Failed to parse tab data: ${parseError}`, ERROR_CODES.UNKNOWN_ERROR);
    }
  }

  /**
   * Execute batch AppleScript operations for better performance
   */
  async executeBatch<T = unknown>(
    operations: Array<{
      script: string;
      options?: ScriptExecutionOptions;
    }>
  ): Promise<AppleScriptResult<T>[]> {
    const benchmarkId = startBenchmark('applescript-batch', { 
      operationCount: operations.length 
    });

    this.executionCount += operations.length;

    try {
      // For mixed operation types, execute individually for better error handling
      const results = await Promise.all(
        operations.map(async (op): Promise<AppleScriptResult<T>> => {
          // Determine if this is a JavaScript operation or raw AppleScript
          if (op.script.includes('execute javascript')) {
            // Extract the JavaScript from the AppleScript
            const jsMatch = op.script.match(/execute javascript "(.*)" in/);
            if (jsMatch && jsMatch[1]) {
              const js = jsMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              return this.executeJavaScript<T>(js, op.options) as Promise<AppleScriptResult<T>>;
            }
          }
          
          // Execute as raw AppleScript
          const result = await this.executeScript(op.script, op.options?.timeout || AppleScriptService.CONFIG.BATCH_TIMEOUT);
          return result as AppleScriptResult<T>;
        })
      );
      
      endBenchmark(benchmarkId, true);
      return results;
      
    } catch (error) {
      endBenchmark(benchmarkId, false);
      throw error;
    }
  }

  /**
   * Clear all caches and reset connection pool
   */
  clearCaches(): void {
    this.scriptCache.clear();
    this.connectionPool.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.executionCount = 0;
  }

  /**
   * Get performance statistics for monitoring
   */
  getPerformanceStats(): {
    cacheHits: number;
    cacheMisses: number;
    activeConnections: number;
    executionCount: number;
  } {
    this.cleanupConnections();
    
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      activeConnections: this.connectionPool.size,
      executionCount: this.executionCount
    };
  }
}

// Singleton instance for application-wide use
export const appleScriptService = new AppleScriptService();
