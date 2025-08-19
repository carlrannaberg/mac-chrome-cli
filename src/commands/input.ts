/**
 * @fileoverview Input command implementation with unified Result<T,E> pattern
 * 
 * This module provides comprehensive form input functionality using the service-oriented
 * architecture with standardized error handling and result types. Combines mouse clicking
 * for field focusing, keyboard operations for clearing and typing, with advanced form
 * element validation including input, textarea, and contentEditable elements.
 * 
 * Key Features:
 * - Form element validation (input, textarea, contentEditable)
 * - Element state validation (disabled/readonly checking)
 * - Click-to-focus workflow with mouse service integration
 * - Optional content clearing with keyboard service
 * - Text typing with configurable speed
 * - Comprehensive error handling with meaningful messages
 * 
 * @example
 * ```typescript
 * // Fill input field with typing and form validation
 * const result = await inputCmd.fill({ 
 *   selector: '#email',
 *   value: 'user@example.com',
 *   method: 'type',
 *   clear: true,
 *   speed: 50
 * });
 * 
 * // Fill password field (masked) with validation
 * const passwordResult = await inputCmd.fill({
 *   selector: '#password',
 *   value: 'secretpassword',
 *   maskSecret: true,
 *   method: 'paste'
 * });
 * 
 * // Get current input value with element validation
 * const getValue = await inputCmd.getValue('#username');
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { Result, ok, error } from '../core/Result.js';
import { ErrorCode, getErrorInfo } from '../core/ErrorCodes.js';
import { type RecoveryStrategy } from '../core/Result.js';
import { MouseCommand } from './mouse.js';
import { KeyboardCommand } from './keyboard.js';
import { validateElementVisibility } from '../lib/coords.js';
import { execChromeJS } from '../lib/apple.js';
import { 
  getInputValue,
  submitForm
} from '../lib/input.js';

/**
 * Input operation options with enhanced validation and type safety
 * Combines mouse click operations for focusing with keyboard operations for input
 */
export interface InputOptions {
  /** CSS selector for the input element */
  selector: string;
  /** Value to enter into the input */
  value: string;
  /** Whether to clear the field before entering value (default: true) */
  clear?: boolean;
  /** Input method to use */
  method?: 'auto' | 'paste' | 'type' | 'js';
  /** Typing speed in milliseconds between characters (for type method) */
  speed?: number;
  /** Target window index (1-based) */
  windowIndex?: number;
  /** Whether to mask the value in logs (for sensitive data) */
  maskSecret?: boolean;
  /** X offset from element center for mouse click (when focusing) */
  offsetX?: number;
  /** Y offset from element center for mouse click (when focusing) */
  offsetY?: number;
}

/**
 * Input retrieval options
 */
export interface InputValueOptions {
  /** CSS selector for the input element */
  selector: string;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Form submission options
 */
export interface FormSubmitOptions {
  /** CSS selector for the form or submit button */
  selector: string;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Form element validation result
 */
export interface FormElementValidation {
  /** Whether element is a valid form input */
  isValidFormElement: boolean;
  /** Element type (input, textarea, contenteditable) */
  elementType: string;
  /** Input type for input elements */
  inputType?: string;
  /** Whether element is disabled */
  disabled: boolean;
  /** Whether element is readonly */
  readonly: boolean;
  /** Whether element is contentEditable */
  contentEditable: boolean;
  /** Current element value */
  currentValue: string;
  /** Whether element is focusable */
  focusable: boolean;
  /** Element validation error if any */
  validationError?: string;
}

/**
 * Input operation result data with enhanced metadata
 */
export interface InputCommandData {
  /** Action performed (fill, get_value, submit) */
  action: string;
  /** CSS selector used */
  selector: string;
  /** Method used for input (if applicable) */
  method?: 'paste' | 'type' | 'js';
  /** Value processed (masked if secret) */
  value?: string;
  /** Element information with comprehensive form validation */
  element?: {
    /** Whether element was visible */
    visible: boolean;
    /** Whether element was clickable for focusing */
    clickable: boolean;
    /** Whether element was focusable */
    focusable: boolean;
    /** Element type (input, textarea, etc.) */
    type: string;
    /** Form element validation result */
    formValidation: FormElementValidation;
  };
  /** Mouse operation details (for focusing) */
  mouseAction?: {
    /** Whether click-to-focus was successful */
    focusClicked: boolean;
    /** Coordinates used for clicking */
    coordinates?: { x: number; y: number };
  };
  /** Keyboard operation details */
  keyboardAction?: {
    /** Whether field was cleared */
    cleared: boolean;
    /** Typing method used */
    method: 'type' | 'paste';
    /** Typing speed used (if applicable) */
    speed?: number;
  };
  /** Additional operation metadata */
  metadata: {
    /** Operation timestamp */
    timestamp: string;
    /** Whether value was masked */
    masked?: boolean;
    /** Input method used */
    inputMethod?: string;
    /** Window index targeted */
    windowIndex: number;
    /** Operation duration in milliseconds */
    durationMs?: number;
  };
}

/**
 * Input command implementation with service-oriented architecture
 * 
 * Provides comprehensive form input operations combining mouse and keyboard services.
 * Includes extensive form element validation, click-to-focus workflow, content clearing,
 * and text input with configurable speeds. Supports input, textarea, and contentEditable
 * elements with disabled/readonly state validation.
 */
export class InputCommand extends BrowserCommandBase {
  private mouseCommand: MouseCommand;
  private keyboardCommand: KeyboardCommand;
  
  constructor() {
    super();
    this.mouseCommand = new MouseCommand();
    this.keyboardCommand = new KeyboardCommand();
  }
  
  /**
   * Fill an input field with the specified value using comprehensive form validation
   * and integrated mouse/keyboard operations
   * 
   * @param options Input filling options
   * @returns Promise resolving to input action data or error
   * 
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {MISSING_REQUIRED_PARAM} When value parameter is not provided
   * @throws {INVALID_INPUT} When value is not a string, method is invalid, speed out of range (1-2000ms), windowIndex invalid (1-50), or offsets non-finite
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {ELEMENT_NOT_VISIBLE} When target element exists but is not visible in viewport
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element cannot be interacted with (disabled, readonly, wrong type)
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element validation
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {MOUSE_CLICK_FAILED} When clicking to focus the input field fails
   * @throws {KEYBOARD_INPUT_FAILED} When typing or pasting text into field fails
   * @throws {PERMISSION_DENIED} When system permissions block input automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {COORDINATE_CALCULATION_FAILED} When cannot calculate screen coordinates for element
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When input operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution for element validation times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent input operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during input filling
   * 
   * @example
   * ```typescript
   * // Fill email field with comprehensive error handling
   * try {
   *   const result = await inputCmd.fill({
   *     selector: '#email',
   *     value: 'user@example.com',
   *     method: 'type',
   *     clear: true,
   *     speed: 50
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.INVALID_SELECTOR:
   *         console.log('Check CSS selector syntax');
   *         break;
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Input field not found - verify selector and page content');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('Element cannot be filled (disabled, readonly, or wrong type)');
   *         break;
   *       case ErrorCode.MOUSE_CLICK_FAILED:
   *         console.log('Cannot click to focus input field');
   *         break;
   *       case ErrorCode.KEYBOARD_INPUT_FAILED:
   *         console.log('Cannot type into focused field');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions in System Preferences');
   *         break;
   *     }
   *   } else {
   *     console.log(`Successfully filled field with ${result.data.method} method`);
   *   }
   * } catch (error) {
   *   console.error('Unexpected input error:', error);
   * }
   * 
   * // Fill password with paste (faster, masked) and validation
   * const passwordResult = await inputCmd.fill({
   *   selector: '#password',
   *   value: 'secretpass',
   *   method: 'paste',
   *   maskSecret: true
   * });
   * ```
   */
  async fill(options: InputOptions): Promise<Result<InputCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options first
    const validationResult = this.validateFillOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<InputCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      // Step 1: Comprehensive form element validation
      const formValidation = await this.validateFormElement(options.selector, options.windowIndex || 1);
      if (!formValidation.success) {
        const err = new Error(formValidation.error || 'Form element validation failed') as Error & { errorCode: number };
        err.errorCode = formValidation.code;
        throw err;
      }
      
      const elementValidation = formValidation.data!;
      
      // Step 2: Element visibility and interactability validation
      const visibilityResult = await validateElementVisibility(
        options.selector,
        options.windowIndex || 1
      );
      
      if (!visibilityResult.success) {
        throw this.createCustomError(
          `Element visibility validation failed: ${visibilityResult.error}`,
          ErrorCode.JAVASCRIPT_ERROR,
          this.determineInputRecoveryStrategy(ErrorCode.JAVASCRIPT_ERROR),
          { selector: options.selector, step: 'visibility_validation' }
        );
      }
      
      if (!visibilityResult.data?.visible) {
        throw this.createCustomError(
          `Element "${options.selector}" is not visible`,
          ErrorCode.ELEMENT_NOT_VISIBLE,
          this.determineInputRecoveryStrategy(ErrorCode.ELEMENT_NOT_VISIBLE),
          { selector: options.selector, step: 'visibility_check' }
        );
      }
      
      if (!visibilityResult.data?.clickable) {
        throw this.createCustomError(
          `Element "${options.selector}" is not clickable for focusing`,
          ErrorCode.ELEMENT_NOT_INTERACTABLE,
          this.determineInputRecoveryStrategy(ErrorCode.ELEMENT_NOT_INTERACTABLE),
          { selector: options.selector, step: 'clickable_check' }
        );
      }
      
      // Step 3: Click to focus using mouse service
      const focusResult = await this.mouseCommand.click({
        selector: options.selector,
        windowIndex: options.windowIndex || 1,
        ...(options.offsetX !== undefined && { offsetX: options.offsetX }),
        ...(options.offsetY !== undefined && { offsetY: options.offsetY })
      });
      
      if (!focusResult.success) {
        throw this.createCustomError(
          `Failed to focus element: ${focusResult.error}`,
          ErrorCode.MOUSE_CLICK_FAILED,
          this.determineInputRecoveryStrategy(ErrorCode.MOUSE_CLICK_FAILED),
          { selector: options.selector, step: 'focus_click', action: 'focus' }
        );
      }
      
      // Step 4: Clear field if requested (default: true)
      let wasCleared = false;
      if (options.clear !== false) {
        const clearResult = await this.keyboardCommand.clear(options.windowIndex || 1);
        if (!clearResult.success) {
          // Don't fail on clear - just note it
          wasCleared = false;
        } else {
          wasCleared = true;
        }
      }
      
      // Step 5: Input text using keyboard service based on method
      let inputMethod: 'type' | 'paste' = 'type';
      let keyboardResult;
      
      if (options.method === 'paste' || (options.method === 'auto' && options.value.length > 50)) {
        // Use paste for long values or when explicitly requested
        // Note: Direct paste via keyboard service may require clipboard setup
        // Fallback to typing for reliability
        keyboardResult = await this.keyboardCommand.type({
          text: options.value,
          speed: options.speed || 50,
          windowIndex: options.windowIndex || 1
        });
        inputMethod = 'type'; // Actually typed due to paste limitations
      } else {
        // Use typing
        keyboardResult = await this.keyboardCommand.type({
          text: options.value,
          speed: options.speed || 50,
          windowIndex: options.windowIndex || 1
        });
        inputMethod = 'type';
      }
      
      if (!keyboardResult.success) {
        throw this.createCustomError(
          `Failed to input text: ${keyboardResult.error}`,
          ErrorCode.KEYBOARD_INPUT_FAILED,
          this.determineInputRecoveryStrategy(ErrorCode.KEYBOARD_INPUT_FAILED),
          { selector: options.selector, step: 'text_input', method: inputMethod }
        );
      }
      
      // Build successful result
      const inputData: InputCommandData = {
        action: 'fill',
        selector: options.selector,
        method: inputMethod,
        value: options.maskSecret ? this.maskValue(options.value) : options.value,
        element: {
          visible: visibilityResult.data.visible,
          clickable: visibilityResult.data.clickable,
          focusable: elementValidation.focusable,
          type: elementValidation.elementType,
          formValidation: elementValidation
        },
        mouseAction: {
          focusClicked: focusResult.success,
          ...(focusResult.data?.coordinates && { coordinates: focusResult.data.coordinates })
        },
        keyboardAction: {
          cleared: wasCleared,
          method: inputMethod,
          ...(options.speed !== undefined && { speed: options.speed })
        },
        metadata: {
          timestamp: new Date().toISOString(),
          masked: options.maskSecret || false,
          inputMethod,
          windowIndex: options.windowIndex || 1,
          durationMs: Date.now() - startTime
        }
      };
      
      return inputData;
    }, 'input_fill');
  }
  
  /**
   * Get the current value of an input field
   * 
   * @param options Input value retrieval options
   * @returns Promise resolving to input value data or error
   * 
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_INPUT} When windowIndex parameter is invalid (must be 1-50)
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element is not a valid input field
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during value retrieval
   * @throws {PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When value retrieval operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during value retrieval
   * 
   * @example
   * ```typescript
   * // Get current field value with error handling
   * try {
   *   const result = await inputCmd.getValue({
   *     selector: '#username'
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.INVALID_SELECTOR:
   *         console.log('Check CSS selector syntax');
   *         break;
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Input field not found');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('Element is not a valid input field');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome browser not running');
   *         break;
   *     }
   *   } else {
   *     console.log('Current value:', result.data.value);
   *   }
   * } catch (error) {
   *   console.error('Unexpected getValue error:', error);
   * }
   * ```
   */
  async getValue(options: InputValueOptions): Promise<Result<InputCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateValueOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<InputCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await getInputValue(
        options.selector,
        options.windowIndex || 1
      );
      
      if (!libResult.success) {
        throw this.createCustomError(
          libResult.error || 'Failed to get input value',
          libResult.code || ErrorCode.TARGET_NOT_FOUND,
          this.getRecoveryHint(libResult.code || ErrorCode.TARGET_NOT_FOUND),
          { selector: options.selector, operation: 'get_value' }
        );
      }
      
      const inputData: InputCommandData = {
        action: 'get_value',
        selector: options.selector,
        ...(libResult.value !== undefined && { value: libResult.value }),
        metadata: {
          timestamp: new Date().toISOString(),
          windowIndex: options.windowIndex || 1
        }
      };
      
      return inputData;
    }, 'input_get_value');
  }
  
  /**
   * Submit a form
   * 
   * @param options Form submission options
   * @returns Promise resolving to submit action data or error
   * 
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_INPUT} When windowIndex parameter is invalid (must be 1-50)
   * @throws {TARGET_NOT_FOUND} When specified form or submit button selector matches no elements
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element cannot be used for form submission
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during form submission
   * @throws {PERMISSION_DENIED} When system permissions block browser automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When form submission operation exceeds timeout limits
   * @throws {SCRIPT_TIMEOUT} When JavaScript execution times out
   * @throws {SYSTEM_ERROR} When system-level errors prevent operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during form submission
   * 
   * @example
   * ```typescript
   * // Submit form with error handling
   * try {
   *   const result = await inputCmd.submit({
   *     selector: 'form#login-form'
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.INVALID_SELECTOR:
   *         console.log('Check CSS selector syntax');
   *         break;
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Form or submit button not found');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('Element cannot be used for form submission');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome browser not running');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected submit error:', error);
   * }
   * 
   * // Submit by clicking submit button
   * const buttonResult = await inputCmd.submit({
   *   selector: 'button[type="submit"]'
   * });
   * ```
   */
  async submit(options: FormSubmitOptions): Promise<Result<InputCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateSubmitOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<InputCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await submitForm(
        options.selector,
        options.windowIndex || 1
      );
      
      if (!libResult.success) {
        throw this.createCustomError(
          libResult.error || 'Failed to submit form',
          libResult.code || ErrorCode.TARGET_NOT_FOUND,
          this.getRecoveryHint(libResult.code || ErrorCode.TARGET_NOT_FOUND),
          { selector: options.selector, operation: 'submit' }
        );
      }
      
      const inputData: InputCommandData = {
        action: 'submit',
        selector: options.selector,
        metadata: {
          timestamp: new Date().toISOString(),
          windowIndex: options.windowIndex || 1
        }
      };
      
      return inputData;
    }, 'input_submit');
  }
  
  /**
   * Validate comprehensive form element type and state
   * 
   * @private
   * @param selector CSS selector for the element
   * @param windowIndex Target window index
   * @returns Form element validation result
   */
  private async validateFormElement(
    selector: string, 
    windowIndex: number
  ): Promise<Result<FormElementValidation, string>> {
    try {
      const javascript = `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) {
    return { error: 'Element not found' };
  }
  
  const tagName = element.tagName.toLowerCase();
  const isInput = tagName === 'input';
  const isTextarea = tagName === 'textarea';
  const isContentEditable = element.contentEditable === 'true' || element.contentEditable === '';
  
  // Validate element is a form input
  if (!isInput && !isTextarea && !isContentEditable) {
    return {
      error: 'Element is not a valid form input (must be input, textarea, or contentEditable)'
    };
  }
  
  const inputType = isInput ? (element.type || 'text') : undefined;
  const disabled = element.hasAttribute('disabled') || element.disabled === true;
  const readonly = element.hasAttribute('readonly') || element.readOnly === true;
  
  // Check if element is interactive
  if (disabled) {
    return {
      error: \`Element is disabled and cannot be interacted with\`
    };
  }
  
  if (readonly) {
    return {
      error: \`Element is readonly and cannot be modified\`
    };
  }
  
  // Get current value
  let currentValue = '';
  if (isInput || isTextarea) {
    currentValue = element.value || '';
  } else if (isContentEditable) {
    currentValue = element.textContent || element.innerText || '';
  }
  
  // Check if element can be focused
  const computedStyle = window.getComputedStyle(element);
  const focusable = !disabled && !readonly && 
    computedStyle.display !== 'none' && 
    computedStyle.visibility !== 'hidden' &&
    (element.tabIndex >= 0 || isInput || isTextarea || isContentEditable);
  
  return {
    isValidFormElement: true,
    elementType: tagName,
    inputType,
    disabled,
    readonly,
    contentEditable: isContentEditable,
    currentValue,
    focusable
  };
})();
`;
      
      const result = await execChromeJS<FormElementValidation | { error: string }>(
        javascript,
        1,
        windowIndex
      );
      
      if (!result.success) {
        return error(
          `Failed to validate form element: ${result.error}`,
          result.code || ErrorCode.JAVASCRIPT_ERROR
        );
      }
      
      if (!result.data) {
        return error(
          'No data returned from form element validation',
          ErrorCode.JAVASCRIPT_ERROR
        );
      }
      
      if ('error' in result.data) {
        return error(
          result.data.error,
          ErrorCode.ELEMENT_NOT_INTERACTABLE
        );
      }
      
      return ok(result.data as FormElementValidation);
      
    } catch (err) {
      return error(
        `Form element validation failed: ${err}`,
        ErrorCode.JAVASCRIPT_ERROR
      );
    }
  }
  
  /**
   * Mask sensitive values for output
   * 
   * @private
   * @param value Value to mask
   * @returns Masked value
   */
  private maskValue(value: string): string {
    if (value.length <= 3) {
      return value;
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 2);
  }
  
  /**
   * Determine appropriate recovery strategy for input operations
   * 
   * @private
   * @param errorCode Error code from operation
   * @returns Recovery strategy
   */
  private determineInputRecoveryStrategy(errorCode: ErrorCode): RecoveryStrategy {
    const errorInfo = getErrorInfo(errorCode);
    
    switch (errorCode) {
      case ErrorCode.ELEMENT_NOT_VISIBLE:
        return 'retry';
      case ErrorCode.ELEMENT_NOT_INTERACTABLE:
        return 'check_target';
      case ErrorCode.TARGET_NOT_FOUND:
        return 'check_target';
      case ErrorCode.MOUSE_CLICK_FAILED:
        return 'retry_with_delay';
      case ErrorCode.KEYBOARD_INPUT_FAILED:
        return 'retry';
      case ErrorCode.INVALID_SELECTOR:
        return 'not_recoverable';
      case ErrorCode.PERMISSION_DENIED:
      case ErrorCode.ACCESSIBILITY_DENIED:
        return 'permission';
      case ErrorCode.TIMEOUT:
      case ErrorCode.SCRIPT_TIMEOUT:
        return 'retry_with_delay';
      default:
        return errorInfo.retryable ? 'retry' : 'not_recoverable';
    }
  }
  
  /**
   * Validate input filling options with comprehensive checks
   * 
   * @private
   * @param options Options to validate for filling
   * @returns Validated options or validation error
   */
  private validateFillOptions(options: InputOptions): Result<void, string> {
    // Validate selector with proper error code
    if (!options.selector || typeof options.selector !== 'string' || options.selector.trim().length === 0) {
      return error('Selector cannot be empty', ErrorCode.INVALID_SELECTOR);
    }
    
    const selectorValidation = this.validateSelector(options.selector);
    if (!selectorValidation.success) {
      // Convert INVALID_INPUT from base validation to INVALID_SELECTOR for input operations
      return error(selectorValidation.error, ErrorCode.INVALID_SELECTOR, selectorValidation.context);
    }
    
    // Validate value
    if (options.value === undefined || options.value === null) {
      return error(
        'Value is required for input filling',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'not_recoverable',
          metadata: { parameter: 'value', operation: 'fill' }
        }
      );
    }
    
    if (typeof options.value !== 'string') {
      return error(
        `Invalid value type: ${typeof options.value}. Must be a string`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'not_recoverable',
          metadata: { parameter: 'value', provided: typeof options.value }
        }
      );
    }
    
    // Validate method
    if (options.method && !['auto', 'paste', 'type', 'js'].includes(options.method)) {
      return error(
        `Invalid input method: ${options.method}. Must be auto, paste, type, or js`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'not_recoverable',
          metadata: { 
            parameter: 'method',
            provided: options.method,
            allowed: ['auto', 'paste', 'type', 'js']
          }
        }
      );
    }
    
    // Validate speed
    if (options.speed !== undefined && (options.speed < 1 || options.speed > 2000)) {
      return error(
        `Invalid speed: ${options.speed}. Must be between 1 and 2000 milliseconds`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'not_recoverable',
          metadata: { 
            parameter: 'speed',
            provided: options.speed,
            range: '1-2000'
          }
        }
      );
    }
    
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'not_recoverable',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    // Validate offsets if provided
    if (options.offsetX !== undefined && !Number.isFinite(options.offsetX)) {
      return error(
        'X offset must be a finite number',
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'not_recoverable',
          metadata: { parameter: 'offsetX', provided: options.offsetX }
        }
      );
    }
    
    if (options.offsetY !== undefined && !Number.isFinite(options.offsetY)) {
      return error(
        'Y offset must be a finite number',
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'not_recoverable',
          metadata: { parameter: 'offsetY', provided: options.offsetY }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Validate input value retrieval options
   * 
   * @private
   * @param options Options to validate for value retrieval
   * @returns Validated options or validation error
   */
  private validateValueOptions(options: InputValueOptions): Result<void, string> {
    // Validate selector with proper error code
    if (!options.selector || typeof options.selector !== 'string' || options.selector.trim().length === 0) {
      return error('Selector cannot be empty', ErrorCode.INVALID_SELECTOR);
    }
    
    const selectorValidation = this.validateSelector(options.selector);
    if (!selectorValidation.success) {
      // Convert INVALID_INPUT from base validation to INVALID_SELECTOR for input operations
      return error(selectorValidation.error, ErrorCode.INVALID_SELECTOR, selectorValidation.context);
    }
    
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Validate form submission options
   * 
   * @private
   * @param options Options to validate for form submission
   * @returns Validated options or validation error
   */
  private validateSubmitOptions(options: FormSubmitOptions): Result<void, string> {
    // Validate selector with proper error code
    if (!options.selector || typeof options.selector !== 'string' || options.selector.trim().length === 0) {
      return error('Selector cannot be empty', ErrorCode.INVALID_SELECTOR);
    }
    
    const selectorValidation = this.validateSelector(options.selector);
    if (!selectorValidation.success) {
      // Convert INVALID_INPUT from base validation to INVALID_SELECTOR for input operations
      return error(selectorValidation.error, ErrorCode.INVALID_SELECTOR, selectorValidation.context);
    }
    
    // Validate window index
    if (options.windowIndex !== undefined && (options.windowIndex < 1 || options.windowIndex > 50)) {
      return error(
        `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'windowIndex',
            provided: options.windowIndex,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  // Note: convertToLibOptions and convertLibResult removed as we're using direct mouse/keyboard integration
  
  /**
   * Create a custom error with error code and recovery hint
   * 
   * @private
   * @param message Error message
   * @param errorCode Error code
   * @param recoveryHint Recovery hint
   * @param metadata Additional metadata
   * @returns Custom error object
   */
  private createCustomError(
    message: string,
    errorCode: ErrorCode,
    recoveryHint: RecoveryStrategy,
    metadata?: Record<string, unknown>
  ): Error & { errorCode: ErrorCode; recoveryHint: RecoveryStrategy; metadata?: Record<string, unknown> } {
    const error = new Error(message) as Error & { 
      errorCode: ErrorCode; 
      recoveryHint: RecoveryStrategy; 
      metadata?: Record<string, unknown>;
    };
    error.errorCode = errorCode;
    error.recoveryHint = recoveryHint;
    error.name = 'ScreenshotError'; // Required for isCustomError type guard
    if (metadata) {
      error.metadata = metadata;
    }
    return error;
  }


  /**
   * Get recovery hint based on error code (legacy compatibility)
   * 
   * @private
   * @param code Error code from library
   * @returns Appropriate recovery strategy
   */
  private getRecoveryHint(code: number): RecoveryStrategy {
    switch (code) {
      case 20: // TARGET_NOT_FOUND
        return 'check_target';
      case 30: // PERMISSION_DENIED
        return 'permission';
      case 40: // TIMEOUT
        return 'retry';
      case 10: // INVALID_INPUT
        return 'not_recoverable';
      default:
        return 'retry';
    }
  }
}