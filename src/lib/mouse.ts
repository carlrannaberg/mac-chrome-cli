import { getScreenCoordinates, validateElementVisibility, type CoordinateResult } from './coords.js';
import { clickAt, doubleClickAt, rightClickAt, moveTo, dragFromTo, type ClickOptions } from './ui.js';
import { ERROR_CODES, validateInput, type ErrorCode } from './util.js';
import { Result, ok, error } from '../core/index.js';

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

/**
 * Mouse action data
 */
export interface MouseActionData {
  action: string;
  coordinates?: { x: number; y: number };
  element?: {
    selector: string;
    visible: boolean;
    clickable: boolean;
  };
}

/**
 * Mouse action result using unified Result<T,E> pattern
 */
export type MouseResult = Result<MouseActionData, string>;

/**
 * Legacy MouseResult interface for backward compatibility
 * @deprecated Use MouseResult (Result<MouseActionData, string>) instead
 */
export interface LegacyMouseResult {
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
    return error(
      'Must provide either selector or x,y coordinates',
      ERROR_CODES.INVALID_INPUT
    );
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
 * Click at element or coordinates
 */
export async function mouseClick(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return error(
        validation.error || 'Validation failed',
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.data?.coordinates) {
      return error(
        coordsResult.error || 'Failed to get target coordinates',
        coordsResult.code
      );
    }
    
    // Validate element visibility if using selector
    if (options.selector) {
      const visibility = await validateElementVisibility(options.selector, options.windowIndex || 1);
      if (!visibility.success || !visibility.data) {
        return error(
          'Failed to validate element visibility',
          ERROR_CODES.UNKNOWN_ERROR
        );
      }
      
      if (!visibility.data.visible) {
        return error(
          `Element "${options.selector}" is not visible`,
          ERROR_CODES.TARGET_NOT_FOUND
        );
      }
      
      if (!visibility.data.clickable) {
        return error(
          `Element "${options.selector}" is not clickable`,
          ERROR_CODES.TARGET_NOT_FOUND
        );
      }
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.data.coordinates!.x,
      coordsResult.data.coordinates!.y,
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
    
    const uiResult = await clickAt(finalCoords.x, finalCoords.y, { ...clickOptions, windowIndex: options.windowIndex || 1 });
    if (uiResult.success) {
      return ok({
        action: 'click',
        coordinates: finalCoords,
        ...(options.selector && {
          element: {
            selector: options.selector,
            visible: true,
            clickable: true
          }
        })
      }, uiResult.code);
    }
    return error(
      uiResult.error || 'Click failed',
      uiResult.code
    );
    
  } catch (err) {
    return error(
      `Mouse click failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Double-click at element or coordinates
 */
export async function mouseDoubleClick(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return error(
        validation.error || 'Validation failed',
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.data?.coordinates) {
      return error(
        coordsResult.error || 'Failed to get target coordinates',
        coordsResult.code
      );
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.data.coordinates!.x,
      coordsResult.data.coordinates!.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform double-click
    const uiResult = await doubleClickAt(finalCoords.x, finalCoords.y);
    if (uiResult.success) {
      return ok({
        action: 'double_click',
        coordinates: finalCoords,
        ...(options.selector && {
          element: {
            selector: options.selector,
            visible: true,
            clickable: true
          }
        })
      }, uiResult.code);
    }
    return error(
      uiResult.error || 'Double-click failed',
      uiResult.code
    );
    
  } catch (err) {
    return error(
      `Mouse double-click failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Right-click (context menu) at element or coordinates
 */
export async function mouseRightClick(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return error(
        validation.error || 'Validation failed',
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.data?.coordinates) {
      return error(
        coordsResult.error || 'Failed to get target coordinates',
        coordsResult.code
      );
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.data.coordinates!.x,
      coordsResult.data.coordinates!.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform right-click
    const uiResult = await rightClickAt(finalCoords.x, finalCoords.y);
    if (uiResult.success) {
      return ok({
        action: 'right_click',
        coordinates: finalCoords,
        ...(options.selector && {
          element: {
            selector: options.selector,
            visible: true,
            clickable: true
          }
        })
      }, uiResult.code);
    }
    return error(
      uiResult.error || 'Right-click failed',
      uiResult.code
    );
    
  } catch (err) {
    return error(
      `Mouse right-click failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Move mouse to element or coordinates
 */
export async function mouseMove(options: MouseOptions): Promise<MouseResult> {
  try {
    const validation = validateMouseOptions(options);
    if (!validation.valid) {
      return error(
        validation.error || 'Validation failed',
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    // Get target coordinates
    const coordsResult = await getTargetCoordinates(options);
    if (!coordsResult.success || !coordsResult.data?.coordinates) {
      return error(
        coordsResult.error || 'Failed to get target coordinates',
        coordsResult.code
      );
    }
    
    // Apply offset if specified
    const finalCoords = applyOffset(
      coordsResult.data.coordinates!.x,
      coordsResult.data.coordinates!.y,
      options.offsetX,
      options.offsetY
    );
    
    // Perform mouse move
    const uiResult = await moveTo(finalCoords.x, finalCoords.y, { windowIndex: options.windowIndex || 1 });
    if (uiResult.success) {
      return ok({
        action: 'move',
        coordinates: finalCoords,
        ...(options.selector && {
          element: {
            selector: options.selector,
            visible: true,
            clickable: true
          }
        })
      }, uiResult.code);
    }
    return error(
      uiResult.error || 'Move failed',
      uiResult.code
    );
    
  } catch (err) {
    return error(
      `Mouse move failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
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
      return error(
        `Source: ${fromValidation.error}`,
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    const toValidation = validateMouseOptions(toOptions);
    if (!toValidation.valid) {
      return error(
        `Target: ${toValidation.error}`,
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    // Get source coordinates
    const fromCoordsResult = await getTargetCoordinates(fromOptions);
    if (!fromCoordsResult.success || !fromCoordsResult.data?.coordinates) {
      return error(
        `Source: ${fromCoordsResult.error || 'Failed to get coordinates'}`,
        fromCoordsResult.code
      );
    }
    
    // Get target coordinates
    const toCoordsResult = await getTargetCoordinates(toOptions);
    if (!toCoordsResult.success || !toCoordsResult.data?.coordinates) {
      return error(
        `Target: ${toCoordsResult.error || 'Failed to get coordinates'}`,
        toCoordsResult.code
      );
    }
    
    // Apply offsets
    const fromCoords = applyOffset(
      fromCoordsResult.data.coordinates!.x,
      fromCoordsResult.data.coordinates!.y,
      fromOptions.offsetX,
      fromOptions.offsetY
    );
    
    const toCoords = applyOffset(
      toCoordsResult.data.coordinates!.x,
      toCoordsResult.data.coordinates!.y,
      toOptions.offsetX,
      toOptions.offsetY
    );
    
    // Perform drag
    const uiResult = await dragFromTo(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y, { windowIndex: fromOptions.windowIndex || 1 });
    if (uiResult.success) {
      return ok({
        action: 'drag',
        coordinates: toCoords,
        ...(toOptions.selector && {
          element: {
            selector: toOptions.selector,
            visible: true,
            clickable: true
          }
        })
      }, uiResult.code);
    }
    return error(
      uiResult.error || 'Drag failed',
      uiResult.code
    );
    
  } catch (err) {
    return error(
      `Mouse drag failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Context menu click (alias for right-click)
 */
export async function mouseContext(options: MouseOptions): Promise<MouseResult> {
  return mouseRightClick(options);
}