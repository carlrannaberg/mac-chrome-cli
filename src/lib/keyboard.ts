import { typeText, sendKeys, pressKey, clearField, type UIResult } from './ui.js';
import { ERROR_CODES, validateInput, sleep, type ErrorCode } from './util.js';

export interface KeyInputOptions {
  text?: string;
  combo?: string;
  key?: string;
  speed?: number;
  clear?: boolean;
  repeat?: number;
}

export interface KeyboardResult {
  success: boolean;
  action: string;
  input: string; // What was typed/pressed
  method: 'type' | 'combo' | 'key' | 'clear';
  speed?: number;
  repeat?: number;
  error?: string | undefined;
  code: ErrorCode;
}

/**
 * Validate keyboard options
 */
function validateKeyInputOptions(options: KeyInputOptions): { valid: boolean; error?: string } {
  const hasText = options.text !== undefined;
  const hasCombo = options.combo !== undefined;
  const hasKey = options.key !== undefined;
  const hasClear = options.clear === true;
  
  // Must have exactly one input method
  const inputMethods = [hasText, hasCombo, hasKey, hasClear].filter(Boolean).length;
  if (inputMethods !== 1) {
    return { valid: false, error: 'Must specify exactly one of: text, combo, key, or clear' };
  }
  
  if (hasText && !validateInput(options.text, 'string')) {
    return { valid: false, error: 'Invalid text value' };
  }
  
  if (hasCombo && !validateInput(options.combo, 'string')) {
    return { valid: false, error: 'Invalid key combination' };
  }
  
  if (hasKey && !validateInput(options.key, 'string')) {
    return { valid: false, error: 'Invalid key value' };
  }
  
  if (options.speed !== undefined && !validateInput(options.speed, 'number')) {
    return { valid: false, error: 'Invalid speed value' };
  }
  
  if (options.repeat !== undefined && (!validateInput(options.repeat, 'number') || options.repeat < 1)) {
    return { valid: false, error: 'Invalid repeat value (must be >= 1)' };
  }
  
  return { valid: true };
}

/**
 * Convert UI result to keyboard result
 */
function convertUIResult(
  uiResult: UIResult, 
  action: string, 
  input: string, 
  method: 'type' | 'combo' | 'key' | 'clear',
  options: KeyInputOptions
): KeyboardResult {
  const result: KeyboardResult = {
    success: uiResult.success,
    action,
    input,
    method,
    code: uiResult.code
  };
  
  if (options.speed !== undefined) {
    result.speed = options.speed;
  }
  
  if (options.repeat !== undefined) {
    result.repeat = options.repeat;
  }
  
  if (uiResult.error !== undefined) {
    result.error = uiResult.error;
  }
  
  return result;
}

/**
 * Normalize key combinations for different platforms
 */
function normalizeKeyCombo(combo: string): string {
  return combo
    .toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/command/g, 'cmd')
    .replace(/option/g, 'alt')
    .replace(/control/g, 'ctrl')
    .replace(/windows/g, 'cmd') // Windows key maps to cmd on macOS
    .replace(/meta/g, 'cmd');
}

/**
 * Validate key combination format
 */
function validateKeyCombo(combo: string): { valid: boolean; error?: string } {
  const normalized = normalizeKeyCombo(combo);
  const parts = normalized.split('+');
  
  if (parts.length === 0) {
    return { valid: false, error: 'Empty key combination' };
  }
  
  // Valid modifier keys
  const validModifiers = ['cmd', 'ctrl', 'alt', 'shift'];
  const validKeys = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
    'space', 'enter', 'return', 'tab', 'escape', 'esc',
    'delete', 'backspace', 'home', 'end', 'pageup', 'pagedown',
    'up', 'down', 'left', 'right',
    'minus', 'equal', 'comma', 'period', 'slash', 'semicolon',
    'quote', 'bracket', 'backslash'
  ];
  
  // Last part should be a key, others should be modifiers
  const keyPart = parts[parts.length - 1];
  const modifierParts = parts.slice(0, -1);
  
  if (!keyPart || (!validKeys.includes(keyPart) && keyPart.length !== 1)) {
    return { valid: false, error: `Invalid key: ${keyPart || 'undefined'}` };
  }
  
  for (const modifier of modifierParts) {
    if (!validModifiers.includes(modifier)) {
      return { valid: false, error: `Invalid modifier: ${modifier}` };
    }
  }
  
  return { valid: true };
}

/**
 * Type text with configurable speed
 */
export async function keyboardType(options: KeyInputOptions): Promise<KeyboardResult> {
  try {
    const validation = validateKeyInputOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'type',
        input: options.text || '',
        method: 'type',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    if (!options.text) {
      return {
        success: false,
        action: 'type',
        input: '',
        method: 'type',
        error: 'No text provided',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    const speed = options.speed || 50;
    const repeat = options.repeat || 1;
    
    let lastResult: UIResult = { success: false, action: 'type', code: ERROR_CODES.UNKNOWN_ERROR };
    
    for (let i = 0; i < repeat; i++) {
      lastResult = await typeText(options.text, { speed });
      
      if (!lastResult.success) {
        break;
      }
      
      // Add delay between repetitions
      if (i < repeat - 1) {
        await sleep(100);
      }
    }
    
    return convertUIResult(lastResult, 'type', options.text, 'type', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'type',
      input: options.text || '',
      method: 'type',
      error: `Keyboard type failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Send key combination
 */
export async function keyboardCombo(options: KeyInputOptions): Promise<KeyboardResult> {
  try {
    const validation = validateKeyInputOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'combo',
        input: options.combo || '',
        method: 'combo',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    if (!options.combo) {
      return {
        success: false,
        action: 'combo',
        input: '',
        method: 'combo',
        error: 'No key combination provided',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    const comboValidation = validateKeyCombo(options.combo);
    if (!comboValidation.valid) {
      return {
        success: false,
        action: 'combo',
        input: options.combo,
        method: 'combo',
        error: comboValidation.error || 'Invalid key combination',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    const normalizedCombo = normalizeKeyCombo(options.combo);
    const repeat = options.repeat || 1;
    
    let lastResult: UIResult = { success: false, action: 'combo', code: ERROR_CODES.UNKNOWN_ERROR };
    
    for (let i = 0; i < repeat; i++) {
      lastResult = await sendKeys(normalizedCombo);
      
      if (!lastResult.success) {
        break;
      }
      
      // Add delay between repetitions
      if (i < repeat - 1) {
        await sleep(200);
      }
    }
    
    return convertUIResult(lastResult, 'combo', options.combo, 'combo', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'combo',
      input: options.combo || '',
      method: 'combo',
      error: `Keyboard combo failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Press individual key
 */
export async function keyboardPress(options: KeyInputOptions): Promise<KeyboardResult> {
  try {
    const validation = validateKeyInputOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        action: 'press',
        input: options.key || '',
        method: 'key',
        error: validation.error || 'Validation failed',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    if (!options.key) {
      return {
        success: false,
        action: 'press',
        input: '',
        method: 'key',
        error: 'No key provided',
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    
    const repeat = options.repeat || 1;
    
    let lastResult: UIResult = { success: false, action: 'press', code: ERROR_CODES.UNKNOWN_ERROR };
    
    for (let i = 0; i < repeat; i++) {
      lastResult = await pressKey(options.key);
      
      if (!lastResult.success) {
        break;
      }
      
      // Add delay between repetitions
      if (i < repeat - 1) {
        await sleep(100);
      }
    }
    
    return convertUIResult(lastResult, 'press', options.key, 'key', options);
    
  } catch (error) {
    return {
      success: false,
      action: 'press',
      input: options.key || '',
      method: 'key',
      error: `Keyboard press failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Clear current field/selection
 */
export async function keyboardClear(): Promise<KeyboardResult> {
  try {
    const result = await clearField();
    
    return convertUIResult(result, 'clear', 'clear', 'clear', {});
    
  } catch (error) {
    return {
      success: false,
      action: 'clear',
      input: 'clear',
      method: 'clear',
      error: `Keyboard clear failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Common keyboard shortcuts
 */
export const KeyboardShortcuts = {
  // Text editing
  COPY: 'cmd+c',
  PASTE: 'cmd+v',
  CUT: 'cmd+x',
  UNDO: 'cmd+z',
  REDO: 'cmd+shift+z',
  SELECT_ALL: 'cmd+a',
  
  // Navigation
  REFRESH: 'cmd+r',
  HARD_REFRESH: 'cmd+shift+r',
  NEW_TAB: 'cmd+t',
  CLOSE_TAB: 'cmd+w',
  REOPEN_TAB: 'cmd+shift+t',
  NEXT_TAB: 'cmd+alt+right',
  PREV_TAB: 'cmd+alt+left',
  
  // Browser
  BACK: 'cmd+left',
  FORWARD: 'cmd+right',
  ADDRESS_BAR: 'cmd+l',
  FIND: 'cmd+f',
  DEVELOPER_TOOLS: 'cmd+alt+i',
  
  // System
  MINIMIZE: 'cmd+m',
  HIDE: 'cmd+h',
  QUIT: 'cmd+q',
  FORCE_QUIT: 'cmd+alt+esc'
} as const;

/**
 * Execute common keyboard shortcut
 */
export async function keyboardShortcut(
  shortcut: keyof typeof KeyboardShortcuts,
  repeat: number = 1
): Promise<KeyboardResult> {
  const combo = KeyboardShortcuts[shortcut];
  
  return keyboardCombo({
    combo,
    repeat
  });
}