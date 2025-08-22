import { execWithTimeout, createWebPPreview, expandPath, ERROR_CODES, type ErrorCode } from './util.js';
import { getChromeWindowBounds, execChromeJS, focusChromeWindow } from './apple.js';
import { selectorToScreen, validateElementVisibility } from './coords.js';
import { existsSync, mkdirSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

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
    // Expand tilde and resolve relative paths to absolute
    return expandPath(customPath, true);
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
 * Rectangle coordinates
 */
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Viewport coordinates information
 */
interface ViewportInfo extends Rectangle {
  scrollX: number;
  scrollY: number;
  windowTitle?: string;
}

/**
 * Screenshot capture configuration
 */
interface CaptureConfig {
  rectangle: Rectangle;
  outputPath: string;
  format: string;
  timeout?: number;
}

/**
 * UI layout constants
 */
const UI_CONSTANTS = {
  TITLE_BAR_HEIGHT: 24,
  CHROME_UI_HEIGHT: 75,
  DEFAULT_TIMEOUT: 10000,
  CROP_TIMEOUT: 15000,
  MIN_FILE_SIZE: 1000
} as const;

/**
 * Screenshot capture method results for fallback handling
 */
interface CaptureMethodResult {
  success: boolean;
  method: string;
  path?: string;
  error?: string;
  shouldFallback: boolean;
}

/**
 * Image metadata information
 */
interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  format: string;
  path: string;
}

/**
 * Get viewport information including coordinates and scroll position
 * @private
 */
async function getViewportInfo(windowIndex: number = 1): Promise<ViewportInfo | null> {
  try {
    // Get Chrome window bounds using the service (with automatic fallback)
    const windowBounds = await getChromeWindowBounds(windowIndex);
    
    if (!windowBounds.success || !windowBounds.data) {
      return null;
    }
    
    const bounds = windowBounds.data.bounds;
    const windowTitle = windowBounds.data.title;
    
    // Try to get viewport dimensions from the browser
    const viewportJS = `
      (function() {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX || window.pageXOffset,
          scrollY: window.scrollY || window.pageYOffset
        };
      })();
    `;
    
    // Calculate viewport area (excluding title bar and chrome UI)
    const { TITLE_BAR_HEIGHT, CHROME_UI_HEIGHT } = UI_CONSTANTS;
    
    // Try to get more accurate viewport dimensions via JavaScript
    let viewportWidth = bounds.width;
    let viewportHeight = bounds.height - TITLE_BAR_HEIGHT - CHROME_UI_HEIGHT;
    let scrollX = 0;
    let scrollY = 0;
    
    const viewportResult = await execChromeJS(viewportJS, 1, windowIndex, 5000);
    if (viewportResult.success && viewportResult.data) {
      const jsViewport = viewportResult.data as { width: number; height: number; scrollX: number; scrollY: number };
      // Use JavaScript-reported dimensions if available (more accurate)
      viewportWidth = jsViewport.width;
      viewportHeight = jsViewport.height;
      scrollX = jsViewport.scrollX;
      scrollY = jsViewport.scrollY;
    }
    
    return {
      x: bounds.x,
      y: bounds.y + TITLE_BAR_HEIGHT + CHROME_UI_HEIGHT,
      width: viewportWidth,
      height: viewportHeight,
      scrollX,
      scrollY,
      windowTitle
    };
    
  } catch (error) {
    return null;
  }
}

/**
 * Capture window by window ID using macOS screencapture command
 * This is the most reliable method for capturing Chrome windows
 * @private
 */
async function captureWindowById(
  windowId: string,
  outputPath: string,
  format: string = 'png'
): Promise<CaptureMethodResult> {
  try {
    ensureDirectoryExists(outputPath);
    
    const args = [
      '-x', // Don't play sound
      '-l', windowId, // Capture window by ID
    ];
    
    // Add format-specific arguments
    if (format === 'jpg') {
      args.push('-t', 'jpg');
    }
    
    args.push(outputPath);
    
    const result = await execWithTimeout('screencapture', args, 10000);
    
    if (result.success && existsSync(outputPath)) {
      return {
        success: true,
        method: 'window-id',
        path: outputPath,
        shouldFallback: false
      };
    } else {
      const errorMessage = result.error || 'Window capture failed';
      return {
        success: false,
        method: 'window-id',
        error: errorMessage.includes('permissions') 
          ? 'Screen recording permission required. Grant permission in System Settings → Privacy & Security → Screen Recording'
          : `Window ID capture failed: ${errorMessage}`,
        shouldFallback: !errorMessage.includes('permissions')
      };
    }
  } catch (error) {
    return {
      success: false,
      method: 'window-id',
      error: `Window ID capture error: ${error}`,
      shouldFallback: true
    };
  }
}

/**
 * Build capture configuration from rectangle coordinates
 * @private
 */
function createCaptureConfig(
  rectangle: Rectangle,
  outputPath: string,
  format: string = 'png',
  timeout?: number
): CaptureConfig {
  return {
    rectangle,
    outputPath,
    format,
    timeout: timeout || UI_CONSTANTS.DEFAULT_TIMEOUT
  };
}

/**
 * Capture screen using rectangle coordinates
 * Tries direct rectangle capture first, then falls back to full screen + crop
 * @private
 */
async function captureScreenRect(
  config: CaptureConfig
): Promise<CaptureMethodResult> {
  const { rectangle, outputPath, format } = config;
  
  try {
    ensureDirectoryExists(outputPath);
    
    // Method 1: Direct rectangle capture (faster, but may not work with Chrome GPU acceleration)
    const rectResult = await captureRectangle(config);
    if (rectResult.success) {
      return rectResult;
    }
    
    // Method 2: Full screen + crop (slower but reliable)
    if (rectResult.shouldFallback) {
      return await captureFullScreenAndCrop(config);
    }
    
    return rectResult;
    
  } catch (error) {
    return buildCaptureError('rectangle', `Screen capture error: ${error}`);
  }
}

/**
 * Direct rectangle capture using screencapture -R
 * @private
 */
async function captureRectangle(
  config: CaptureConfig
): Promise<CaptureMethodResult> {
  const { rectangle: { x, y, width, height }, outputPath, format, timeout } = config;
  
  try {
    const args = [
      '-x', // Don't play sound
      '-R', `${x},${y},${width},${height}` // Rectangle capture
    ];
    
    if (format === 'jpg') {
      args.push('-t', 'jpg');
    }
    
    args.push(outputPath);
    
    const result = await execWithTimeout('screencapture', args, timeout || UI_CONSTANTS.DEFAULT_TIMEOUT);
    
    if (result.success && existsSync(outputPath)) {
      // Verify the captured image has reasonable content (not just desktop background)
      const stats = statSync(outputPath);
      if (stats.size < UI_CONSTANTS.MIN_FILE_SIZE) { // Very small file likely means capture failed
        return {
          success: false,
          method: 'rectangle-direct',
          error: 'Rectangle capture produced unusable result',
          shouldFallback: true
        };
      }
      
      return {
        success: true,
        method: 'rectangle-direct',
        path: outputPath,
        shouldFallback: false
      };
    } else {
      return {
        success: false,
        method: 'rectangle-direct',
        error: result.error || 'Rectangle capture failed',
        shouldFallback: true
      };
    }
  } catch (error) {
    return buildCaptureError('rectangle-direct', `Rectangle capture error: ${error}`);
  }
}

/**
 * Full screen capture followed by cropping
 * This is the most reliable method but less efficient
 * @private
 */
async function captureFullScreenAndCrop(
  config: CaptureConfig
): Promise<CaptureMethodResult> {
  const { rectangle: { x, y, width, height }, outputPath } = config;
  const tempPath = `/tmp/temp-screenshot-${Date.now()}.png`;
  
  try {
    // Step 1: Capture full screen
    const fullScreenArgs = ['-x', tempPath];
    const captureResult = await execWithTimeout('screencapture', fullScreenArgs, UI_CONSTANTS.CROP_TIMEOUT);
    
    if (!captureResult.success || !existsSync(tempPath)) {
      return {
        success: false,
        method: 'fullscreen-crop',
        error: captureResult.error || 'Full screen capture failed',
        shouldFallback: false
      };
    }
    
    // Step 2: Crop using sips
    const cropArgs = [
      '-c', `${height}`, `${width}`,
      '--cropOffset', `${x}`, `${y}`,
      tempPath,
      '--out', outputPath
    ];
    
    const cropResult = await execWithTimeout('sips', cropArgs, UI_CONSTANTS.CROP_TIMEOUT);
    
    // Clean up temp file
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (!cropResult.success || !existsSync(outputPath)) {
      return {
        success: false,
        method: 'fullscreen-crop',
        error: cropResult.error || 'Image cropping failed',
        shouldFallback: false
      };
    }
    
    return {
      success: true,
      method: 'fullscreen-crop',
      path: outputPath,
      shouldFallback: false
    };
    
  } catch (error) {
    // Clean up temp file on error
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return buildCaptureError('fullscreen-crop', `Full screen capture error: ${error}`, false);
  }
}

/**
 * Extract image metadata from captured screenshot
 * @private
 */
async function getImageMetadata(imagePath: string): Promise<ImageMetadata | null> {
  try {
    if (!existsSync(imagePath)) {
      return null;
    }
    
    const stats = statSync(imagePath);
    const format = imagePath.split('.').pop()?.toLowerCase() || 'unknown';
    
    // Try to get image dimensions using sips (System Image Processing)
    try {
      const sipsResult = await execWithTimeout('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', imagePath], 5000);
      
      if (sipsResult.success) {
        const output = sipsResult.data.stdout;
        const widthMatch = output.match(/pixelWidth: (\d+)/);
        const heightMatch = output.match(/pixelHeight: (\d+)/);
        
        if (widthMatch && heightMatch && widthMatch[1] && heightMatch[1]) {
          return {
            width: parseInt(widthMatch[1], 10),
            height: parseInt(heightMatch[1], 10),
            size: stats.size,
            format,
            path: imagePath
          };
        }
      }
    } catch (sipsError) {
      // Fall back to basic metadata if sips fails
    }
    
    // Fallback: return basic file info without dimensions
    return {
      width: 0,
      height: 0,
      size: stats.size,
      format,
      path: imagePath
    };
    
  } catch (error) {
    return null;
  }
}

/**
 * Take screenshot using macOS screencapture command (legacy function for compatibility)
 * @deprecated Use captureScreen instead for enhanced functionality
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
 * Ensure Chrome window is properly focused and brought to front.
 * This is critical for screenshot capture to work correctly on macOS.
 * 
 * @param windowIndex Chrome window index (1-based)
 * @returns Promise that resolves when window is activated
 */
async function ensureChromeWindowActivated(windowIndex: number): Promise<void> {
  // Step 1: Use System Events to bring Chrome window to current Space
  const switchToChromeSpaceScript = `
tell application "Google Chrome"
  activate
  set index of window ${windowIndex} to 1
end tell

tell application "System Events"
  tell process "Google Chrome"
    set frontmost to true
    perform action "AXRaise" of window 1
  end tell
end tell`;
  
  try {
    await execWithTimeout('osascript', ['-e', switchToChromeSpaceScript], 3000);
  } catch (e) {
    // If space switching fails, try basic focus
    const result = await focusChromeWindow(windowIndex);
    if (!result.success) {
      throw new Error(`Failed to focus Chrome window: ${result.error}`);
    }
  }
  
  // Step 2: Wait for Space switch animation to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Capture viewport screenshot using progressive fallback strategy
 * 
 * Tries multiple capture methods in order of reliability:
 * 1. Window ID capture (most reliable for Chrome)
 * 2. Rectangle capture (faster but may fail with GPU acceleration)
 * 3. Full screen + crop (slowest but most reliable)
 * 
 * @param options Screenshot options including format, quality, preview settings
 * @param windowIndex Chrome window index (1-based)
 * @returns Promise resolving to screenshot result with comprehensive error context
 */
export async function captureViewport(
  options: ScreenshotOptions = {},
  windowIndex: number = 1
): Promise<ScreenshotResult> {
  try {
    // Ensure Chrome window is properly activated for screenshot capture
    await ensureChromeWindowActivated(windowIndex);
    
    // Get accurate viewport information
    const viewportInfo = await getViewportInfo(windowIndex);
    
    if (!viewportInfo) {
      return {
        success: false,
        action: 'viewport_screenshot',
        error: 'Failed to get viewport information. Ensure Chrome is running and accessible.',
        code: ERROR_CODES.CHROME_NOT_FOUND
      };
    }
    
    // Validate viewport dimensions
    if (viewportInfo.width <= 0 || viewportInfo.height <= 0) {
      return {
        success: false,
        action: 'viewport_screenshot',
        error: `Invalid viewport dimensions: ${viewportInfo.width}x${viewportInfo.height}`,
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }
    
    const outputPath = generateScreenshotPath(options.format, options.outputPath);
    const format = options.format || 'png';
    
    // Progressive fallback strategy
    let captureResult: CaptureMethodResult;
    let finalError = 'All capture methods failed';
    
    // Method 1: Try window ID capture first (most reliable for Chrome)
    try {
      const windowIdScript = `tell application "Google Chrome" to id of window ${windowIndex}`;
      const windowIdResult = await execWithTimeout('osascript', ['-e', windowIdScript], 2000);
      
      if (windowIdResult.success && windowIdResult.data?.stdout) {
        const windowId = windowIdResult.data.stdout.trim();
        captureResult = await captureWindowById(windowId, outputPath, format);
        
        if (captureResult.success) {
          return await buildSuccessResult(
            outputPath, 
            viewportInfo, 
            options, 
            `viewport_screenshot (${captureResult.method})`
          );
        }
        
        if (!captureResult.shouldFallback) {
          return buildErrorResult(captureResult.error || finalError, captureResult.method);
        }
        
        finalError = captureResult.error || finalError;
      }
    } catch (error) {
      // Continue to next method
    }
    
    // Method 2: Try rectangle capture
    const captureConfig = createCaptureConfig(
      {
        x: viewportInfo.x,
        y: viewportInfo.y,
        width: viewportInfo.width,
        height: viewportInfo.height
      },
      outputPath,
      format
    );
    
    captureResult = await captureScreenRect(captureConfig);
    
    if (captureResult.success) {
      return await buildSuccessResult(
        outputPath, 
        viewportInfo, 
        options, 
        `viewport_screenshot (${captureResult.method})`
      );
    }
    
    // If we get here, all methods failed
    return buildErrorResult(
      captureResult.error || finalError, 
      'all-methods'
    );
    
  } catch (error) {
    return {
      success: false,
      action: 'viewport_screenshot',
      error: `Viewport screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Build a successful screenshot result with metadata and preview
 * @private
 */
async function buildSuccessResult(
  outputPath: string,
  viewportInfo: ViewportInfo,
  options: ScreenshotOptions,
  action: string
): Promise<ScreenshotResult> {
  // Extract image metadata after successful capture
  const metadata = await getImageMetadata(outputPath);
  
  const screenshotResult: ScreenshotResult = {
    success: true,
    action,
    path: outputPath,
    code: ERROR_CODES.OK,
    metadata: {
      width: metadata?.width || viewportInfo.width,
      height: metadata?.height || viewportInfo.height,
      ...(viewportInfo.windowTitle && { windowTitle: viewportInfo.windowTitle })
    }
  };
  
  // Generate WebP preview when requested
  if (options.preview !== false) {
    try {
      const maxSize = options.previewMaxSize || 1.5 * 1024 * 1024; // 1.5MB default
      const webpPreview = await createWebPPreview(outputPath, maxSize);
      
      if (webpPreview.size > 0) { // Only add preview if generation was successful
        screenshotResult.preview = {
          base64: webpPreview.base64,
          size: webpPreview.size
        };
      }
    } catch (previewError) {
      // Preview generation failure doesn't fail the screenshot
      // Continue with successful screenshot without preview
    }
  }
  
  return screenshotResult;
}

/**
 * Build capture method error result
 * @private
 */
function buildCaptureError(
  method: string,
  error: string | Error,
  shouldFallback: boolean = true
): CaptureMethodResult {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return {
    success: false,
    method,
    error: errorMessage,
    shouldFallback
  };
}

/**
 * Build an error result with context
 * @private
 */
function buildErrorResult(errorMessage: string, method: string): ScreenshotResult {
  const isPermissionError = errorMessage.includes('permission');
  
  return {
    success: false,
    action: 'viewport_screenshot',
    error: errorMessage,
    code: isPermissionError ? ERROR_CODES.PERMISSION_DENIED : ERROR_CODES.UNKNOWN_ERROR
  };
}

/**
 * Capture full window screenshot with fallback strategies
 * Tries window ID capture first, then falls back to rectangle capture
 */
export async function captureWindow(
  options: ScreenshotOptions = {},
  windowIndex: number = 1
): Promise<ScreenshotResult> {
  try {
    // Ensure Chrome window is properly activated for screenshot capture
    await ensureChromeWindowActivated(windowIndex);
    
    // Get window bounds for metadata and fallback capture
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
    const format = options.format || 'png';
    
    // Method 1: Try window ID capture first
    try {
      const windowIdScript = `tell application "Google Chrome" to id of window ${windowIndex}`;
      const windowIdResult = await execWithTimeout('osascript', ['-e', windowIdScript], 2000);
      
      if (windowIdResult.success && windowIdResult.data?.stdout) {
        const windowId = windowIdResult.data.stdout.trim();
        const captureResult = await captureWindowById(windowId, outputPath, format);
        
        if (captureResult.success) {
          return await buildSuccessResultForWindow(
            outputPath,
            bounds,
            windowBounds.data.title,
            options,
            'window_screenshot (window-id)'
          );
        }
        
        // If window ID capture failed but shouldn't fallback, return error
        if (!captureResult.shouldFallback) {
          return {
            success: false,
            action: 'window_screenshot',
            error: captureResult.error || 'Window ID capture failed',
            code: captureResult.error?.includes('permission') ? ERROR_CODES.PERMISSION_DENIED : ERROR_CODES.UNKNOWN_ERROR
          };
        }
      }
    } catch (error) {
      // Continue to fallback method
    }
    
    // Method 2: Fallback to rectangle capture of entire window
    const captureConfig = createCaptureConfig(
      {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      },
      outputPath,
      format
    );
    
    const captureResult = await captureScreenRect(captureConfig);
    
    if (!captureResult.success) {
      return {
        success: false,
        action: 'window_screenshot',
        error: captureResult.error || 'Window capture failed',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }
    
    // Build success result with metadata
    return await buildSuccessResultForWindow(
      outputPath,
      bounds,
      windowBounds.data.title,
      options,
      `window_screenshot (${captureResult.method})`
    );
    
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
 * Build a successful window screenshot result
 * @private
 */
async function buildSuccessResultForWindow(
  outputPath: string,
  bounds: { width: number; height: number },
  windowTitle: string,
  options: ScreenshotOptions,
  action: string = 'window_screenshot'
): Promise<ScreenshotResult> {
  const metadata = await getImageMetadata(outputPath);
  
  const screenshotResult: ScreenshotResult = {
    success: true,
    action,
    path: outputPath,
    code: ERROR_CODES.OK,
    metadata: {
      width: metadata?.width || bounds.width,
      height: metadata?.height || bounds.height,
      windowTitle
    }
  };
  
  // Generate WebP preview when requested
  if (options.preview !== false) {
    try {
      const maxSize = options.previewMaxSize || 1.5 * 1024 * 1024; // 1.5MB default
      const webpPreview = await createWebPPreview(outputPath, maxSize);
      
      if (webpPreview.size > 0) {
        screenshotResult.preview = {
          base64: webpPreview.base64,
          size: webpPreview.size
        };
      }
    } catch (previewError) {
      // Preview generation failure doesn't fail the screenshot
    }
  }
  
  return screenshotResult;
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