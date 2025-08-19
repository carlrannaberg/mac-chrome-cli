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
   */
  async click(options: MouseClickOptions): Promise<Result<MouseActionData, string>> {
    const validationResult = this.validateMouseOptions(options);
    if (!validationResult.success) {
      return error(validationResult.error, ErrorCode.INVALID_INPUT);
    }
    
    // If selector provided, scroll element into view and validate visibility
    if (options.selector) {
      // Automatically scroll element into view before clicking
      const scrollResult = await this.scrollElementIntoView(
        options.selector,
        options.windowIndex || 1
      );
      
      
      const visibilityResult = await validateElementVisibility(
        options.selector, 
        options.windowIndex || 1
      );
      
      if (!visibilityResult.success) {
        return error(`Element validation failed: ${visibilityResult.error}`, ErrorCode.JAVASCRIPT_ERROR, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.JAVASCRIPT_ERROR),
          metadata: { selector: options.selector, operation: 'click' }
        });
      }
      
      if (!visibilityResult.data?.visible) {
        return error(`Element "${options.selector}" is not visible`, ErrorCode.ELEMENT_NOT_VISIBLE, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_VISIBLE),
          metadata: { selector: options.selector, operation: 'click' }
        });
      }
      
      if (!visibilityResult.data?.clickable) {
        return error(`Element "${options.selector}" is not clickable`, ErrorCode.ELEMENT_NOT_INTERACTABLE, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_INTERACTABLE),
          metadata: { selector: options.selector, operation: 'click' }
        });
      }
    }
    
    // Convert to MouseOptions format for the existing mouse library
    const mouseOptions: LibMouseOptions = {
      ...(options.selector && { selector: options.selector }),
      ...(options.x !== undefined && { x: options.x }),
      ...(options.y !== undefined && { y: options.y }),
      ...(options.button && { button: options.button }),
      ...(options.offsetX !== undefined && { offsetX: options.offsetX }),
      ...(options.offsetY !== undefined && { offsetY: options.offsetY }),
      ...(options.windowIndex && { windowIndex: options.windowIndex })
    };
    
    return this.executeBrowserCommand(
      async () => {
        const result = await mouseClick(mouseOptions);
        if (result.success && result.data) {
          return result.data;
        }
        // Determine appropriate error code and recovery strategy
        const errorCode = result.code || ErrorCode.UNKNOWN_ERROR;
        const errorWithRecovery = error(
          result.error || 'Mouse click failed',
          errorCode,
          {
            recoveryHint: this.determineMouseRecoveryStrategy(errorCode),
            metadata: { 
              selector: options.selector, 
              coordinates: options.x !== undefined && options.y !== undefined ? { x: options.x, y: options.y } : undefined,
              operation: 'click' 
            }
          }
        );
        throw new Error(errorWithRecovery.error);
      },
      'mouse-click'
    );
  }
  
  /**
   * Perform a mouse move action with automatic element scrolling
   */
  async move(options: MouseMoveOptions): Promise<Result<MouseActionData, string>> {
    const validationResult = this.validateMouseOptions(options);
    if (!validationResult.success) {
      return error(validationResult.error, ErrorCode.INVALID_INPUT);
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
   */
  async drag(fromOptions: MouseMoveOptions, toOptions: MouseMoveOptions): Promise<Result<MouseActionData, string>> {
    const fromValidation = this.validateMouseOptions(fromOptions);
    if (!fromValidation.success) {
      return error(fromValidation.error, ErrorCode.INVALID_INPUT);
    }
    
    const toValidation = this.validateMouseOptions(toOptions);
    if (!toValidation.success) {
      return error(toValidation.error, ErrorCode.INVALID_INPUT);
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
   */
  async doubleClick(options: MouseClickOptions): Promise<Result<MouseActionData, string>> {
    const validationResult = this.validateMouseOptions(options);
    if (!validationResult.success) {
      return error(validationResult.error, ErrorCode.INVALID_INPUT);
    }
    
    // If selector provided, scroll element into view and validate visibility
    if (options.selector) {
      // Automatically scroll element into view before double-clicking
      const scrollResult = await this.scrollElementIntoView(
        options.selector,
        options.windowIndex || 1
      );
      
      
      const visibilityResult = await validateElementVisibility(
        options.selector, 
        options.windowIndex || 1
      );
      
      if (!visibilityResult.success) {
        return error(`Element validation failed: ${visibilityResult.error}`, ErrorCode.JAVASCRIPT_ERROR, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.JAVASCRIPT_ERROR),
          metadata: { selector: options.selector, operation: 'double-click' }
        });
      }
      
      if (!visibilityResult.data?.visible) {
        return error(`Element "${options.selector}" is not visible`, ErrorCode.ELEMENT_NOT_VISIBLE, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_VISIBLE),
          metadata: { selector: options.selector, operation: 'double-click' }
        });
      }
      
      if (!visibilityResult.data?.clickable) {
        return error(`Element "${options.selector}" is not clickable`, ErrorCode.ELEMENT_NOT_INTERACTABLE, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_INTERACTABLE),
          metadata: { selector: options.selector, operation: 'double-click' }
        });
      }
    }
    
    // Convert to MouseOptions format for the existing mouse library
    const mouseOptions: LibMouseOptions = {
      ...(options.selector && { selector: options.selector }),
      ...(options.x !== undefined && { x: options.x }),
      ...(options.y !== undefined && { y: options.y }),
      ...(options.button && { button: options.button }),
      ...(options.offsetX !== undefined && { offsetX: options.offsetX }),
      ...(options.offsetY !== undefined && { offsetY: options.offsetY }),
      ...(options.windowIndex && { windowIndex: options.windowIndex })
    };
    
    return this.executeBrowserCommand(
      async () => {
        const result = await mouseDoubleClick(mouseOptions);
        if (result.success && result.data) {
          return result.data;
        }
        // Determine appropriate error code and recovery strategy
        const errorCode = result.code || ErrorCode.UNKNOWN_ERROR;
        const errorWithRecovery = error(
          result.error || 'Mouse double-click failed',
          errorCode,
          {
            recoveryHint: this.determineMouseRecoveryStrategy(errorCode),
            metadata: { 
              selector: options.selector, 
              coordinates: options.x !== undefined && options.y !== undefined ? { x: options.x, y: options.y } : undefined,
              operation: 'double-click' 
            }
          }
        );
        throw new Error(errorWithRecovery.error);
      },
      'mouse-double-click'
    );
  }
  
  /**
   * Perform a right-click (context menu) action with automatic element scrolling
   */
  async rightClick(options: MouseClickOptions): Promise<Result<MouseActionData, string>> {
    const validationResult = this.validateMouseOptions(options);
    if (!validationResult.success) {
      return error(validationResult.error, ErrorCode.INVALID_INPUT);
    }
    
    // If selector provided, scroll element into view and validate visibility
    if (options.selector) {
      // Automatically scroll element into view before right-clicking
      const scrollResult = await this.scrollElementIntoView(
        options.selector,
        options.windowIndex || 1
      );
      
      
      const visibilityResult = await validateElementVisibility(
        options.selector, 
        options.windowIndex || 1
      );
      
      if (!visibilityResult.success) {
        return error(`Element validation failed: ${visibilityResult.error}`, ErrorCode.JAVASCRIPT_ERROR, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.JAVASCRIPT_ERROR),
          metadata: { selector: options.selector, operation: 'right-click' }
        });
      }
      
      if (!visibilityResult.data?.visible) {
        return error(`Element "${options.selector}" is not visible`, ErrorCode.ELEMENT_NOT_VISIBLE, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_VISIBLE),
          metadata: { selector: options.selector, operation: 'right-click' }
        });
      }
      
      if (!visibilityResult.data?.clickable) {
        return error(`Element "${options.selector}" is not clickable`, ErrorCode.ELEMENT_NOT_INTERACTABLE, {
          recoveryHint: this.determineMouseRecoveryStrategy(ErrorCode.ELEMENT_NOT_INTERACTABLE),
          metadata: { selector: options.selector, operation: 'right-click' }
        });
      }
    }
    
    // Convert to MouseOptions format for the existing mouse library
    const mouseOptions: LibMouseOptions = {
      ...(options.selector && { selector: options.selector }),
      ...(options.x !== undefined && { x: options.x }),
      ...(options.y !== undefined && { y: options.y }),
      ...(options.button && { button: options.button }),
      ...(options.offsetX !== undefined && { offsetX: options.offsetX }),
      ...(options.offsetY !== undefined && { offsetY: options.offsetY }),
      ...(options.windowIndex && { windowIndex: options.windowIndex })
    };
    
    return this.executeBrowserCommand(
      async () => {
        const result = await mouseRightClick(mouseOptions);
        if (result.success && result.data) {
          return result.data;
        }
        // Determine appropriate error code and recovery strategy
        const errorCode = result.code || ErrorCode.UNKNOWN_ERROR;
        const errorWithRecovery = error(
          result.error || 'Mouse right-click failed',
          errorCode,
          {
            recoveryHint: this.determineMouseRecoveryStrategy(errorCode),
            metadata: { 
              selector: options.selector, 
              coordinates: options.x !== undefined && options.y !== undefined ? { x: options.x, y: options.y } : undefined,
              operation: 'right-click' 
            }
          }
        );
        throw new Error(errorWithRecovery.error);
      },
      'mouse-right-click'
    );
  }
  
  /**
   * Validate mouse operation options
   */
  private validateMouseOptions(options: MouseClickOptions | MouseMoveOptions): Result<void, string> {
    // Must have either selector or coordinates
    if (!options.selector && (options.x === undefined || options.y === undefined)) {
      return error('Must provide either selector or x,y coordinates', ErrorCode.INVALID_INPUT);
    }
    
    // Cannot have both selector and coordinates
    if (options.selector && (options.x !== undefined || options.y !== undefined)) {
      return error('Cannot specify both selector and coordinates', ErrorCode.INVALID_INPUT);
    }
    
    // Validate selector if provided
    if (options.selector) {
      const selectorValidation = this.validateSelector(options.selector);
      if (!selectorValidation.success) {
        return selectorValidation;
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