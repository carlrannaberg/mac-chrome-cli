import { getScreenCoordinates, validateElementVisibility, type CoordinateResult } from './coords.js';
import { clickAt, doubleClickAt, rightClickAt, moveTo, dragFromTo, type ClickOptions, type UIResult } from './ui.js';
import { ERROR_CODES, validateInput, type ErrorCode } from './util.js';

export interface MouseOptions {
  selector?: string;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  offsetX?: number;
  offsetY?: number;
  windowIndex?: number;
}

export interface MouseResult {
  success: boolean;
  action: string;
  coordinates?: { x: number; y: number } | undefined;
  element?: {
    selector: string;
    visible: boolean;
    clickable: boolean;
  } | undefined;
  error?: string | undefined;
  code: ErrorCode;
}

/**
 * Validate mouse operation options
 */
function validateMouseOptions(options: MouseOptions): { valid: boolean; error?: string } {
  // Must have either selector or x,y coordinates
  if (!options.selector && (options.x === undefined || options.y === undefined)) {
    return { valid: false, error: 'Must provide either selector or x,y coordinates' };
  }
  
  // Validate coordinates if provided
  if (options.x !== undefined && !validateInput(options.x, 'number')) {
    return { valid: false, error: 'Invalid x coordinate' };
  }
  
  if (options.y !== undefined && !validateInput(options.y, 'number')) {
    return { valid: false, error: 'Invalid y coordinate' };
  }
  
  // Validate selector if provided
  if (options.selector && !validateInput(options.selector, 'string')) {
    return { valid: false, error: 'Invalid selector' };
  }
  
  return { valid: true };
}

/**
 * Get target coordinates for mouse operation
 */
async function getTargetCoordinates(options: MouseOptions): Promise<CoordinateResult> {
  const windowIndex = options.windowIndex || 1;
  
  if (options.selector) {
    return getScreenCoordinates({ selector: options.selector }, windowIndex);
  } else if (options.x !== undefined && options.y !== undefined) {
    return getScreenCoordinates({ x: options.x, y: options.y }, windowIndex);
  } else {
    return {
      success: false,
      error: 'Must provide either selector or x,y coordinates',
      code: ERROR_CODES.INVALID_INPUT
    };
  }
}

/**
 * Apply offset to coordinates
 */
function applyOffset(
  x: number, 
  y: number, 
  offsetX: number = 0, 
  offsetY: number = 0
): { x: number; y: number } {
  return {
    x: x + offsetX,
    y: y + offsetY
  };
}

/**
 * Convert UI result to mouse result
 */
function convertUIResult(uiResult: UIResult, action: string, options: MouseOptions): MouseResult {
  const result: MouseResult = {
    success: uiResult.success,
    action,
    code: uiResult.code
  };
  
  if (uiResult.coordinates !== undefined) {
    result.coordinates = uiResult.coordinates;
  }
  
  if (uiResult.error !== undefined) {
    result.error = uiResult.error;
  }
  
  if (options.selector) {
    result.element = {
      selector: options.selector,
      visible: uiResult.success, // If UI action succeeded, element was visible
      clickable: uiResult.success
    };
  }
  
  return result;
}

/**
 * Click at element or coordinates
 */
export async function mouseClick(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'click',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.coordinates) {
      return {
        success: false,
        action: 'click',
        error: coordsResult.error || 'Failed to get target coordinates',
        code: coordsResult.code
      };
    }
    
    // Validate element visibility if using selector
    if (options.selector) {
      const visibility = await validateElementVisibility(options.selector, options.windowIndex || 1);
      if (!visibility.success || !visibility.result) {
        return {
          success: false,
          action: 'click',
          error: 'Failed to validate element visibility',
          code: ERROR_CODES.UNKNOWN_ERROR
        };
      }
      
      if (!visibility.result.visible) {
        return {
          success: false,
          action: 'click',
          error: `Element "${options.selector}" is not visible`,
          code: ERROR_CODES.TARGET_NOT_FOUND
        };
      }
      
      if (!visibility.result.clickable) {
        return {
          success: false,
          action: 'click',
          error: `Element "${options.selector}" is not clickable`,
          code: ERROR_CODES.TARGET_NOT_FOUND
        };
      }
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.coordinates.x,
      coordsResult.coordinates.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform click
    const clickOptions: ClickOptions = {};
    if (options.button !== undefined) {
      clickOptions.button = options.button;
    }
    if (options.clickCount !== undefined) {
      clickOptions.clickCount = options.clickCount;
    }
    
    const uiResult = await clickAt(finalCoords.x, finalCoords.y, clickOptions);
    return convertUIResult(uiResult, 'click', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'click',
      error: `Mouse click failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Double-click at element or coordinates
 */
export async function mouseDoubleClick(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'double_click',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.coordinates) {
      return {
        success: false,
        action: 'double_click',
        error: coordsResult.error || 'Failed to get target coordinates',
        code: coordsResult.code
      };
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.coordinates.x,
      coordsResult.coordinates.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform double-click
    const uiResult = await doubleClickAt(finalCoords.x, finalCoords.y);
    return convertUIResult(uiResult, 'double_click', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'double_click',
      error: `Mouse double-click failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Right-click (context menu) at element or coordinates
 */
export async function mouseRightClick(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'right_click',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.coordinates) {
      return {
        success: false,
        action: 'right_click',
        error: coordsResult.error || 'Failed to get target coordinates',
        code: coordsResult.code
      };
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.coordinates.x,
      coordsResult.coordinates.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform right-click
    const uiResult = await rightClickAt(finalCoords.x, finalCoords.y);
    return convertUIResult(uiResult, 'right_click', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'right_click',
      error: `Mouse right-click failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Move mouse to element or coordinates
 */
export async function mouseMove(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'move',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.coordinates) {
      return {
        success: false,
        action: 'move',
        error: coordsResult.error || 'Failed to get target coordinates',
        code: coordsResult.code
      };
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.coordinates.x,
      coordsResult.coordinates.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform mouse move
    const uiResult = await moveTo(finalCoords.x, finalCoords.y);
    return convertUIResult(uiResult, 'move', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'move',
      error: `Mouse move failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Drag from one location to another
 */
export async function mouseDrag(
  fromOptions: MouseOptions,
  toOptions: MouseOptions
): Promise<MouseResult> {
  try {
    // Validate both source and target options
    const fromValidation = validateMouseOptions(fromOptions);
    if (!fromValidation.valid) {
      return {
        success: false,
        action: 'drag',
        error: `Source: ${fromValidation.error}`,
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    const toValidation = validateMouseOptions(toOptions);
    if (!toValidation.valid) {
      return {
        success: false,
        action: 'drag',
        error: `Target: ${toValidation.error}`,
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    // Get source coordinates
    const fromCoordsResult = await getTargetCoordinates(fromOptions);
    if (!fromCoordsResult.success || !fromCoordsResult.coordinates) {
      return {
        success: false,
        action: 'drag',
        error: `Source: ${fromCoordsResult.error || 'Failed to get coordinates'}`,
        code: fromCoordsResult.code
      };
    }
    
    // Get target coordinates
    const toCoordsResult = await getTargetCoordinates(toOptions);
    if (!toCoordsResult.success || !toCoordsResult.coordinates) {
      return {
        success: false,
        action: 'drag',
        error: `Target: ${toCoordsResult.error || 'Failed to get coordinates'}`,
        code: toCoordsResult.code
      };
    }
    
    // Apply offsets
    const fromCoords = applyOffset(
      fromCoordsResult.coordinates.x,
      fromCoordsResult.coordinates.y,
      fromOptions.offsetX,
      fromOptions.offsetY
    );
    
    const toCoords = applyOffset(
      toCoordsResult.coordinates.x,
      toCoordsResult.coordinates.y,
      toOptions.offsetX,
      toOptions.offsetY
    );
    
    // Perform drag
    const uiResult = await dragFromTo(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y);
    return convertUIResult(uiResult, 'drag', toOptions);
    
  } catch (error) {
    return {
      success: false,
      action: 'drag',
      error: `Mouse drag failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Context menu click (alias for right-click)
 */
export async function mouseContext(options: MouseOptions): Promise<MouseResult> {
  return mouseRightClick(options);
}