import { execChromeJS, type JavaScriptResult } from '../lib/apple.js';
import { ERROR_CODES, validateInput } from '../lib/util.js';

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
): Promise<JavaScriptResult<ScrollResult>> {
  if (!validateInput(selector, 'string')) {
    return {
      success: false,
      error: 'Invalid selector parameter',
      code: ERROR_CODES.INVALID_INPUT
    };
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

  const result = await execChromeJS<ScrollResult>(javascript, tabIndex, windowIndex, timeoutMs);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to scroll to element',
      code: result.code
    };
  }

  return result;
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
): Promise<JavaScriptResult<ScrollResult>> {
  if (!validateInput(pixels, 'number')) {
    return {
      success: false,
      error: 'Invalid pixels parameter',
      code: ERROR_CODES.INVALID_INPUT
    };
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

  const result = await execChromeJS<ScrollResult>(javascript, tabIndex, windowIndex, timeoutMs);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to scroll by pixels',
      code: result.code
    };
  }

  return result;
}

/**
 * Get current scroll position
 */
export async function getScrollPosition(
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<JavaScriptResult<ScrollResult>> {
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

  const result = await execChromeJS<ScrollResult>(javascript, tabIndex, windowIndex, timeoutMs);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to get scroll position',
      code: result.code
    };
  }

  return result;
}