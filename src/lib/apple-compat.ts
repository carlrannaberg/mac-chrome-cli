/**
 * Backward compatibility wrappers for Apple/Chrome functions
 * This file provides legacy interfaces for tests and gradual migration
 * @deprecated This is temporary compatibility layer - migrate to new Result<T,E> system
 */

import { 
  execChromeJS as execChromeJSNew,
  getChromeWindowBounds as getChromeWindowBoundsNew, 
  getActiveTab as getActiveTabNew,
  isChromeRunning as isChromeRunningNew,
  focusChromeWindow as focusChromeWindowNew,
  type ChromeWindow,
  type ChromeTab
} from './apple.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import { isOk } from '../core/Result.js';

/**
 * Legacy JavaScriptResult interface for backward compatibility
 */
interface LegacyJavaScriptResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  code: ErrorCode;
}

/**
 * Legacy execChromeJS wrapper that maintains old interface
 */
export async function execChromeJSLegacy<T = unknown>(
  javascript: string,
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<LegacyJavaScriptResult<T>> {
  const result = await execChromeJSNew<T>(javascript, tabIndex, windowIndex, timeoutMs);
  
  if (isOk(result)) {
    return {
      success: true,
      ...(result.data !== undefined && { result: result.data }),
      code: result.code
    };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Legacy getChromeWindowBounds wrapper
 */
export async function getChromeWindowBoundsLegacy(windowIndex: number = 1): Promise<LegacyJavaScriptResult<ChromeWindow>> {
  const result = await getChromeWindowBoundsNew(windowIndex);
  
  if (isOk(result)) {
    return {
      success: true,
      ...(result.data !== undefined && { result: result.data }),
      code: result.code
    };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Legacy getActiveTab wrapper
 */
export async function getActiveTabLegacy(windowIndex: number = 1): Promise<LegacyJavaScriptResult<ChromeTab>> {
  const result = await getActiveTabNew(windowIndex);
  
  if (isOk(result)) {
    return {
      success: true,
      ...(result.data !== undefined && { result: result.data }),
      code: result.code
    };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Legacy focusChromeWindow wrapper
 */
export async function focusChromeWindowLegacy(windowIndex: number = 1): Promise<LegacyJavaScriptResult<boolean>> {
  const result = await focusChromeWindowNew(windowIndex);
  
  if (isOk(result)) {
    return {
      success: true,
      ...(result.data !== undefined && { result: result.data }),
      code: result.code
    };
  } else {
    return {
      success: false,
      error: result.error,
      code: result.code
    };
  }
}

/**
 * Legacy isChromeRunning wrapper - this one returns boolean directly
 */
export async function isChromeRunningLegacy(): Promise<boolean> {
  return await isChromeRunningNew();
}