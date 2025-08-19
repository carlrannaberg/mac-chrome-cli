import { execWithTimeout, createWebPPreview, expandPath, ERROR_CODES, type ErrorCode } from './util.js';
import { getChromeWindowBounds } from './apple.js';
import { selectorToScreen, validateElementVisibility } from './coords.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

export interface ScreenshotOptions {
  outputPath?: string;
  format?: 'png' | 'jpg' | 'pdf';
  quality?: number;
  preview?: boolean;
  previewMaxSize?: number;
}

export interface ScreenshotResult {
  success: boolean;
  action: string;
  path?: string;
  preview?: {
    base64: string;
    size: number;
  };
  metadata?: {
    width?: number;
    height?: number;
    windowTitle?: string;
    url?: string;
  };
  error?: string;
  code: ErrorCode;
}

/**
 * Generate unique filename for screenshots
 */
function generateScreenshotPath(format: string = 'png', customPath?: string): string {
  if (customPath) {
    return expandPath(customPath);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.${format}`;
  return join(tmpdir(), 'mac-chrome-cli', filename);
}

/**
 * Ensure directory exists for file path
 */
function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Take screenshot using macOS screencapture command
 */
async function takeScreenshot(
  args: string[], 
  outputPath: string,
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  try {
    ensureDirectoryExists(outputPath);
    
    const result = await execWithTimeout('screencapture', [...args, outputPath], 15000);
    
    if (!result.success) {
      if (result.error.includes('not authorized') || result.error.includes('permission')) {
        return {
          success: false,
          action: 'screenshot',
          error: 'Screen recording permission denied. Grant permission in System Preferences > Privacy & Security > Screen Recording',
          code: ERROR_CODES.PERMISSION_DENIED
        };
      }
      
      return {
        success: false,
        action: 'screenshot',
        error: result.error || 'Screenshot capture failed',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    if (!existsSync(outputPath)) {
      return {
        success: false,
        action: 'screenshot',
        error: 'Screenshot file was not created',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    const screenshotResult: ScreenshotResult = {
      success: true,
      action: 'screenshot',
      path: outputPath,
      code: ERROR_CODES.OK
    };
    
    // Generate WebP preview if requested
    if (options.preview !== false) {
      try {
        const maxSize = options.previewMaxSize || 1.5 * 1024 * 1024; // 1.5MB
        const webpPreview = await createWebPPreview(outputPath, maxSize);
        screenshotResult.preview = {
          base64: webpPreview.base64,
          size: webpPreview.size
        };
      } catch (error) {
        // Preview generation failure doesn't fail the screenshot
        console.warn('Failed to generate preview:', error);
      }
    }
    
    return screenshotResult;
    
  } catch (error) {
    return {
      success: false,
      action: 'screenshot',
      error: `Screenshot failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Capture viewport screenshot
 */
export async function captureViewport(
  options: ScreenshotOptions = {},
  windowIndex: number = 1
): Promise<ScreenshotResult> {
  try {
    const windowBounds = await getChromeWindowBounds(windowIndex);
    
    if (!windowBounds.success || !windowBounds.data) {
      return {
        success: false,
        action: 'viewport_screenshot',
        error: 'Failed to get Chrome window bounds',
        code: ERROR_CODES.CHROME_NOT_FOUND
      };
    }
    
    const bounds = windowBounds.data.bounds;
    const outputPath = generateScreenshotPath(options.format, options.outputPath);
    
    // Calculate viewport area (excluding title bar and chrome)
    const titleBarHeight = 24; // Standard macOS title bar
    const chromeHeight = 75; // Approximate height of Chrome's address bar/tabs
    
    const viewportX = bounds.x;
    const viewportY = bounds.y + titleBarHeight + chromeHeight;
    const viewportWidth = bounds.width;
    const viewportHeight = bounds.height - titleBarHeight - chromeHeight;
    
    const args = [
      '-x', // Don't play sound
      '-R', // Capture rectangle
      `${viewportX},${viewportY},${viewportWidth},${viewportHeight}`
    ];
    
    if (options.format === 'jpg') {
      args.push('-t', 'jpg');
    } else if (options.format === 'pdf') {
      args.push('-t', 'pdf');
    }
    
    const result = await takeScreenshot(args, outputPath, options);
    
    if (result.success) {
      result.action = 'viewport_screenshot';
      result.metadata = {
        width: viewportWidth,
        height: viewportHeight,
        windowTitle: windowBounds.data.title
      };
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'viewport_screenshot',
      error: `Viewport screenshot failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Capture full window screenshot
 */
export async function captureWindow(
  options: ScreenshotOptions = {},
  windowIndex: number = 1
): Promise<ScreenshotResult> {
  try {
    const windowBounds = await getChromeWindowBounds(windowIndex);
    
    if (!windowBounds.success || !windowBounds.data) {
      return {
        success: false,
        action: 'window_screenshot',
        error: 'Failed to get Chrome window bounds',
        code: ERROR_CODES.CHROME_NOT_FOUND
      };
    }
    
    const bounds = windowBounds.data.bounds;
    const outputPath = generateScreenshotPath(options.format, options.outputPath);
    
    const args = [
      '-x', // Don't play sound
      '-R', // Capture rectangle
      `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`
    ];
    
    if (options.format === 'jpg') {
      args.push('-t', 'jpg');
    } else if (options.format === 'pdf') {
      args.push('-t', 'pdf');
    }
    
    const result = await takeScreenshot(args, outputPath, options);
    
    if (result.success) {
      result.action = 'window_screenshot';
      result.metadata = {
        width: bounds.width,
        height: bounds.height,
        windowTitle: windowBounds.data.title
      };
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'window_screenshot',
      error: `Window screenshot failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Capture element screenshot
 */
export async function captureElement(
  selector: string,
  options: ScreenshotOptions = {},
  windowIndex: number = 1
): Promise<ScreenshotResult> {
  try {
    // Validate element exists and is visible
    const visibility = await validateElementVisibility(selector, windowIndex);
    if (!visibility.success || !visibility.data) {
      return {
        success: false,
        action: 'element_screenshot',
        error: 'Failed to check element visibility',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    if (!visibility.data.visible) {
      return {
        success: false,
        action: 'element_screenshot',
        error: `Element "${selector}" is not visible`,
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    // Get element screen coordinates
    const coordsResult = await selectorToScreen(selector, windowIndex);
    if (!coordsResult.success || !coordsResult.data?.element) {
      return {
        success: false,
        action: 'element_screenshot',
        error: coordsResult.error || 'Failed to get element coordinates',
        code: coordsResult.code
      };
    }
    
    const element = coordsResult.data.element;
    const windowBounds = coordsResult.data.window!;
    
    // Calculate element screen position
    const elementX = windowBounds.contentAreaX + element.x;
    const elementY = windowBounds.contentAreaY + element.y;
    const elementWidth = Math.max(1, element.width);
    const elementHeight = Math.max(1, element.height);
    
    const outputPath = generateScreenshotPath(options.format, options.outputPath);
    
    const args = [
      '-x', // Don't play sound
      '-R', // Capture rectangle
      `${elementX},${elementY},${elementWidth},${elementHeight}`
    ];
    
    if (options.format === 'jpg') {
      args.push('-t', 'jpg');
    } else if (options.format === 'pdf') {
      args.push('-t', 'pdf');
    }
    
    const result = await takeScreenshot(args, outputPath, options);
    
    if (result.success) {
      result.action = 'element_screenshot';
      result.metadata = {
        width: elementWidth,
        height: elementHeight
      };
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'element_screenshot',
      error: `Element screenshot failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Capture full screen screenshot
 */
export async function captureFullScreen(
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  try {
    const outputPath = generateScreenshotPath(options.format, options.outputPath);
    
    const args = [
      '-x' // Don't play sound
    ];
    
    if (options.format === 'jpg') {
      args.push('-t', 'jpg');
    } else if (options.format === 'pdf') {
      args.push('-t', 'pdf');
    }
    
    const result = await takeScreenshot(args, outputPath, options);
    
    if (result.success) {
      result.action = 'fullscreen_screenshot';
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      action: 'fullscreen_screenshot',
      error: `Full screen screenshot failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}