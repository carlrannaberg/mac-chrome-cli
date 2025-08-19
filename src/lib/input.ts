import { getScreenCoordinates, validateElementVisibility } from './coords.js';
import { clickAt, pasteText, clearField, typeText } from './ui.js';
import { execChromeJS } from './apple.js';
import { ERROR_CODES, validateInput, sleep, type ErrorCode } from './util.js';
import { Result, ok, error } from '../core/index.js';

// Re-export typeText for convenience
export { typeText } from './ui.js';

export interface InputOptions {
  selector: string;
  value: string;
  clear?: boolean;
  method?: 'auto' | 'paste' | 'type' | 'js';
  speed?: number;
  windowIndex?: number;
  maskSecret?: boolean;
}

/**
 * Input action data
 */
export interface InputActionData {
  action: string;
  selector: string;
  method: 'paste' | 'type' | 'js';
  value: string; // Masked if secret
  actualValue?: string; // Only included if not secret
  element?: {
    visible: boolean;
    focusable: boolean;
    type: string;
  };
}

/**
 * Input action result using unified Result<T,E> pattern
 */
export type InputResult = Result<InputActionData, string>;

/**
 * Legacy InputResult interface for backward compatibility
 * @deprecated Use InputResult (Result<InputActionData, string>) instead
 */
export interface LegacyInputResult {
  success: boolean;
  action: string;
  selector: string;
  method: 'paste' | 'type' | 'js';
  value: string; // Masked if secret
  actualValue?: string; // Only included if not secret
  element?: {
    visible: boolean;
    focusable: boolean;
    type: string;
  };
  error?: string | undefined;
  code: ErrorCode;
}

/**
 * Mask sensitive values for output
 */
function maskValue(value: string, maskSecret: boolean): string {
  if (!maskSecret || value.length <= 3) {
    return value;
  }
  
  return value.substring(0, 2) + '*'.repeat(value.length - 2);
}

/**
 * Validate input options
 */
function validateInputOptions(options: InputOptions): { valid: boolean; error?: string } {
  if (!validateInput(options.selector, 'string')) {
    return { valid: false, error: 'Invalid selector' };
  }
  
  if (!validateInput(options.value, 'string')) {
    return { valid: false, error: 'Invalid value' };
  }
  
  if (options.method && !['auto', 'paste', 'type', 'js'].includes(options.method)) {
    return { valid: false, error: 'Invalid method. Must be auto, paste, type, or js' };
  }
  
  if (options.speed !== undefined && !validateInput(options.speed, 'number')) {
    return { valid: false, error: 'Invalid speed' };
  }
  
  return { valid: true };
}

/**
 * Get input element information
 */
async function getInputElementInfo(selector: string, windowIndex: number = 1) {
  const javascript = `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) {
    return null;
  }
  
  return {
    type: element.type || element.tagName.toLowerCase(),
    tagName: element.tagName.toLowerCase(),
    disabled: element.hasAttribute('disabled'),
    readonly: element.hasAttribute('readonly'),
    contentEditable: element.contentEditable === 'true',
    value: element.value || element.textContent || element.innerText || '',
    placeholder: element.placeholder || '',
    required: element.hasAttribute('required')
  };
})();
`;

  return execChromeJS<{
    type: string;
    tagName: string;
    disabled: boolean;
    readonly: boolean;
    contentEditable: boolean;
    value: string;
    placeholder: string;
    required: boolean;
  } | null>(javascript, 1, windowIndex);
}

/**
 * Focus input element
 */
async function focusElement(selector: string, windowIndex: number = 1): Promise<boolean> {
  // Get element coordinates and click to focus
  const coordsResult = await getScreenCoordinates({ selector }, windowIndex);
  if (!coordsResult.success || !coordsResult.data?.coordinates) {
    return false;
  }
  
  // Click to focus
  const clickResult = await clickAt(coordsResult.data.coordinates.x, coordsResult.data.coordinates.y);
  return clickResult.success;
}

/**
 * Clear input field using various methods
 */
async function clearInputField(selector: string, windowIndex: number = 1): Promise<boolean> {
  try {
    // Method 1: Try JavaScript clear
    const jsResult = await execChromeJS(`
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) return false;
  
  if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } else if (element.contentEditable === 'true') {
    element.textContent = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  
  return false;
})();
`, 1, windowIndex);
    
    if (jsResult.success && jsResult.data) {
      return true;
    }
    
    // Method 2: Try UI clear (select all + delete)
    await focusElement(selector, windowIndex);
    await sleep(100);
    const clearResult = await clearField();
    return clearResult.success;
    
  } catch {
    return false;
  }
}

/**
 * Fill input using paste method
 */
async function fillByPaste(selector: string, value: string, windowIndex: number = 1): Promise<boolean> {
  try {
    // Focus element first
    const focused = await focusElement(selector, windowIndex);
    if (!focused) {
      return false;
    }
    
    await sleep(100); // Brief pause after focus
    
    // Paste the text
    const pasteResult = await pasteText(value);
    return pasteResult.success;
    
  } catch {
    return false;
  }
}

/**
 * Fill input using typing method
 */
async function fillByTyping(
  selector: string, 
  value: string, 
  speed: number = 50, 
  windowIndex: number = 1
): Promise<boolean> {
  try {
    // Focus element first
    const focused = await focusElement(selector, windowIndex);
    if (!focused) {
      return false;
    }
    
    await sleep(100); // Brief pause after focus
    
    // Type the text
    const typeResult = await typeText(value, { speed });
    return typeResult.success;
    
  } catch {
    return false;
  }
}

/**
 * Fill input using JavaScript injection
 */
async function fillByJavaScript(selector: string, value: string, windowIndex: number = 1): Promise<boolean> {
  try {
    const javascript = `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) return false;
  
  const escapedValue = '${value.replace(/'/g, "\\'")}';
  
  if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
    element.value = escapedValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } else if (element.contentEditable === 'true') {
    element.textContent = escapedValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  
  return false;
})();
`;
    
    const result = await execChromeJS<boolean>(javascript, 1, windowIndex);
    return result.success && !!result.data;
    
  } catch {
    return false;
  }
}

/**
 * Fill input field with progressive strategy fallback
 */
export async function fillInput(options: InputOptions): Promise<InputResult> {
  try {
    const validation = validateInputOptions(options);
    if (!validation.valid) {
      return error(
        validation.error || 'Validation failed',
        ERROR_CODES.INVALID_INPUT
      );
    }
    
    const windowIndex = options.windowIndex || 1;
    
    // Validate element visibility and accessibility
    const visibility = await validateElementVisibility(options.selector, windowIndex);
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
    
    // Get element information
    const elementInfo = await getInputElementInfo(options.selector, windowIndex);
    if (!elementInfo.success || !elementInfo.data) {
      return error(
        `Element "${options.selector}" not found or not accessible`,
        ERROR_CODES.TARGET_NOT_FOUND
      );
    }
    
    const element = elementInfo.data;
    
    // Check if element is interactive
    if (element.disabled || element.readonly) {
      return error(
        `Element "${options.selector}" is disabled or readonly`,
        ERROR_CODES.TARGET_NOT_FOUND
      );
    }
    
    // Clear field if requested
    if (options.clear !== false) {
      await clearInputField(options.selector, windowIndex);
    }
    
    // Progressive strategy: paste -> type -> JS
    let method: 'paste' | 'type' | 'js' = 'paste';
    let success = false;
    
    if (options.method === 'auto' || options.method === undefined) {
      // Try paste first
      success = await fillByPaste(options.selector, options.value, windowIndex);
      method = 'paste';
      
      if (!success) {
        // Fallback to typing
        success = await fillByTyping(options.selector, options.value, options.speed, windowIndex);
        method = 'type';
      }
      
      if (!success) {
        // Last resort: JavaScript injection
        success = await fillByJavaScript(options.selector, options.value, windowIndex);
        method = 'js';
      }
    } else {
      // Use specified method
      switch (options.method) {
        case 'paste':
          success = await fillByPaste(options.selector, options.value, windowIndex);
          method = 'paste';
          break;
        case 'type':
          success = await fillByTyping(options.selector, options.value, options.speed, windowIndex);
          method = 'type';
          break;
        case 'js':
          success = await fillByJavaScript(options.selector, options.value, windowIndex);
          method = 'js';
          break;
      }
    }
    
    if (success) {
      return ok({
        action: 'fill_input',
        selector: options.selector,
        method,
        value: maskValue(options.value, options.maskSecret || false),
        ...((!options.maskSecret) && { actualValue: options.value }),
        element: {
          visible: visibility.data.visible,
          focusable: !element.disabled && !element.readonly,
          type: element.type
        }
      }, ERROR_CODES.OK);
    } else {
      return error(
        `Failed to fill input using method: ${method}`,
        ERROR_CODES.UNKNOWN_ERROR
      );
    }
    
  } catch (err) {
    return error(
      `Input fill failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Get current value from input field
 */
export async function getInputValue(
  selector: string, 
  windowIndex: number = 1
): Promise<{ success: boolean; value?: string; error?: string; code: ErrorCode }> {
  try {
    const elementInfo = await getInputElementInfo(selector, windowIndex);
    if (!elementInfo.success || !elementInfo.data) {
      return {
        success: false,
        error: 'Failed to get element information',
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    return {
      success: true,
      value: elementInfo.data.value,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to get input value: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Submit form containing the input element
 */
export async function submitForm(
  selector: string, 
  windowIndex: number = 1
): Promise<{ success: boolean; error?: string; code: ErrorCode }> {
  try {
    const javascript = `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!element) return false;
  
  const form = element.closest('form');
  if (form) {
    form.submit();
    return true;
  }
  
  // Try pressing Enter if no form found
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  return true;
})();
`;
    
    const result = await execChromeJS<boolean>(javascript, 1, windowIndex);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to submit form',
        code: result.code
      };
    }
    
    if (!result.data) {
      return {
        success: false,
        error: 'Element not found or no form to submit',
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    return {
      success: true,
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Form submission failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}