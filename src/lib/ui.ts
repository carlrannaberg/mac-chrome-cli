import { execWithTimeout, ERROR_CODES, sleep, type ErrorCode } from './util.js';
import { Result, ok, error } from '../core/index.js';
import { focusChromeWindow } from './apple.js';

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
    return result.success && result.data!.stdout.trim().length > 0;
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
      return error(
        'cliclick is not installed. Install with: brew install cliclick',
        ERROR_CODES.TARGET_NOT_FOUND
      );
    }

    const result = await execWithTimeout('cliclick', args, 10000);
    
    if (!result.success) {
      const stderr = result.error || 'Unknown error';
      if (stderr.includes('not authorized') || stderr.includes('permission')) {
        return error(
          'Permission denied. Grant accessibility permissions to Terminal in System Preferences > Privacy & Security > Accessibility',
          ERROR_CODES.PERMISSION_DENIED
        );
      }
      
      return error(
        stderr || 'cliclick command failed',
        ERROR_CODES.UNKNOWN_ERROR
      );
    }

    return ok({ action: 'cliclick_exec' }, ERROR_CODES.OK);
    
  } catch (err) {
    return error(
      `Failed to execute cliclick: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Click at specific coordinates
 */
export async function clickAt(
  x: number, 
  y: number, 
  options: ClickOptions & { windowIndex?: number } = {}
): Promise<UIResult> {
  const { button = 'left', clickCount = 1, windowIndex = 1 } = options;
  
  // Focus Chrome window before clicking
  const focusResult = await ensureChromeWindowFocused(windowIndex);
  if (!focusResult.success) {
    return focusResult;
  }
  
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
    return ok({
      action: `${button}_click`,
      coordinates: { x, y }
    }, result.code);
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
export async function moveTo(
  x: number, 
  y: number, 
  options: { windowIndex?: number } = {}
): Promise<UIResult> {
  const { windowIndex = 1 } = options;
  
  // Focus Chrome window before mouse movement
  const focusResult = await ensureChromeWindowFocused(windowIndex);
  if (!focusResult.success) {
    return focusResult;
  }
  const coords = `${Math.round(x)},${Math.round(y)}`;
  const result = await execCliclick(['m:' + coords]);
  
  if (result.success) {
    return ok({
      action: 'mouse_move',
      coordinates: { x, y }
    }, result.code);
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
  toY: number,
  options: { windowIndex?: number } = {}
): Promise<UIResult> {
  const { windowIndex = 1 } = options;
  
  // Focus Chrome window before dragging
  const focusResult = await ensureChromeWindowFocused(windowIndex);
  if (!focusResult.success) {
    return focusResult;
  }
  const fromCoords = `${Math.round(fromX)},${Math.round(fromY)}`;
  const toCoords = `${Math.round(toX)},${Math.round(toY)}`;
  
  const result = await execCliclick([
    'dd:' + fromCoords,  // Begin drag
    'dm:' + toCoords,    // Drag to
    'du:' + toCoords     // End drag
  ]);
  
  if (result.success) {
    return ok({
      action: 'drag',
      coordinates: { x: toX, y: toY }
    }, result.code);
  }
  
  return result;
}

/**
 * Focus Chrome window before keyboard input
 */
async function ensureChromeWindowFocused(windowIndex: number = 1): Promise<UIResult> {
  try {
    const focusResult = await focusChromeWindow(windowIndex);
    if (!focusResult.success) {
      return error(
        focusResult.error || 'Failed to focus Chrome window before keyboard input',
        focusResult.code
      );
    }
    return ok({ action: 'focus_chrome' }, focusResult.code);
  } catch (err) {
    return error(
      `Failed to focus Chrome window: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Type text with configurable speed
 */
export async function typeText(
  text: string, 
  options: KeyboardOptions & { windowIndex?: number } = {}
): Promise<UIResult> {
  const { speed = 50, windowIndex = 1 } = options;
  
  try {
    // Focus Chrome window before typing
    const focusResult = await ensureChromeWindowFocused(windowIndex);
    if (!focusResult.success) {
      return focusResult;
    }
    // Escape special characters for cliclick
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
    
    // Use cliclick's type command
    const result = await execCliclick(['t:' + escapedText]);
    
    if (result.success) {
      // Add delay if speed is specified and greater than default
      if (speed > 50) {
        await sleep(speed - 50);
      }
      
      return ok({
        action: 'type_text'
      }, result.code);
    }
    
    return result;
    
  } catch (err) {
    return error(
      `Failed to type text: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Send key combination
 */
export async function sendKeys(
  keyCombo: string,
  options: { windowIndex?: number } = {}
): Promise<UIResult> {
  const { windowIndex = 1 } = options;
  
  try {
    // Focus Chrome window before sending keys
    const focusResult = await ensureChromeWindowFocused(windowIndex);
    if (!focusResult.success) {
      return focusResult;
    }
    // Convert key combination to cliclick format
    // Examples: cmd+shift+r -> cmd,shift,r
    const keys = keyCombo.toLowerCase()
      .replace(/\+/g, ',')
      .replace(/command/g, 'cmd')
      .replace(/option/g, 'alt')
      .replace(/control/g, 'ctrl');
    
    const result = await execCliclick(['kp:' + keys]);
    
    if (result.success) {
      return ok({
        action: 'send_keys'
      }, result.code);
    }
    
    return result;
    
  } catch (err) {
    return error(
      `Failed to send key combination: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Send individual key press
 */
export async function pressKey(
  key: string,
  options: { windowIndex?: number } = {}
): Promise<UIResult> {
  const { windowIndex = 1 } = options;
  
  try {
    // Focus Chrome window before key press
    const focusResult = await ensureChromeWindowFocused(windowIndex);
    if (!focusResult.success) {
      return focusResult;
    }
    const result = await execCliclick(['kp:' + key.toLowerCase()]);
    
    if (result.success) {
      return ok({
        action: 'press_key'
      }, result.code);
    }
    
    return result;
    
  } catch (err) {
    return error(
      `Failed to press key: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Clear text field (select all and delete)
 */
export async function clearField(options: { windowIndex?: number } = {}): Promise<UIResult> {
  const { windowIndex = 1 } = options;
  
  try {
    // Focus Chrome window before clearing field
    const focusResult = await ensureChromeWindowFocused(windowIndex);
    if (!focusResult.success) {
      return focusResult;
    }
    // Send Cmd+A (select all) then Delete  
    const selectResult = await sendKeys('cmd+a', { windowIndex });
    if (!selectResult.success) {
      return selectResult;
    }
    
    await sleep(100); // Brief pause
    
    const deleteResult = await pressKey('delete', { windowIndex });
    if (!deleteResult.success) {
      return deleteResult;
    }
    
    return ok({
      action: 'clear_field'
    }, ERROR_CODES.OK);
    
  } catch (err) {
    return error(
      `Failed to clear field: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Copy text to clipboard and paste
 */
export async function pasteText(
  text: string,
  options: { windowIndex?: number } = {}
): Promise<UIResult> {
  const { windowIndex = 1 } = options;
  
  try {
    // Focus Chrome window before pasting
    const focusResult = await ensureChromeWindowFocused(windowIndex);
    if (!focusResult.success) {
      return focusResult;
    }
    // Use pbcopy to copy text to clipboard
    const copyResult = await execWithTimeout('pbcopy', [], 5000);
    if (!copyResult.success) {
      return error(
        'Failed to access clipboard',
        ERROR_CODES.UNKNOWN_ERROR
      );
    }
    
    // Write text to pbcopy stdin
    const copyProcess = await execWithTimeout('sh', ['-c', `echo '${text.replace(/'/g, "'\\''")}' | pbcopy`], 5000);
    if (!copyProcess.success) {
      return error(
        'Failed to copy text to clipboard',
        ERROR_CODES.UNKNOWN_ERROR
      );
    }
    
    // Send Cmd+V (paste)
    const pasteResult = await sendKeys('cmd+v', { windowIndex });
    if (!pasteResult.success) {
      return pasteResult;
    }
    
    return ok({
      action: 'paste_text'
    }, ERROR_CODES.OK);
    
  } catch (err) {
    return error(
      `Failed to paste text: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
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
        return error(
          'Invalid scroll direction',
          ERROR_CODES.INVALID_INPUT
        );
    }
    
    const result = await execCliclick([scrollCommand]);
    
    if (result.success) {
      return ok({
        action: 'scroll'
      }, result.code);
    }
    
    return result;
    
  } catch (err) {
    return error(
      `Failed to scroll: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}