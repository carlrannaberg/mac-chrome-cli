import { execWithTimeout, ERROR_CODES, type ErrorCode } from './util.js';
import { execCachedAppleScript, startBenchmark, endBenchmark } from './performance.js';

export interface ChromeWindow {
  id: number;
  title: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
}

export interface ChromeTab {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  windowId: number;
}

export interface JavaScriptResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  code: ErrorCode;
}

/**
 * Escape string for AppleScript
 */
export function escapeAppleScriptString(str: string): string {
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
 * Execute JavaScript in Chrome tab via AppleScript with performance optimizations
 */
export async function execChromeJS<T = unknown>(
  javascript: string,
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<JavaScriptResult<T>> {
  const benchmarkId = startBenchmark('chrome-js-exec', {
    scriptLength: javascript.length,
    tabIndex,
    windowIndex
  });

  try {
    const escapedJS = escapeAppleScriptString(javascript);
    
    // Use cached AppleScript execution for better performance
    const result = await execCachedAppleScript(escapedJS, tabIndex, windowIndex, timeoutMs);
    
    if (!result.success) {
      if (result.stderr.includes('not authorized') || result.stderr.includes('access')) {
        return {
          success: false,
          error: 'AppleScript automation permission denied. Please grant permission in System Preferences > Privacy & Security > Automation.',
          code: ERROR_CODES.PERMISSION_DENIED
        };
      }
      
      return {
        success: false,
        error: result.stderr || 'AppleScript execution failed',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    const output = result.stdout.trim();
    
    if (output.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      
      if (errorMsg.includes('Chrome is not running')) {
        return {
          success: false,
          error: 'Google Chrome is not running',
          code: ERROR_CODES.CHROME_NOT_FOUND
        };
      }
      
      return {
        success: false,
        error: errorMsg,
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    // Try to parse as JSON, fallback to string
    let parsedResult: T;
    try {
      parsedResult = JSON.parse(output) as T;
    } catch {
      parsedResult = output as T;
    }

    const jsResult = {
      success: true,
      result: parsedResult,
      code: ERROR_CODES.OK
    };
    
    endBenchmark(benchmarkId, true);
    return jsResult;
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    return {
      success: false,
      error: `Failed to execute JavaScript: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Get Chrome window bounds and metadata
 */
export async function getChromeWindowBounds(windowIndex: number = 1): Promise<JavaScriptResult<ChromeWindow>> {
  const javascript = `
(function() {
  const win = window;
  return {
    id: ${windowIndex},
    title: document.title,
    bounds: {
      x: win.screenX,
      y: win.screenY,
      width: win.outerWidth,
      height: win.outerHeight
    },
    visible: !document.hidden
  };
})();
`;

  return execChromeJS<ChromeWindow>(javascript, 1, windowIndex);
}

/**
 * Get active Chrome tab information
 */
export async function getActiveTab(windowIndex: number = 1): Promise<JavaScriptResult<ChromeTab>> {
  const javascript = `
(function() {
  return {
    id: 1,
    title: document.title,
    url: window.location.href,
    loading: document.readyState !== 'complete',
    windowId: ${windowIndex}
  };
})();
`;

  return execChromeJS<ChromeTab>(javascript, 1, windowIndex);
}

/**
 * Check if Chrome is running and accessible
 */
export async function isChromeRunning(): Promise<boolean> {
  const appleScript = `
tell application "System Events"
  set chromeRunning to exists (processes where name is "Google Chrome")
  return chromeRunning
end tell`;

  try {
    const result = await execWithTimeout('osascript', ['-e', appleScript], 5000);
    return result.success && result.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Focus Chrome window
 */
export async function focusChromeWindow(windowIndex: number = 1): Promise<JavaScriptResult<boolean>> {
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

  try {
    const result = await execWithTimeout('osascript', ['-e', appleScript], 5000);
    
    if (!result.success) {
      return {
        success: false,
        error: result.stderr || 'Failed to focus Chrome window',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    const output = result.stdout.trim();
    
    if (output.startsWith('ERROR:')) {
      const errorMsg = output.substring(6).trim();
      return {
        success: false,
        error: errorMsg,
        code: errorMsg.includes('Chrome is not running') ? ERROR_CODES.CHROME_NOT_FOUND : ERROR_CODES.UNKNOWN_ERROR
      };
    }

    return {
      success: true,
      result: output === 'true',
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to focus Chrome window: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}