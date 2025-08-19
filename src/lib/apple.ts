import { ErrorCode, type Result } from '../core/index.js';
import { appleScriptService } from '../services/AppleScriptService.js';

export interface ChromeWindow {
  id: number;
  title: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
}

export interface ChromeTab {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  windowId: number;
}

/**
 * JavaScript execution result using unified Result<T,E> pattern
 */
export type JavaScriptResult<T = unknown> = Result<T, string>;

/**
 * Legacy JavaScriptResult interface for backward compatibility
 * @deprecated Use JavaScriptResult (Result<T, string>) instead
 */
export interface LegacyJavaScriptResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  code: ErrorCode;
}

/**
 * Escape string for AppleScript - DEPRECATED: Use AppleScriptService instead
 * @deprecated Use appleScriptService.executeJavaScript() which handles escaping automatically
 */
export function escapeAppleScriptString(str: string): string {
  // Delegate to service's method for backward compatibility
  return appleScriptService.escapeAppleScriptString(str);
}

/**
 * Execute JavaScript in Chrome tab via AppleScript with performance optimizations
 */
export async function execChromeJS<T = unknown>(
  javascript: string,
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<JavaScriptResult<T>> {
  return appleScriptService.executeJavaScript<T>(javascript, {
    tabIndex,
    windowIndex,
    timeout: timeoutMs,
    useCache: true
  });
}

/**
 * Get Chrome window bounds and metadata
 */
export async function getChromeWindowBounds(windowIndex: number = 1): Promise<JavaScriptResult<ChromeWindow>> {
  return appleScriptService.getChromeWindowBounds(windowIndex);
}

/**
 * Get active Chrome tab information
 */
export async function getActiveTab(windowIndex: number = 1): Promise<JavaScriptResult<ChromeTab>> {
  return appleScriptService.getActiveTab(windowIndex);
}

/**
 * Check if Chrome is running and accessible
 */
export async function isChromeRunning(): Promise<boolean> {
  return appleScriptService.isChromeRunning();
}

/**
 * Focus Chrome window
 */
export async function focusChromeWindow(windowIndex: number = 1): Promise<JavaScriptResult<boolean>> {
  return appleScriptService.focusChromeWindow(windowIndex);
}