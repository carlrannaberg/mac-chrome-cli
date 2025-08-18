import { execWithTimeout, ERROR_CODES, sleep, type ErrorCode } from './util.js';
import { Result, ok, error, type ResultContext } from '../core/index.js';

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  modifiers?: string[];
}

export interface KeyboardOptions {
  speed?: number; // milliseconds between keystrokes
  modifiers?: string[];
}

/**
 * UI action data
 */
export interface UIActionData {
  action: string;
  coordinates?: { x: number; y: number };
}

/**
 * UI action result using unified Result<T,E> pattern
 */
export type UIResult = Result<UIActionData, string>;

/**
 * Legacy UIResult interface for backward compatibility
 * @deprecated Use UIResult (Result<UIActionData, string>) instead
 */
export interface LegacyUIResult {
  success: boolean;
  action: string;
  coordinates?: { x: number; y: number };
  error?: string;
  code: ErrorCode;
}

/**
 * Check if cliclick is available
 */
async function checkCliclick(): Promise<boolean> {
  try {
    const result = await execWithTimeout('which', ['cliclick'], 5000);
    return result.success && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Execute cliclick command
 */
async function execCliclick(args: string[]): Promise<UIResult> {
  try {
    const isAvailable = await checkCliclick();
    if (!isAvailable) {
      return {
        success: false,
        action: 'cliclick_check',
        error: 'cliclick is not installed. Install with: brew install cliclick',
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }

    const result = await execWithTimeout('cliclick', args, 10000);
    
    if (!result.success) {
      if (result.stderr.includes('not authorized') || result.stderr.includes('permission')) {
        return {
          success: false,
          action: 'cliclick_exec',
          error: 'Permission denied. Grant accessibility permissions to Terminal in System Preferences > Privacy & Security > Accessibility',
          code: ERROR_CODES.PERMISSION_DENIED
        };
      }
      
      return {
        success: false,
        action: 'cliclick_exec',
        error: result.stderr || 'cliclick command failed',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    return {
      success: true,
      action: 'cliclick_exec',
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'cliclick_exec',
      error: `Failed to execute cliclick: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Click at specific coordinates
 */
export async function clickAt(
  x: number, 
  y: number, 
  options: ClickOptions = {}
): Promise<UIResult> {
  const { button = 'left', clickCount = 1 } = options;
  
  let clickCommand: string;
  switch (button) {
    case 'right':
      clickCommand = 'rc';
      break;
    case 'middle':
      clickCommand = 'mc';
      break;
    default:
      clickCommand = 'c';
  }
  
  const coords = `${Math.round(x)},${Math.round(y)}`;
  const args = [clickCommand + ':' + coords];
  
  // Handle multiple clicks
  if (clickCount > 1) {
    for (let i = 1; i < clickCount; i++) {
      args.push(clickCommand + ':' + coords);
    }
  }
  
  const result = await execCliclick(args);
  
  if (result.success) {
    result.action = `${button}_click`;
    result.coordinates = { x, y };
  }
  
  return result;
}

/**
 * Double-click at specific coordinates
 */
export async function doubleClickAt(x: number, y: number): Promise<UIResult> {
  return clickAt(x, y, { clickCount: 2 });
}

/**
 * Right-click at specific coordinates
 */
export async function rightClickAt(x: number, y: number): Promise<UIResult> {
  return clickAt(x, y, { button: 'right' });
}

/**
 * Move mouse to specific coordinates
 */
export async function moveTo(x: number, y: number): Promise<UIResult> {
  const coords = `${Math.round(x)},${Math.round(y)}`;
  const result = await execCliclick(['m:' + coords]);
  
  if (result.success) {
    result.action = 'mouse_move';
    result.coordinates = { x, y };
  }
  
  return result;
}

/**
 * Drag from one point to another
 */
export async function dragFromTo(
  fromX: number, 
  fromY: number, 
  toX: number, 
  toY: number
): Promise<UIResult> {
  const fromCoords = `${Math.round(fromX)},${Math.round(fromY)}`;
  const toCoords = `${Math.round(toX)},${Math.round(toY)}`;
  
  const result = await execCliclick([
    'dd:' + fromCoords,  // Begin drag
    'dm:' + toCoords,    // Drag to
    'du:' + toCoords     // End drag
  ]);
  
  if (result.success) {
    result.action = 'drag';
    result.coordinates = { x: toX, y: toY };
  }
  
  return result;
}

/**
 * Type text with configurable speed
 */
export async function typeText(
  text: string, 
  options: KeyboardOptions = {}
): Promise<UIResult> {
  const { speed = 50 } = options;
  
  try {
    // Escape special characters for cliclick
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
    
    // Use cliclick's type command
    const result = await execCliclick(['t:' + escapedText]);
    
    if (result.success) {
      result.action = 'type_text';
      
      // Add delay if speed is specified and greater than default
      if (speed > 50) {
        await sleep(speed - 50);
      }
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'type_text',
      error: `Failed to type text: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Send key combination
 */
export async function sendKeys(keyCombo: string): Promise<UIResult> {
  try {
    // Convert key combination to cliclick format
    // Examples: cmd+shift+r -> cmd,shift,r
    const keys = keyCombo.toLowerCase()
      .replace(/\+/g, ',')
      .replace(/command/g, 'cmd')
      .replace(/option/g, 'alt')
      .replace(/control/g, 'ctrl');
    
    const result = await execCliclick(['kp:' + keys]);
    
    if (result.success) {
      result.action = 'send_keys';
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'send_keys',
      error: `Failed to send key combination: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Send individual key press
 */
export async function pressKey(key: string): Promise<UIResult> {
  try {
    const result = await execCliclick(['kp:' + key.toLowerCase()]);
    
    if (result.success) {
      result.action = 'press_key';
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'press_key',
      error: `Failed to press key: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Clear text field (select all and delete)
 */
export async function clearField(): Promise<UIResult> {
  try {
    // Send Cmd+A (select all) then Delete
    const selectResult = await sendKeys('cmd+a');
    if (!selectResult.success) {
      return selectResult;
    }
    
    await sleep(100); // Brief pause
    
    const deleteResult = await pressKey('delete');
    if (!deleteResult.success) {
      return deleteResult;
    }
    
    return {
      success: true,
      action: 'clear_field',
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'clear_field',
      error: `Failed to clear field: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Copy text to clipboard and paste
 */
export async function pasteText(text: string): Promise<UIResult> {
  try {
    // Use pbcopy to copy text to clipboard
    const copyResult = await execWithTimeout('pbcopy', [], 5000);
    if (!copyResult.success) {
      return {
        success: false,
        action: 'paste_text',
        error: 'Failed to access clipboard',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    // Write text to pbcopy stdin
    const copyProcess = await execWithTimeout('sh', ['-c', `echo '${text.replace(/'/g, "'\\''")}' | pbcopy`], 5000);
    if (!copyProcess.success) {
      return {
        success: false,
        action: 'paste_text',
        error: 'Failed to copy text to clipboard',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    // Send Cmd+V (paste)
    const pasteResult = await sendKeys('cmd+v');
    if (!pasteResult.success) {
      return pasteResult;
    }
    
    return {
      success: true,
      action: 'paste_text',
      code: ERROR_CODES.OK
    };
    
  } catch (error) {
    return {
      success: false,
      action: 'paste_text',
      error: `Failed to paste text: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Scroll with mouse wheel
 */
export async function scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 3): Promise<UIResult> {
  try {
    let scrollCommand: string;
    switch (direction) {
      case 'up':
        scrollCommand = 'wu:' + amount;
        break;
      case 'down':
        scrollCommand = 'wd:' + amount;
        break;
      case 'left':
        scrollCommand = 'wl:' + amount;
        break;
      case 'right':
        scrollCommand = 'wr:' + amount;
        break;
      default:
        return {
          success: false,
          action: 'scroll',
          error: 'Invalid scroll direction',
          code: ERROR_CODES.INVALID_INPUT
        };
    }
    
    const result = await execCliclick([scrollCommand]);
    
    if (result.success) {
      result.action = 'scroll';
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'scroll',
      error: `Failed to scroll: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}