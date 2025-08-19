import { execChromeJS, getActiveTab, focusChromeWindow, getAllTabs, focusTabByIndex, type ChromeTab } from './apple.js';
import { findMatchingTabs, type TabMatchOptions } from './tab-manager.js';
import { ERROR_CODES, type ErrorCode } from './util.js';

export interface NavigationResult {
  success: boolean;
  action: string;
  url?: string;
  title?: string;
  loading?: boolean;
  error?: string;
  code: ErrorCode;
}

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  windowId: number;
}

/**
 * Navigate to a specific URL
 */
export async function navigateToURL(
  url: string, 
  windowIndex: number = 1
): Promise<NavigationResult> {
  try {
    // Ensure URL has protocol
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      fullUrl = 'https://' + url;
    }
    
    const javascript = `
(function() {
  window.location.href = '${fullUrl.replace(/'/g, "\\'")}';
  return {
    url: window.location.href,
    title: document.title,
    loading: document.readyState !== 'complete'
  };
})();
`;

    const result = await execChromeJS<{ url: string; title: string; loading: boolean }>(javascript, 1, windowIndex);
    
    if (!result.success) {
      return {
        success: false,
        action: 'navigate',
        error: result.error || 'Failed to navigate to URL',
        code: result.code
      };
    }
    
    if (!result.data) {
      return {
        success: false,
        action: 'navigate',
        error: 'No result from navigation',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    return {
      success: true,
      action: 'navigate',
      url: result.data.url,
      title: result.data.title,
      loading: result.data.loading,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'navigate',
      error: `Failed to navigate: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Reload the current page
 */
export async function reloadPage(
  hard: boolean = false, 
  windowIndex: number = 1
): Promise<NavigationResult> {
  try {
    const javascript = hard 
      ? `
(function() {
  // Hard reload - bypass cache
  window.location.reload(true);
  return {
    url: window.location.href,
    title: document.title,
    loading: true
  };
})();
`
      : `
(function() {
  // Normal reload
  window.location.reload();
  return {
    url: window.location.href,
    title: document.title,
    loading: true
  };
})();
`;

    const result = await execChromeJS<{ url: string; title: string; loading: boolean }>(javascript, 1, windowIndex);
    
    if (!result.success) {
      return {
        success: false,
        action: 'reload',
        error: result.error || 'Failed to reload page',
        code: result.code
      };
    }
    
    if (!result.data) {
      return {
        success: false,
        action: 'reload',
        error: 'No result from reload',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    return {
      success: true,
      action: hard ? 'hard_reload' : 'reload',
      url: result.data.url,
      title: result.data.title,
      loading: result.data.loading,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'reload',
      error: `Failed to reload: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Navigate back in browser history
 */
export async function navigateBack(windowIndex: number = 1): Promise<NavigationResult> {
  try {
    const javascript = `
(function() {
  window.history.back();
  return {
    url: window.location.href,
    title: document.title,
    loading: document.readyState !== 'complete'
  };
})();
`;

    const result = await execChromeJS<{ url: string; title: string; loading: boolean }>(javascript, 1, windowIndex);
    
    if (!result.success) {
      return {
        success: false,
        action: 'back',
        error: result.error || 'Failed to navigate back',
        code: result.code
      };
    }
    
    if (!result.data) {
      return {
        success: false,
        action: 'back',
        error: 'No result from back navigation',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    return {
      success: true,
      action: 'back',
      url: result.data.url,
      title: result.data.title,
      loading: result.data.loading,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'back',
      error: `Failed to navigate back: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Navigate forward in browser history
 */
export async function navigateForward(windowIndex: number = 1): Promise<NavigationResult> {
  try {
    const javascript = `
(function() {
  window.history.forward();
  return {
    url: window.location.href,
    title: document.title,
    loading: document.readyState !== 'complete'
  };
})();
`;

    const result = await execChromeJS<{ url: string; title: string; loading: boolean }>(javascript, 1, windowIndex);
    
    if (!result.success) {
      return {
        success: false,
        action: 'forward',
        error: result.error || 'Failed to navigate forward',
        code: result.code
      };
    }
    
    if (!result.data) {
      return {
        success: false,
        action: 'forward',
        error: 'No result from forward navigation',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    return {
      success: true,
      action: 'forward',
      url: result.data.url,
      title: result.data.title,
      loading: result.data.loading,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'forward',
      error: `Failed to navigate forward: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Get current page information
 */
export async function getCurrentPageInfo(windowIndex: number = 1): Promise<NavigationResult> {
  try {
    const result = await getActiveTab(windowIndex);
    
    if (!result.success) {
      return {
        success: false,
        action: 'get_page_info',
        error: result.error || 'Failed to get page information',
        code: result.code
      };
    }
    
    if (!result.data) {
      return {
        success: false,
        action: 'get_page_info',
        error: 'No page information available',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    return {
      success: true,
      action: 'get_page_info',
      url: result.data.url,
      title: result.data.title,
      loading: result.data.loading,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'get_page_info',
      error: `Failed to get page info: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Focus a Chrome tab by pattern matching title or URL
 * Supports both exact and substring matching
 */
export async function focusTabByPattern(
  pattern: string, 
  windowIndex: number = 1,
  exactMatch: boolean = false
): Promise<NavigationResult> {
  try {
    // First focus the Chrome window
    const focusResult = await focusChromeWindow(windowIndex);
    if (!focusResult.success) {
      return {
        success: false,
        action: 'focus_tab',
        error: focusResult.error || 'Failed to focus Chrome window',
        code: focusResult.code
      };
    }
    
    // Get all tabs in the window to search through them
    const tabsResult = await getAllTabs(windowIndex);
    if (!tabsResult.success) {
      return {
        success: false,
        action: 'focus_tab',
        error: tabsResult.error || 'Failed to get tabs from window',
        code: tabsResult.code
      };
    }
    
    if (!tabsResult.data || tabsResult.data.length === 0) {
      return {
        success: false,
        action: 'focus_tab',
        error: 'No tabs found in the specified window',
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    // Use the dedicated tab matching utility
    const matchOptions: TabMatchOptions = {
      pattern,
      exactMatch,
      caseSensitive: false
    };
    
    const matches = findMatchingTabs(tabsResult.data, matchOptions);
    
    if (matches.length === 0) {
      return {
        success: false,
        action: 'focus_tab',
        error: `Tab matching pattern "${pattern}" not found. Found ${tabsResult.data.length} tabs in window ${windowIndex}.`,
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    // Use the first match (could be enhanced to support multiple matches)
    const matchedTab = matches[0];
    
    // Focus the matched tab
    const focusTabResult = await focusTabByIndex(matchedTab.index, windowIndex);
    if (!focusTabResult.success) {
      return {
        success: false,
        action: 'focus_tab',
        error: focusTabResult.error || 'Failed to focus matched tab',
        code: focusTabResult.code
      };
    }
    
    if (!focusTabResult.data) {
      return {
        success: false,
        action: 'focus_tab',
        error: 'No tab data returned after focusing',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    return {
      success: true,
      action: 'focus_tab',
      url: focusTabResult.data.url,
      title: focusTabResult.data.title,
      loading: focusTabResult.data.loading,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'focus_tab',
      error: `Failed to focus tab: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Wait for page to finish loading
 */
export async function waitForPageLoad(
  windowIndex: number = 1, 
  timeoutMs: number = 30000
): Promise<NavigationResult> {
  try {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const javascript = `
(function() {
  return {
    loading: document.readyState !== 'complete',
    url: window.location.href,
    title: document.title
  };
})();
`;
      
      const result = await execChromeJS<{ loading: boolean; url: string; title: string }>(javascript, 1, windowIndex);
      
      if (!result.success) {
        return {
          success: false,
          action: 'wait_load',
          error: result.error || 'Failed to check page load status',
          code: result.code
        };
      }
      
      if (!result.data) {
        return {
          success: false,
          action: 'wait_load',
          error: 'No result from page load check',
          code: ERROR_CODES.UNKNOWN_ERROR
        };
      }
      
      if (!result.data.loading) {
        return {
          success: true,
          action: 'wait_load',
          url: result.data.url,
          title: result.data.title,
          loading: false,
          code: ERROR_CODES.OK
        };
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      success: false,
      action: 'wait_load',
      error: 'Page load timeout',
      code: ERROR_CODES.TIMEOUT
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'wait_load',
      error: `Failed to wait for page load: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}