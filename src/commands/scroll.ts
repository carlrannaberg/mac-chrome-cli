import { execChromeJS } from '../lib/apple.js';
import { ErrorCode, Result, ok, error, mapError } from '../core/index.js';
import { ErrorUtils, validateInputParam, executeWithContext } from '../core/ErrorUtils.js';
import { withRetry } from '../core/RetryHandler.js';

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface ScrollResult {
  scrolled: boolean;
  position: ScrollPosition;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Scroll to element by CSS selector
 * 
 * Scrolls the page to bring the specified element into view. Supports both smooth
 * and instant scrolling behaviors, with the element positioned in the center of
 * the viewport when possible.
 * 
 * @param selector CSS selector for the target element
 * @param smooth Whether to use smooth scrolling animation (default: false)
 * @param tabIndex Target tab index (1-based, default: 1)
 * @param windowIndex Target window index (1-based, default: 1)
 * @param timeoutMs Operation timeout in milliseconds (default: 10000)
 * @returns Promise resolving to scroll result with position and viewport information
 * 
 * @throws {ErrorCode.INVALID_INPUT} When selector is empty, not a string, or contains invalid characters
 * @throws {ErrorCode.INVALID_SELECTOR} When CSS selector is malformed or invalid
 * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When selector parameter is missing
 * @throws {ErrorCode.VALIDATION_FAILED} When input parameter validation fails
 * 
 * @throws {ErrorCode.TARGET_NOT_FOUND} When element with specified selector does not exist on page
 * @throws {ErrorCode.ELEMENT_NOT_VISIBLE} When element exists but cannot be scrolled into view
 * @throws {ErrorCode.TARGET_OUTSIDE_VIEWPORT} When element is outside scrollable area
 * 
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window index does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When specified tab index does not exist in window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails during scroll operation
 * @throws {ErrorCode.PAGE_LOAD_FAILED} When page is not fully loaded or accessible
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When scroll operation exceeds timeout
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * 
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * @throws {ErrorCode.TIMEOUT} When operation exceeds specified timeout
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent scroll operation
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during scroll
 * 
 * @example
 * ```typescript
 * // Scroll to element with error handling
 * try {
 *   const result = await scrollToElement('#target-section', true);
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.TARGET_NOT_FOUND:
 *         console.log('Element not found - check selector');
 *         break;
 *       case ErrorCode.INVALID_SELECTOR:
 *         console.log('Invalid CSS selector syntax');
 *         break;
 *       case ErrorCode.CHROME_NOT_RUNNING:
 *         console.log('Start Chrome browser first');
 *         break;
 *     }
 *   } else {
 *     console.log(`Scrolled to position: ${result.data.position.x}, ${result.data.position.y}`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected scroll error:', error);
 * }
 * 
 * // Scroll with custom timeout
 * const customResult = await scrollToElement('.footer', false, 1, 1, 5000);
 * ```
 */
export async function scrollToElement(
  selector: string,
  smooth: boolean = false,
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<Result<ScrollResult, string>> {
  // Validate input parameters
  const selectorValidation = validateInputParam(selector, 'selector', 'string');
  if (!selectorValidation.success) {
    return selectorValidation as Result<ScrollResult, string>;
  }

  const javascript = `
(() => {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) {
    throw new Error('Element not found');
  }

  // Scroll element into view
  element.scrollIntoView({
    block: 'center',
    inline: 'center',
    behavior: ${smooth ? "'smooth'" : "'instant'"}
  });

  // Get current scroll position and viewport
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return {
    scrolled: true,
    position: { x: scrollX, y: scrollY },
    viewport: { width: viewportWidth, height: viewportHeight }
  };
})()`;

  // Execute with retry and error context
  return withRetry(async () => {
    const result = await execChromeJS<ScrollResult>(javascript, tabIndex, windowIndex, timeoutMs);
    
    if (!result.success) {
      if (result.error?.includes('Element not found')) {
        return ErrorUtils.targetNotFoundError(selector, 'scroll target');
      }
      return error(
        result.error || 'Failed to scroll to element',
        result.code as ErrorCode,
        {
          recoveryHint: 'check_target',
          metadata: { selector, operation: 'scroll-to-element' }
        }
      );
    }
    
    return ok(result.data as ScrollResult, ErrorCode.OK, {
      metadata: { selector, smooth, operation: 'scroll-to-element' }
    });
  }, { maxAttempts: 2, initialDelayMs: 500 }, `scroll to element: ${selector}`);
}

/**
 * Scroll by pixel amount
 * 
 * Scrolls the page by a specified number of pixels in either horizontal or
 * vertical direction. Supports both smooth and instant scrolling behaviors.
 * 
 * @param pixels Number of pixels to scroll (must be positive)
 * @param smooth Whether to use smooth scrolling animation (default: false)
 * @param direction Scroll direction - 'horizontal' or 'vertical' (default: 'vertical')
 * @param tabIndex Target tab index (1-based, default: 1)
 * @param windowIndex Target window index (1-based, default: 1)
 * @param timeoutMs Operation timeout in milliseconds (default: 10000)
 * @returns Promise resolving to scroll result with position and viewport information
 * 
 * @throws {ErrorCode.INVALID_INPUT} When pixels is not a number, is negative, or direction is invalid
 * @throws {ErrorCode.VALIDATION_FAILED} When input parameter validation fails
 * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When pixels parameter is missing
 * 
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window index does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When specified tab index does not exist in window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails during scroll operation
 * @throws {ErrorCode.PAGE_LOAD_FAILED} When page is not fully loaded or accessible
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When scroll operation exceeds timeout
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * 
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * @throws {ErrorCode.TIMEOUT} When operation exceeds specified timeout
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent scroll operation
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during scroll
 * 
 * @example
 * ```typescript
 * // Scroll down by 500 pixels with error handling
 * try {
 *   const result = await scrollByPixels(500, true, 'vertical');
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.INVALID_INPUT:
 *         console.log('Check pixels value and direction parameter');
 *         break;
 *       case ErrorCode.CHROME_NOT_RUNNING:
 *         console.log('Start Chrome browser first');
 *         break;
 *       case ErrorCode.SCRIPT_TIMEOUT:
 *         console.log('Scroll operation timed out');
 *         break;
 *     }
 *   } else {
 *     console.log(`Scrolled: ${result.data.scrolled}`);
 *     console.log(`New position: ${result.data.position.x}, ${result.data.position.y}`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected scroll error:', error);
 * }
 * 
 * // Scroll horizontally with instant behavior
 * const horizontalResult = await scrollByPixels(300, false, 'horizontal');
 * ```
 */
export async function scrollByPixels(
  pixels: number,
  smooth: boolean = false,
  direction: 'horizontal' | 'vertical' = 'vertical',
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<Result<ScrollResult, string>> {
  // Validate input parameters
  const pixelsValidation = validateInputParam(pixels, 'pixels', 'number');
  if (!pixelsValidation.success) {
    return pixelsValidation as Result<ScrollResult, string>;
  }
  
  if (pixels < 0) {
    return ErrorUtils.validationError('Pixels must be a positive number', 'pixels', pixels);
  }

  const javascript = `
(() => {
  // Get current scroll position
  const currentX = window.pageXOffset || document.documentElement.scrollLeft;
  const currentY = window.pageYOffset || document.documentElement.scrollTop;

  // Calculate deltas
  const deltaX = ${direction === 'horizontal' ? pixels : 0};
  const deltaY = ${direction === 'vertical' ? pixels : 0};

  // Perform scroll
  if (${smooth}) {
    window.scrollTo({
      left: currentX + deltaX,
      top: currentY + deltaY,
      behavior: 'smooth'
    });
  } else {
    window.scrollBy(deltaX, deltaY);
  }

  // Get new scroll position and viewport
  const newX = window.pageXOffset || document.documentElement.scrollLeft;
  const newY = window.pageYOffset || document.documentElement.scrollTop;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  // Check if scroll actually happened
  const scrolled = (newX !== currentX) || (newY !== currentY);

  return {
    scrolled: scrolled,
    position: { x: newX, y: newY },
    viewport: { width: viewportWidth, height: viewportHeight }
  };
})()`;

  // Execute with error context
  const executeResult = await executeWithContext(async () => {
    const result = await execChromeJS<ScrollResult>(javascript, tabIndex, windowIndex, timeoutMs);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to scroll by pixels');
    }
    
    return result.data as ScrollResult;
  }, `scroll by ${pixels}px ${direction}`);
  
  return mapError(executeResult, (err) => err.message);
}

/**
 * Get current scroll position
 * 
 * Retrieves the current scroll position and viewport information from the page.
 * Returns both horizontal and vertical scroll offsets along with viewport dimensions.
 * 
 * @param tabIndex Target tab index (1-based, default: 1)
 * @param windowIndex Target window index (1-based, default: 1)
 * @param timeoutMs Operation timeout in milliseconds (default: 10000)
 * @returns Promise resolving to scroll position result with viewport information
 * 
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window index does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When specified tab index does not exist in window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails during position retrieval
 * @throws {ErrorCode.PAGE_LOAD_FAILED} When page is not fully loaded or accessible
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When position retrieval exceeds timeout
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * 
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * @throws {ErrorCode.TIMEOUT} When operation exceeds specified timeout
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent position retrieval
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during position retrieval
 * 
 * @example
 * ```typescript
 * // Get current scroll position with error handling
 * try {
 *   const result = await getScrollPosition();
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.CHROME_NOT_RUNNING:
 *         console.log('Start Chrome browser first');
 *         break;
 *       case ErrorCode.TAB_NOT_FOUND:
 *         console.log('No active tab found');
 *         break;
 *       case ErrorCode.JAVASCRIPT_ERROR:
 *         console.log('Failed to execute position script');
 *         break;
 *     }
 *   } else {
 *     console.log(`Scroll position: ${result.data.position.x}, ${result.data.position.y}`);
 *     console.log(`Viewport: ${result.data.viewport?.width}x${result.data.viewport?.height}`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected position retrieval error:', error);
 * }
 * 
 * // Get position from specific tab and window
 * const specificResult = await getScrollPosition(2, 1, 5000);
 * ```
 */
export async function getScrollPosition(
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<Result<ScrollResult, string>> {
  const javascript = `
(() => {
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return {
    scrolled: false,
    position: { x: scrollX, y: scrollY },
    viewport: { width: viewportWidth, height: viewportHeight }
  };
})()`;

  // Execute with error context
  const executeResult = await executeWithContext(async () => {
    const result = await execChromeJS<ScrollResult>(javascript, tabIndex, windowIndex, timeoutMs);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get scroll position');
    }
    
    return result.data as ScrollResult;
  }, 'get scroll position');
  
  return mapError(executeResult, (err) => err.message);
}