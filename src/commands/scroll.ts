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