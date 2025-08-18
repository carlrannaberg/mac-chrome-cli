import { execChromeJS, getChromeWindowBounds, type JavaScriptResult } from './apple.js';
import { ERROR_CODES, type ErrorCode } from './util.js';
import { getCachedCoordinates, generateCoordsCacheKey } from './performance.js';

export interface Coordinates {
  x: number;
  y: number;
}

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ViewportRect {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  titleBarHeight: number;
  contentAreaX: number;
  contentAreaY: number;
}

export interface CoordinateResult {
  success: boolean;
  coordinates?: Coordinates;
  element?: ElementRect;
  viewport?: ViewportRect;
  window?: WindowBounds;
  error?: string;
  code: ErrorCode;
}

/**
 * Get element bounding rectangle in viewport coordinates
 */
async function getElementRect(selector: string, windowIndex: number = 1): Promise<JavaScriptResult<ElementRect | null>> {
  const javascript = `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) {
    return null;
  }
  
  // Scroll element into view (center if possible)
  element.scrollIntoView({ 
    behavior: 'instant', 
    block: 'center', 
    inline: 'center' 
  });
  
  // Small delay to ensure scroll completes
  setTimeout(() => {}, 100);
  
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2
  };
})();
`;

  return execChromeJS<ElementRect | null>(javascript, 1, windowIndex);
}

/**
 * Get viewport information
 */
async function getViewportInfo(windowIndex: number = 1): Promise<JavaScriptResult<ViewportRect>> {
  const javascript = `
(function() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX || window.pageXOffset,
    scrollY: window.scrollY || window.pageYOffset
  };
})();
`;

  return execChromeJS<ViewportRect>(javascript, 1, windowIndex);
}

/**
 * Calculate window bounds and content area offset
 */
async function calculateWindowBounds(windowIndex: number = 1): Promise<WindowBounds | null> {
  const boundsResult = await getChromeWindowBounds(windowIndex);
  
  if (!boundsResult.success || !boundsResult.result) {
    return null;
  }
  
  const bounds = boundsResult.result.bounds;
  
  // Estimate title bar height and content area offset
  // These are approximate values for Chrome on macOS
  const titleBarHeight = 24; // Standard macOS title bar
  const contentAreaX = bounds.x;
  const contentAreaY = bounds.y + titleBarHeight;
  
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    titleBarHeight,
    contentAreaX,
    contentAreaY
  };
}

/**
 * Convert viewport coordinates to screen coordinates
 */
export async function viewportToScreen(
  viewportX: number, 
  viewportY: number, 
  windowIndex: number = 1
): Promise<CoordinateResult> {
  // Validate input coordinates
  if (!Number.isFinite(viewportX) || !Number.isFinite(viewportY)) {
    return {
      success: false,
      error: 'Invalid viewport coordinates: coordinates must be finite numbers',
      code: ERROR_CODES.INVALID_INPUT
    };
  }

  try {
    const [viewportResult, windowBounds] = await Promise.all([
      getViewportInfo(windowIndex),
      calculateWindowBounds(windowIndex)
    ]);
    
    if (!viewportResult.success) {
      return {
        success: false,
        error: 'Failed to get viewport information',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    if (!windowBounds) {
      return {
        success: false,
        error: 'Failed to get window bounds',
        code: ERROR_CODES.CHROME_NOT_FOUND
      };
    }
    
    const viewport = viewportResult.result!;
    
    // Calculate screen coordinates
    const screenX = windowBounds.contentAreaX + viewportX;
    const screenY = windowBounds.contentAreaY + viewportY;
    
    return {
      success: true,
      coordinates: { x: screenX, y: screenY },
      viewport,
      window: windowBounds,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to convert viewport to screen coordinates: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Convert CSS selector to screen coordinates (with caching)
 */
export async function selectorToScreen(
  selector: string, 
  windowIndex: number = 1
): Promise<CoordinateResult> {
  const cacheKey = generateCoordsCacheKey(selector, undefined, undefined, windowIndex);
  
  return getCachedCoordinates(cacheKey, async () => {
    try {
      const [elementResult, viewportResult, windowBounds] = await Promise.all([
        getElementRect(selector, windowIndex),
        getViewportInfo(windowIndex),
        calculateWindowBounds(windowIndex)
      ]);
    
    if (!elementResult.success) {
      return {
        success: false,
        error: `Failed to execute JavaScript: ${elementResult.error}`,
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    if (!elementResult.result) {
      return {
        success: false,
        error: `Element not found: ${selector}`,
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    if (!viewportResult.success) {
      return {
        success: false,
        error: 'Failed to get viewport information',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    if (!windowBounds) {
      return {
        success: false,
        error: 'Failed to get window bounds',
        code: ERROR_CODES.CHROME_NOT_FOUND
      };
    }
    
    const element = elementResult.result;
    const viewport = viewportResult.result!;
    
    // Calculate screen coordinates (use center of element)
    const screenX = windowBounds.contentAreaX + element.centerX;
    const screenY = windowBounds.contentAreaY + element.centerY;
    
      return {
        success: true,
        coordinates: { x: screenX, y: screenY },
        element,
        viewport,
        window: windowBounds,
        code: ERROR_CODES.OK
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert selector to screen coordinates: ${error}`,
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
  });
}

/**
 * Get screen coordinates for element or x,y coordinates
 */
export async function getScreenCoordinates(
  options: { selector?: string; x?: number; y?: number },
  windowIndex: number = 1
): Promise<CoordinateResult> {
  if (options.selector) {
    return selectorToScreen(options.selector, windowIndex);
  } else if (options.x !== undefined && options.y !== undefined) {
    return viewportToScreen(options.x, options.y, windowIndex);
  } else {
    return {
      success: false,
      error: 'Must provide either selector or x,y coordinates',
      code: ERROR_CODES.INVALID_INPUT
    };
  }
}

/**
 * Check if coordinates are within the visible viewport
 */
export async function isCoordinateVisible(
  x: number, 
  y: number, 
  windowIndex: number = 1
): Promise<boolean> {
  try {
    const viewportResult = await getViewportInfo(windowIndex);
    if (!viewportResult.success || !viewportResult.result) {
      return false;
    }
    
    const viewport = viewportResult.result;
    return x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height;
  } catch {
    return false;
  }
}

/**
 * Validate that element is visible and clickable
 */
export async function validateElementVisibility(
  selector: string,
  windowIndex: number = 1
): Promise<JavaScriptResult<{ visible: boolean; clickable: boolean; inViewport: boolean }>> {
  const javascript = `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) {
    return { visible: false, clickable: false, inViewport: false };
  }
  
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  const visible = style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 style.opacity !== '0' &&
                 rect.width > 0 && 
                 rect.height > 0;
  
  const inViewport = rect.top >= 0 && 
                     rect.left >= 0 && 
                     rect.bottom <= window.innerHeight && 
                     rect.right <= window.innerWidth;
  
  const clickable = visible && 
                    style.pointerEvents !== 'none' &&
                    !element.hasAttribute('disabled');
  
  return { visible, clickable, inViewport };
})();
`;

  return execChromeJS<{ visible: boolean; clickable: boolean; inViewport: boolean }>(javascript, 1, windowIndex);
}