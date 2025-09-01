/**
 * @fileoverview Mouse command implementation with unified Result<T,E> pattern
 * 
 * This module provides mouse interaction functionality using the service-oriented
 * architecture with standardized error handling and result types. Supports clicking,
 * moving, dragging, and various mouse actions with element visibility validation.
 * 
 * @example
 * ```typescript
 * // Click on element by selector
 * const result = await mouseCmd.click({ 
 *   selector: '#submit-button',
 *   button: 'left'
 * });
 * 
 * // Click at specific coordinates
 * const coordResult = await mouseCmd.click({
 *   x: 100,
 *   y: 200,
 *   button: 'right'
 * });
 * 
 * // Drag from one element to another
 * const dragResult = await mouseCmd.drag(
 *   { selector: '#source' },
 *   { selector: '#target' }
 * );
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { Result, ok, error } from '../core/Result.js';
import { 
  mouseClick,
  mouseMove,
  mouseDrag,
  mouseDoubleClick,
  mouseRightClick,
  type MouseOptions as LibMouseOptions,
  type MouseActionData
} from '../lib/mouse.js';
import { type RecoveryStrategy } from '../core/Result.js';
import { validateElementVisibility } from '../lib/coords.js';
import { ErrorCode, getErrorInfo } from '../core/ErrorCodes.js';
import { scrollToElement } from './scroll.js';

/**
 * Mouse click options with enhanced validation and type safety
 */
export interface MouseClickOptions {
  /** CSS selector for the target element */
  selector?: string;
  /** Viewport X coordinate (alternative to selector) */
  x?: number;
  /** Viewport Y coordinate (alternative to selector) */
  y?: number;
  /** Mouse button to use for clicking */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks (1=single, 2=double, etc.) */
  clickCount?: number;
  /** X offset from element center (when using selector) */
  offsetX?: number;
  /** Y offset from element center (when using selector) */
  offsetY?: number;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Mouse move options with enhanced validation and type safety
 */
export interface MouseMoveOptions {
  /** CSS selector for the target element */
  selector?: string;
  /** Viewport X coordinate (alternative to selector) */
  x?: number;
  /** Viewport Y coordinate (alternative to selector) */
  y?: number;
  /** X offset from element center (when using selector) */
  offsetX?: number;
  /** Y offset from element center (when using selector) */
  offsetY?: number;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Mouse operation options for CommandRegistry compatibility
 * Re-exports MouseClickOptions as the primary interface for CLI usage
 */
export type MouseOptions = MouseClickOptions;

/**
 * Internal mouse action type for consolidated processing
 */
type MouseActionType = 'click' | 'right-click' | 'double-click';

/**
 * Internal interface for mouse action functions
 */
type MouseActionFunction = (options: LibMouseOptions) => Promise<Result<MouseActionData, string>>;

/**
 * Mouse command implementation providing comprehensive mouse interaction capabilities
 * 
 * Integrates with the existing mouse library while providing enhanced validation,
 * error handling, and element visibility checking. Supports all common mouse operations
 * including clicking, moving, dragging, and context menu interactions.
 * 
 * @extends BrowserCommandBase
 */
export class MouseCommand extends BrowserCommandBase {
  
  /**
   * Perform a mouse click action with automatic element scrolling
   * 
   * Clicks on the specified element (by selector) or at specific coordinates.
   * Automatically scrolls elements into view and validates visibility before clicking.
   * 
   * @param options Mouse click configuration options
   * @returns Promise resolving to mouse action result with coordinates
   * 
   * @throws {INVALID_INPUT} When neither selector nor coordinates provided, or both provided
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_COORDINATES} When x/y coordinates are negative or non-finite
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {ELEMENT_NOT_VISIBLE} When target element exists but is not visible in viewport
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element cannot be clicked (disabled, hidden)
   * @throws {TARGET_OUTSIDE_VIEWPORT} When element cannot be scrolled into viewport
   * @throws {MULTIPLE_TARGETS_FOUND} When selector matches multiple elements (ambiguous target)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element validation
   * @throws {PERMISSION_DENIED} When system permissions block mouse automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {MOUSE_CLICK_FAILED} When mouse click operation fails at system level
   * @throws {COORDINATE_CALCULATION_FAILED} When cannot calculate screen coordinates for element
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When click operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution for element location times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent mouse operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during click operation
   * 
   * @example
   * ```typescript
   * // Click element by selector with error handling
   * try {
   *   const result = await mouseCmd.click({ selector: '#submit-button' });
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Button not found - check selector');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_VISIBLE:
   *         console.log('Button exists but not visible - may be hidden');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('Button is disabled or not clickable');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions in System Preferences');
   *         break;
   *     }
   *   } else {
   *     console.log(`Clicked at coordinates: ${result.data.x}, ${result.data.y}`);
   *   }
   * } catch (error) {
   *   console.error('Unexpected click error:', error);
   * }
   * 
   * // Click at specific coordinates
   * const coordResult = await mouseCmd.click({ x: 100, y: 200, button: 'right' });
   * ```
   */
  async click(options: MouseClickOptions): Promise<Result<MouseActionData, string>> {
    return this.performMouseAction(options, 'click', mouseClick);
  }
  
  /**
   * Perform a mouse move action with automatic element scrolling
   * 
   * Moves the mouse cursor to the specified element (by selector) or coordinates.
   * Automatically scrolls elements into view for consistency with click operations.
   * 
   * @param options Mouse move configuration options
   * @returns Promise resolving to mouse action result with coordinates
   * 
   * @throws {INVALID_INPUT} When neither selector nor coordinates provided, or both provided
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_COORDINATES} When x/y coordinates are negative or non-finite
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {TARGET_OUTSIDE_VIEWPORT} When element cannot be scrolled into viewport
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element location
   * @throws {PERMISSION_DENIED} When system permissions block mouse automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {COORDINATE_CALCULATION_FAILED} When cannot calculate screen coordinates for element
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When move operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution for element location times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent mouse operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during move operation
   * 
   * @example
   * ```typescript
   * // Move to element with error handling
   * try {
   *   const result = await mouseCmd.move({ selector: '#hover-target' });
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Hover target not found');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Start Chrome browser first');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected move error:', error);
   * }
   * 
   * // Move to specific coordinates
   * const coordResult = await mouseCmd.move({ x: 150, y: 250 });
   * ```
   */
  async move(options: MouseMoveOptions): Promise<Result<MouseActionData, string>> {
    const validationResult = this.validateMouseOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<MouseActionData, string>;
    }
    
    // If selector provided, scroll element into view for consistency
    if (options.selector) {
      await this.scrollElementIntoView(
        options.selector,
        options.windowIndex || 1
      );
    }
    
    // Convert to MouseOptions format for the existing mouse library
    const mouseOptions: LibMouseOptions = {
      ...(options.selector && { selector: options.selector }),
      ...(options.x !== undefined && { x: options.x }),
      ...(options.y !== undefined && { y: options.y }),
      ...(options.offsetX !== undefined && { offsetX: options.offsetX }),
      ...(options.offsetY !== undefined && { offsetY: options.offsetY }),
      ...(options.windowIndex && { windowIndex: options.windowIndex })
    };
    
    return this.executeBrowserCommand(
      async () => {
        const result = await mouseMove(mouseOptions);
        if (result.success && result.data) {
          return result.data;
        }
        throw new Error(result.error || 'Mouse move failed');
      },
      'mouse-move'
    );
  }
  
  /**
   * Perform a mouse drag action
   * 
   * Drags from one location to another, supporting both element selectors and coordinates.
   * Useful for drag-and-drop operations, scrolling, and element repositioning.
   * 
   * @param fromOptions Starting position for drag operation
   * @param toOptions Ending position for drag operation
   * @returns Promise resolving to mouse action result with start/end coordinates
   * 
   * @throws {INVALID_INPUT} When neither selector nor coordinates provided for either position
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid for either position
   * @throws {INVALID_COORDINATES} When x/y coordinates are negative or non-finite
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements for either position
   * @throws {TARGET_OUTSIDE_VIEWPORT} When elements cannot be scrolled into viewport
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element location
   * @throws {PERMISSION_DENIED} When system permissions block mouse automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {COORDINATE_CALCULATION_FAILED} When cannot calculate screen coordinates for elements
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When drag operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution for element location times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent mouse operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during drag operation
   * 
   * @example
   * ```typescript
   * // Drag from one element to another with error handling
   * try {
   *   const result = await mouseCmd.drag(
   *     { selector: '#source-item' },
   *     { selector: '#drop-zone' }
   *   );
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Source or target element not found');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions for drag operations');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected drag error:', error);
   * }
   * 
   * // Drag from coordinates to element
   * const coordDrag = await mouseCmd.drag(
   *   { x: 100, y: 100 },
   *   { selector: '#target-area' }
   * );
   * ```
   */
  async drag(fromOptions: MouseMoveOptions, toOptions: MouseMoveOptions): Promise<Result<MouseActionData, string>> {
    const fromValidation = this.validateMouseOptions(fromOptions);
    if (!fromValidation.success) {
      return fromValidation as Result<MouseActionData, string>;
    }
    
    const toValidation = this.validateMouseOptions(toOptions);
    if (!toValidation.success) {
      return toValidation as Result<MouseActionData, string>;
    }
    
    // Convert to MouseOptions format for the existing mouse library
    const fromMouseOptions: LibMouseOptions = {
      ...(fromOptions.selector && { selector: fromOptions.selector }),
      ...(fromOptions.x !== undefined && { x: fromOptions.x }),
      ...(fromOptions.y !== undefined && { y: fromOptions.y }),
      ...(fromOptions.offsetX !== undefined && { offsetX: fromOptions.offsetX }),
      ...(fromOptions.offsetY !== undefined && { offsetY: fromOptions.offsetY }),
      ...(fromOptions.windowIndex && { windowIndex: fromOptions.windowIndex })
    };
    
    const toMouseOptions: LibMouseOptions = {
      ...(toOptions.selector && { selector: toOptions.selector }),
      ...(toOptions.x !== undefined && { x: toOptions.x }),
      ...(toOptions.y !== undefined && { y: toOptions.y }),
      ...(toOptions.offsetX !== undefined && { offsetX: toOptions.offsetX }),
      ...(toOptions.offsetY !== undefined && { offsetY: toOptions.offsetY }),
      ...(toOptions.windowIndex && { windowIndex: toOptions.windowIndex })
    };
    
    return this.executeBrowserCommand(
      async () => {
        const result = await mouseDrag(fromMouseOptions, toMouseOptions);
        if (result.success && result.data) {
          return result.data;
        }
        throw new Error(result.error || 'Mouse drag failed');
      },
      'mouse-drag'
    );
  }
  
  /**
   * Perform a double-click action with automatic element scrolling
   * 
   * Double-clicks on the specified element (by selector) or at specific coordinates.
   * Automatically scrolls elements into view and validates visibility before double-clicking.
   * 
   * @param options Mouse double-click configuration options
   * @returns Promise resolving to mouse action result with coordinates
   * 
   * @throws {INVALID_INPUT} When neither selector nor coordinates provided, or both provided
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_COORDINATES} When x/y coordinates are negative or non-finite
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {ELEMENT_NOT_VISIBLE} When target element exists but is not visible in viewport
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element cannot be double-clicked (disabled, hidden)
   * @throws {TARGET_OUTSIDE_VIEWPORT} When element cannot be scrolled into viewport
   * @throws {MULTIPLE_TARGETS_FOUND} When selector matches multiple elements (ambiguous target)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element validation
   * @throws {PERMISSION_DENIED} When system permissions block mouse automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {MOUSE_CLICK_FAILED} When mouse double-click operation fails at system level
   * @throws {COORDINATE_CALCULATION_FAILED} When cannot calculate screen coordinates for element
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When double-click operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution for element location times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent mouse operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during double-click operation
   * 
   * @example
   * ```typescript
   * // Double-click element with error handling
   * try {
   *   const result = await mouseCmd.doubleClick({ selector: '#editable-text' });
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Text element not found for double-click');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('Element cannot be double-clicked (may be disabled)');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected double-click error:', error);
   * }
   * ```
   */
  async doubleClick(options: MouseClickOptions): Promise<Result<MouseActionData, string>> {
    return this.performMouseAction(options, 'double-click', mouseDoubleClick);
  }
  
  /**
   * Perform a right-click (context menu) action with automatic element scrolling
   * 
   * Right-clicks on the specified element (by selector) or at specific coordinates.
   * Automatically scrolls elements into view and validates visibility before right-clicking.
   * Typically used to open context menus.
   * 
   * @param options Mouse right-click configuration options
   * @returns Promise resolving to mouse action result with coordinates
   * 
   * @throws {INVALID_INPUT} When neither selector nor coordinates provided, or both provided
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_COORDINATES} When x/y coordinates are negative or non-finite
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {ELEMENT_NOT_VISIBLE} When target element exists but is not visible in viewport
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element cannot be right-clicked (disabled, hidden)
   * @throws {TARGET_OUTSIDE_VIEWPORT} When element cannot be scrolled into viewport
   * @throws {MULTIPLE_TARGETS_FOUND} When selector matches multiple elements (ambiguous target)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element validation
   * @throws {PERMISSION_DENIED} When system permissions block mouse automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {MOUSE_CLICK_FAILED} When mouse right-click operation fails at system level
   * @throws {COORDINATE_CALCULATION_FAILED} When cannot calculate screen coordinates for element
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When right-click operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution for element location times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent mouse operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during right-click operation
   * 
   * @example
   * ```typescript
   * // Right-click to open context menu with error handling
   * try {
   *   const result = await mouseCmd.rightClick({ selector: '#context-target' });
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Context menu target not found');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_VISIBLE:
   *         console.log('Target element not visible for context menu');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected right-click error:', error);
   * }
   * ```
   */
  async rightClick(options: MouseClickOptions): Promise<Result<MouseActionData, string>> {
    return this.performMouseAction(options, 'right-click', mouseRightClick);
  }
  
  /**
   * Perform a mouse action with unified validation, scrolling, and error handling
   */
  private async performMouseAction(
    options: MouseClickOptions,
    actionType: MouseActionType,
    actionFunction: MouseActionFunction
  ): Promise<Result<MouseActionData, string>> {
    // Validate input options
    const validationResult = this.validateMouseOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<MouseActionData, string>;
    }
    
    // If selector provided, scroll element into view and validate visibility
    if (options.selector) {
      const elementValidationResult = await this.validateAndPrepareElement(
        options.selector,
        options.windowIndex || 1,
        actionType
      );
      
      if (!elementValidationResult.success) {
        return elementValidationResult;
      }
    }
    
    // Convert to MouseOptions format for the existing mouse library
    const mouseOptions = this.convertToLibMouseOptions(options);
    
    // Execute the mouse action with unified error handling
    return this.executeBrowserCommand(
      async () => {
        const result = await actionFunction(mouseOptions);
        if (result.success && result.data) {
          return result.data;
        }
        
        // Determine appropriate error code and recovery strategy
        const errorCode = result.code || ErrorCode.UNKNOWN_ERROR;
        const actionName = this.getActionDisplayName(actionType);
        const errorWithRecovery = error(
          result.error || `Mouse ${actionName} failed`,
          errorCode,
          {
            recoveryHint: this.determineMouseRecoveryStrategy(errorCode),
            metadata: { 
              selector: options.selector, 
              coordinates: options.x !== undefined && options.y !== undefined ? { x: options.x, y: options.y } : undefined,
              operation: actionType 
            }
          }
        );
        throw new Error(errorWithRecovery.error);
      },
      `mouse-${actionType}`
    );
  }
  
  /**
   * Validate element visibility and prepare it for mouse interaction
   */
  private async validateAndPrepareElement(
    selector: string,
    windowIndex: number,
    actionType: MouseActionType
  ): Promise<Result<void, string>> {
    // Automatically scroll element into view
    const scrollResult = await this.scrollElementIntoView(selector, windowIndex);
    if (!scrollResult.success) {
      return scrollResult;
    }
    
    // Validate element visibility and interactability
    const visibilityResult = await validateElementVisibility(selector, windowIndex);
    
    if (!visibilityResult.success) {
      // Use the original error code to determine recovery strategy  
      const originalErrorCode = visibilityResult.code || ErrorCode.JAVASCRIPT_ERROR;
      return error(`Element validation failed: ${visibilityResult.error}`, ErrorCode.JAVASCRIPT_ERROR, {
        recoveryHint: this.determineMouseRecoveryStrategy(originalErrorCode),
        metadata: { selector, operation: actionType }
      });
    }
    
    if (!visibilityResult.data?.visible) {
      return error(`Element "${selector}" is not visible`, ErrorCode.ELEMENT_NOT_VISIBLE, {
        recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_VISIBLE),
        metadata: { selector, operation: actionType }
      });
    }
    
    if (!visibilityResult.data?.clickable) {
      return error(`Element "${selector}" is not clickable`, ErrorCode.ELEMENT_NOT_INTERACTABLE, {
        recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_INTERACTABLE),
        metadata: { selector, operation: actionType }
      });
    }
    
    return ok(undefined);
  }
  
  /**
   * Convert command options to library mouse options format
   */
  private convertToLibMouseOptions(options: MouseClickOptions): LibMouseOptions {
    return {
      ...(options.selector && { selector: options.selector }),
      ...(options.x !== undefined && { x: options.x }),
      ...(options.y !== undefined && { y: options.y }),
      ...(options.button && { button: options.button }),
      ...(options.offsetX !== undefined && { offsetX: options.offsetX }),
      ...(options.offsetY !== undefined && { offsetY: options.offsetY }),
      ...(options.windowIndex && { windowIndex: options.windowIndex })
    };
  }
  
  /**
   * Get display name for mouse action type
   */
  private getActionDisplayName(actionType: MouseActionType): string {
    switch (actionType) {
      case 'click': return 'click';
      case 'double-click': return 'double-click';
      case 'right-click': return 'right-click';
      default: return actionType;
    }
  }
  
  /**
   * Validate mouse operation options
   */
  private validateMouseOptions(options: MouseClickOptions | MouseMoveOptions): Result<void, string> {
    // Must have either selector or coordinates
    if (options.selector === undefined && (options.x === undefined || options.y === undefined)) {
      return error('Must provide either selector or x,y coordinates', ErrorCode.INVALID_INPUT);
    }
    
    // Cannot have both selector and coordinates
    if (options.selector !== undefined && (options.x !== undefined || options.y !== undefined)) {
      return error('Cannot specify both selector and coordinates', ErrorCode.INVALID_INPUT);
    }
    
    // Validate selector if provided
    if (options.selector !== undefined) {
      if (!options.selector || typeof options.selector !== 'string' || options.selector.trim().length === 0) {
        return error('Selector cannot be empty', ErrorCode.INVALID_SELECTOR);
      }
      
      const selectorValidation = this.validateSelector(options.selector);
      if (!selectorValidation.success) {
        // Convert INVALID_INPUT from base validation to INVALID_SELECTOR for mouse operations
        return error(selectorValidation.error, ErrorCode.INVALID_SELECTOR, selectorValidation.context);
      }
    }
    
    // Validate coordinates if provided
    if (options.x !== undefined && (!Number.isFinite(options.x) || options.x < 0)) {
      return error('X coordinate must be a non-negative finite number', ErrorCode.INVALID_COORDINATES);
    }
    
    if (options.y !== undefined && (!Number.isFinite(options.y) || options.y < 0)) {
      return error('Y coordinate must be a non-negative finite number', ErrorCode.INVALID_COORDINATES);
    }
    
    // Validate button if provided (for click options)
    if ('button' in options && options.button && !['left', 'right', 'middle'].includes(options.button)) {
      return error(`Invalid mouse button: ${options.button}`, ErrorCode.INVALID_INPUT);
    }
    
    // Validate offsets if provided
    if (options.offsetX !== undefined && !Number.isFinite(options.offsetX)) {
      return error('X offset must be a finite number', ErrorCode.INVALID_COORDINATES);
    }
    
    if (options.offsetY !== undefined && !Number.isFinite(options.offsetY)) {
      return error('Y offset must be a finite number', ErrorCode.INVALID_COORDINATES);
    }
    
    // Validate window index if provided
    if (options.windowIndex !== undefined && (!Number.isInteger(options.windowIndex) || options.windowIndex < 1)) {
      return error('Window index must be a positive integer', ErrorCode.INVALID_INPUT);
    }
    
    return ok(undefined);
  }
  
  /**
   * Scroll element into view with error handling
   */
  private async scrollElementIntoView(
    selector: string, 
    windowIndex: number = 1
  ): Promise<Result<void, string>> {
    try {
      const scrollResult = await scrollToElement(
        selector, 
        false, // Use instant scrolling for reliability
        1, // tabIndex
        windowIndex,
        5000 // 5 second timeout
      );
      
      if (!scrollResult.success) {
        return error(
          `Failed to scroll element into view: ${scrollResult.error}`,
          ErrorCode.TARGET_OUTSIDE_VIEWPORT
        );
      }
      
      return ok(undefined);
    } catch (err) {
      return error(
        `Error scrolling element into view: ${err}`,
        ErrorCode.JAVASCRIPT_ERROR
      );
    }
  }
  
  /**
   * Determine appropriate recovery strategy based on error code
   */
  private determineMouseRecoveryStrategy(errorCode: ErrorCode): RecoveryStrategy {
    const errorInfo = getErrorInfo(errorCode);
    
    switch (errorCode) {
      case ErrorCode.ELEMENT_NOT_VISIBLE:
        return 'retry';
      case ErrorCode.ELEMENT_NOT_INTERACTABLE:
        return 'retry_with_delay';
      case ErrorCode.TARGET_NOT_FOUND:
        return 'check_target';
      case ErrorCode.TARGET_OUTSIDE_VIEWPORT:
        return 'retry';
      case ErrorCode.INVALID_COORDINATES:
        return 'not_recoverable';
      case ErrorCode.INVALID_SELECTOR:
        return 'not_recoverable';
      case ErrorCode.PERMISSION_DENIED:
      case ErrorCode.ACCESSIBILITY_DENIED:
        return 'permission';
      case ErrorCode.TIMEOUT:
      case ErrorCode.SCRIPT_TIMEOUT:
        return 'retry_with_delay';
      case ErrorCode.CHROME_NOT_RUNNING:
      case ErrorCode.CHROME_NOT_FOUND:
        return 'not_recoverable';
      default:
        // Use the standard recovery hint if available, otherwise default to retry
        return errorInfo.retryable ? 'retry' : 'not_recoverable';
    }
  }
}