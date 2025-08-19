/**
 * @fileoverview Keyboard command implementation with unified Result<T,E> pattern
 * 
 * This module provides keyboard input functionality using the service-oriented
 * architecture with standardized error handling and result types. Supports typing,
 * key combinations, special keys, and keyboard shortcuts.
 * 
 * @example
 * ```typescript
 * // Type text
 * const result = await keyboardCmd.type({ 
 *   text: 'Hello, World!',
 *   speed: 50
 * });
 * 
 * // Key combination
 * const comboResult = await keyboardCmd.combo({
 *   combo: 'cmd+s'
 * });
 * 
 * // Press special key
 * const keyResult = await keyboardCmd.press({
 *   key: 'Enter',
 *   repeat: 2
 * });
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { Result, ok, error } from '../core/Result.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import { 
  keyboardType,
  keyboardCombo,
  keyboardPress,
  keyboardClear,
  keyboardShortcut,
  KeyboardShortcuts,
  type KeyInputOptions as LibKeyInputOptions,
  type KeyboardResult as LibKeyboardResult
} from '../lib/keyboard.js';

/**
 * Keyboard operation options with enhanced validation and type safety
 */
export interface KeyboardOptions {
  /** Text to type */
  text?: string;
  /** Key combination (e.g., 'cmd+s', 'ctrl+c') */
  combo?: string;
  /** Special key to press (e.g., 'Enter', 'Tab', 'Escape') */
  key?: string;
  /** Typing speed in milliseconds between keys */
  speed?: number;
  /** Whether to clear field before typing */
  clear?: boolean;
  /** Number of times to repeat the action */
  repeat?: number;
  /** Chrome window index to focus (defaults to 1) */
  windowIndex?: number;
}

/**
 * Keyboard shortcut names for common operations
 */
export type KeyboardShortcutName = keyof typeof KeyboardShortcuts;

/**
 * Keyboard operation result data with enhanced metadata
 */
export interface KeyboardCommandData {
  /** Action performed (type, combo, key, clear, shortcut) */
  action: string;
  /** Input that was processed */
  input: string;
  /** Method used for input */
  method: 'type' | 'combo' | 'key' | 'clear' | 'shortcut';
  /** Additional operation metadata */
  metadata: {
    /** Operation timestamp */
    timestamp: string;
    /** Typing speed used (if applicable) */
    speed?: number;
    /** Number of repetitions */
    repeat?: number;
    /** Whether field was cleared first */
    cleared?: boolean;
  };
}

/**
 * Keyboard command implementation with service-oriented architecture
 * 
 * Provides type-safe keyboard input methods with comprehensive error handling,
 * validation, and integration with the unified Result pattern.
 */
export class KeyboardCommand extends BrowserCommandBase {
  
  /**
   * Type text with optional speed control and field clearing
   * 
   * @param options Keyboard typing options
   * @returns Promise resolving to keyboard action data or error
   * 
   * @throws {MISSING_REQUIRED_PARAM} When text parameter is not provided
   * @throws {INVALID_INPUT} When text is not a string, speed is out of range (1-2000ms), or repeat count invalid (1-50)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {ELEMENT_NOT_INTERACTABLE} When current focused element cannot receive text input
   * @throws {PERMISSION_DENIED} When system permissions block keyboard automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {KEYBOARD_INPUT_FAILED} When keyboard input operation fails at system level
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When typing operation exceeds timeout limits
   * @throws {SYSTEM_ERROR} When system-level errors prevent keyboard operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during typing
   * 
   * @example
   * ```typescript
   * // Type text with error handling
   * try {
   *   const result = await keyboardCmd.type({
   *     text: 'Hello, World!',
   *     speed: 100,
   *     clear: true
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.MISSING_REQUIRED_PARAM:
   *         console.log('Text parameter is required for typing');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Start Chrome browser first');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('Focus on input field before typing');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions in System Preferences');
   *         break;
   *     }
   *   } else {
   *     console.log(`Typed: "${result.data.input}" using ${result.data.method}`);
   *   }
   * } catch (error) {
   *   console.error('Unexpected typing error:', error);
   * }
   * 
   * // Type with default speed
   * const fastResult = await keyboardCmd.type({
   *   text: 'Quick typing'
   * });
   * ```
   */
  async type(options: KeyboardOptions): Promise<Result<KeyboardCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options for typing
    const validationResult = this.validateTypeOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<KeyboardCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await keyboardType(this.convertToLibOptions(options));
      return this.convertLibResult(libResult, 'type', options, startTime);
    }, 'keyboard_type');
  }
  
  /**
   * Execute keyboard combination/shortcut
   * 
   * @param options Keyboard combination options
   * @returns Promise resolving to keyboard action data or error
   * 
   * @throws {MISSING_REQUIRED_PARAM} When combo parameter is not provided
   * @throws {INVALID_INPUT} When combo format is invalid, speed out of range (1-2000ms), or repeat count invalid (1-50)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {PERMISSION_DENIED} When system permissions block keyboard automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {KEYBOARD_INPUT_FAILED} When keyboard combination operation fails at system level
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When keyboard combination exceeds timeout limits
   * @throws {SYSTEM_ERROR} When system-level errors prevent keyboard operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during keyboard combination
   * 
   * @example
   * ```typescript
   * // Keyboard shortcut with error handling
   * try {
   *   const result = await keyboardCmd.combo({
   *     combo: 'cmd+s'
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.MISSING_REQUIRED_PARAM:
   *         console.log('Combo parameter is required');
   *         break;
   *       case ErrorCode.INVALID_INPUT:
   *         console.log('Invalid combo format - use format like "cmd+s"');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome browser not running');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions for keyboard shortcuts');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected combo error:', error);
   * }
   * 
   * // Copy shortcut with repeat
   * const copyResult = await keyboardCmd.combo({
   *   combo: 'cmd+c',
   *   repeat: 2
   * });
   * ```
   */
  async combo(options: KeyboardOptions): Promise<Result<KeyboardCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options for combo
    const validationResult = this.validateComboOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<KeyboardCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await keyboardCombo(this.convertToLibOptions(options));
      return this.convertLibResult(libResult, 'combo', options, startTime);
    }, 'keyboard_combo');
  }
  
  /**
   * Press a special key (Enter, Tab, Escape, etc.)
   * 
   * @param options Key press options
   * @returns Promise resolving to keyboard action data or error
   * 
   * @throws {MISSING_REQUIRED_PARAM} When key parameter is not provided
   * @throws {INVALID_INPUT} When key is not a string, speed out of range (1-2000ms), or repeat count invalid (1-50)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {PERMISSION_DENIED} When system permissions block keyboard automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {KEYBOARD_INPUT_FAILED} When key press operation fails at system level
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When key press operation exceeds timeout limits
   * @throws {SYSTEM_ERROR} When system-level errors prevent keyboard operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during key press
   * 
   * @example
   * ```typescript
   * // Press special key with error handling
   * try {
   *   const result = await keyboardCmd.press({
   *     key: 'Enter'
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.MISSING_REQUIRED_PARAM:
   *         console.log('Key parameter is required');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome browser not running');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions for key simulation');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected key press error:', error);
   * }
   * 
   * // Press Tab key multiple times
   * const tabResult = await keyboardCmd.press({
   *   key: 'Tab',
   *   repeat: 3
   * });
   * ```
   */
  async press(options: KeyboardOptions): Promise<Result<KeyboardCommandData, string>> {
    const startTime = Date.now();
    
    // Validate options for key press
    const validationResult = this.validatePressOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<KeyboardCommandData, string>;
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await keyboardPress(this.convertToLibOptions(options));
      return this.convertLibResult(libResult, 'press', options, startTime);
    }, 'keyboard_press');
  }
  
  /**
   * Clear the current input field
   * 
   * @param windowIndex Target window index (1-based, default: 1)
   * @returns Promise resolving to keyboard action data or error
   * 
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {ELEMENT_NOT_INTERACTABLE} When current focused element cannot be cleared
   * @throws {PERMISSION_DENIED} When system permissions block keyboard automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {KEYBOARD_INPUT_FAILED} When field clearing operation fails at system level
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When field clearing exceeds timeout limits
   * @throws {SYSTEM_ERROR} When system-level errors prevent keyboard operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during field clearing
   * 
   * @example
   * ```typescript
   * // Clear input field with error handling
   * try {
   *   const result = await keyboardCmd.clear();
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome browser not running');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_INTERACTABLE:
   *         console.log('No input field focused or field cannot be cleared');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions for field clearing');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected clear error:', error);
   * }
   * ```
   */
  async clear(
    windowIndex: number = 1
  ): Promise<Result<KeyboardCommandData, string>> {
    const startTime = Date.now();
    
    return this.executeBrowserCommand(async () => {
      const libResult = await keyboardClear(windowIndex);
      return this.convertLibResult(libResult, 'clear', { windowIndex }, startTime);
    }, 'keyboard_clear');
  }
  
  /**
   * Execute a predefined keyboard shortcut
   * 
   * @param shortcut Name of the shortcut to execute
   * @param repeat Number of times to repeat the shortcut
   * @returns Promise resolving to keyboard action data or error
   * 
   * @throws {INVALID_INPUT} When repeat count is out of range (1-10)
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {PERMISSION_DENIED} When system permissions block keyboard automation
   * @throws {ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
   * @throws {APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
   * @throws {KEYBOARD_INPUT_FAILED} When shortcut execution fails at system level
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {TIMEOUT} When shortcut execution exceeds timeout limits
   * @throws {SYSTEM_ERROR} When system-level errors prevent keyboard operation
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during shortcut execution
   * 
   * @example
   * ```typescript
   * // Execute predefined shortcut with error handling
   * try {
   *   const result = await keyboardCmd.shortcut('copy');
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.INVALID_INPUT:
   *         console.log('Invalid repeat count - must be 1-10');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Chrome browser not running');
   *         break;
   *       case ErrorCode.ACCESSIBILITY_DENIED:
   *         console.log('Grant accessibility permissions for shortcuts');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected shortcut error:', error);
   * }
   * 
   * // Multiple refresh
   * const refreshResult = await keyboardCmd.shortcut('refresh', 3);
   * ```
   */
  async shortcut(
    shortcut: KeyboardShortcutName,
    repeat: number = 1
  ): Promise<Result<KeyboardCommandData, string>> {
    const startTime = Date.now();
    
    // Validate shortcut name and repeat count
    if (repeat < 1 || repeat > 10) {
      return error(
        `Invalid repeat count: ${repeat}. Must be between 1 and 10`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'repeat',
            provided: repeat,
            range: '1-10'
          }
        }
      );
    }
    
    return this.executeBrowserCommand(async () => {
      const libResult = await keyboardShortcut(shortcut, repeat);
      return this.convertLibResult(
        libResult, 
        'shortcut', 
        { combo: shortcut, repeat }, 
        startTime
      );
    }, 'keyboard_shortcut');
  }
  
  /**
   * Validate typing options
   * 
   * @private
   * @param options Options to validate for typing
   * @returns Validated options or validation error
   */
  private validateTypeOptions(options: KeyboardOptions): Result<void, string> {
    if (options.text === undefined || options.text === null) {
      return error(
        'Text is required for typing operation',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'text', operation: 'type' }
        }
      );
    }
    
    if (typeof options.text !== 'string') {
      return error(
        `Invalid text type: ${typeof options.text}. Must be a string`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'text', provided: typeof options.text }
        }
      );
    }
    
    return this.validateCommonOptions(options);
  }
  
  /**
   * Validate combination options
   * 
   * @private
   * @param options Options to validate for combo
   * @returns Validated options or validation error
   */
  private validateComboOptions(options: KeyboardOptions): Result<void, string> {
    if (!options.combo) {
      return error(
        'Combo is required for combination operation',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'combo', operation: 'combo' }
        }
      );
    }
    
    if (typeof options.combo !== 'string') {
      return error(
        `Invalid combo type: ${typeof options.combo}. Must be a string`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'combo', provided: typeof options.combo }
        }
      );
    }
    
    // Basic combo format validation
    if (!options.combo.includes('+') && !this.isSingleKey(options.combo)) {
      return error(
        `Invalid combo format: ${options.combo}. Use format like 'cmd+s' or single key`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'combo',
            provided: options.combo,
            example: 'cmd+s, ctrl+c, alt+tab'
          }
        }
      );
    }
    
    return this.validateCommonOptions(options);
  }
  
  /**
   * Validate key press options
   * 
   * @private
   * @param options Options to validate for key press
   * @returns Validated options or validation error
   */
  private validatePressOptions(options: KeyboardOptions): Result<void, string> {
    if (!options.key) {
      return error(
        'Key is required for press operation',
        ErrorCode.MISSING_REQUIRED_PARAM,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'key', operation: 'press' }
        }
      );
    }
    
    if (typeof options.key !== 'string') {
      return error(
        `Invalid key type: ${typeof options.key}. Must be a string`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { parameter: 'key', provided: typeof options.key }
        }
      );
    }
    
    return this.validateCommonOptions(options);
  }
  
  /**
   * Validate common options across all keyboard operations
   * 
   * @private
   * @param options Options to validate
   * @returns Validated options or validation error
   */
  private validateCommonOptions(options: KeyboardOptions): Result<void, string> {
    // Validate speed
    if (options.speed !== undefined && (options.speed < 1 || options.speed > 2000)) {
      return error(
        `Invalid speed: ${options.speed}. Must be between 1 and 2000 milliseconds`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'speed',
            provided: options.speed,
            range: '1-2000'
          }
        }
      );
    }
    
    // Validate repeat count
    if (options.repeat !== undefined && (options.repeat < 1 || options.repeat > 50)) {
      return error(
        `Invalid repeat count: ${options.repeat}. Must be between 1 and 50`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'repeat',
            provided: options.repeat,
            range: '1-50'
          }
        }
      );
    }
    
    return ok(undefined);
  }
  
  /**
   * Check if input is a valid single key
   * 
   * @private
   * @param input Input to check
   * @returns Whether input is a single key
   */
  private isSingleKey(input: string): boolean {
    const singleKeys = [
      'Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'Delete',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Home', 'End', 'PageUp', 'PageDown',
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
    ];
    
    return singleKeys.includes(input) || input.length === 1;
  }
  
  /**
   * Convert command options to library options format
   * 
   * @private
   * @param options Command options
   * @returns Library-compatible options
   */
  private convertToLibOptions(options: KeyboardOptions): LibKeyInputOptions {
    return {
      ...(options.text && { text: options.text }),
      ...(options.combo && { combo: options.combo }),
      ...(options.key && { key: options.key }),
      ...(options.speed && { speed: options.speed }),
      ...(options.clear !== undefined && { clear: options.clear }),
      ...(options.repeat && { repeat: options.repeat }),
      windowIndex: options.windowIndex || 1
    };
  }
  
  /**
   * Convert library result to service Result pattern with enhanced metadata
   * 
   * @private
   * @param libResult Result from keyboard library
   * @param action Action performed
   * @param options Original options for metadata
   * @param startTime Operation start time for duration calculation
   * @returns Converted result with unified error handling
   */
  private convertLibResult(
    libResult: LibKeyboardResult,
    action: string,
    options: KeyboardOptions,
    startTime: number
  ): KeyboardCommandData {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      throw new Error(libResult.error || 'Keyboard operation failed');
    }
    
    // Build successful result data
    const keyboardData: KeyboardCommandData = {
      action,
      input: libResult.data.input,
      method: libResult.data.method,
      metadata: {
        timestamp: new Date().toISOString(),
        ...(libResult.data.speed && { speed: libResult.data.speed }),
        ...(libResult.data.repeat && { repeat: libResult.data.repeat }),
        ...(options.clear && { cleared: true })
      }
    };
    
    return keyboardData;
  }
  
  /**
   * Get recovery hint based on error code
   * 
   * @private
   * @param code Error code from library
   * @returns Appropriate recovery strategy
   */
  private getRecoveryHint(code: number): 'retry' | 'permission' | 'check_target' | 'not_recoverable' {
    switch (code) {
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