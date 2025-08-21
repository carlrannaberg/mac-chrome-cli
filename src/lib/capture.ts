import { execWithTimeout, createWebPPreview, expandPath, ERROR_CODES, type ErrorCode } from './util.js';
import { getChromeWindowBounds, execChromeJS } from './apple.js';
import { selectorToScreen, validateElementVisibility } from './coords.js';
import { existsSync, mkdirSync, statSync } from 'fs';
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
 * Viewport coordinates information
 */
interface ViewportInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  windowTitle?: string;
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
    const titleBarHeight = 24; // Standard macOS title bar
    const chromeUIHeight = 75; // Approximate height of Chrome's address bar/tabs
    
    // Try to get more accurate viewport dimensions via JavaScript
    let viewportWidth = bounds.width;
    let viewportHeight = bounds.height - titleBarHeight - chromeUIHeight;
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
    
    const viewportInfo = {
      x: bounds.x,
      y: bounds.y + titleBarHeight + chromeUIHeight,
      width: viewportWidth,
      height: viewportHeight,
      scrollX,
      scrollY,
      windowTitle
    };
    
    return viewportInfo;
    
  } catch (error) {
    return null;
  }
}

/**
 * Capture screen using macOS screencapture command with proper error handling
 * @private
 */
async function captureScreen(
  x: number,
  y: number,
  width: number,
  height: number,
  outputPath: string,
  format: string = 'png'
): Promise<ScreenshotResult> {
  return new Promise((resolve) => {
    try {
      ensureDirectoryExists(outputPath);
      
      const args = [
        '-x', // Don't play sound
        '-R', // Capture rectangle
        `${x},${y},${width},${height}`
      ];
      
      // Add format-specific arguments
      if (format === 'jpg') {
        args.push('-t', 'jpg');
      } else if (format === 'pdf') {
        args.push('-t', 'pdf');
      }
      
      args.push(outputPath);
      
      const child = spawn('screencapture', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stderr = '';
      let timedOut = false;
      
      // 15 second timeout for screenshot capture
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        resolve({
          success: false,
          action: 'viewport_screenshot',
          error: 'Screenshot capture timed out after 15 seconds',
          code: ERROR_CODES.TIMEOUT
        });
      }, 15000);
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (timedOut) return;
        
        clearTimeout(timeout);
        
        if (code !== 0) {
          // Check for permission issues
          if (stderr.includes('not authorized') || stderr.includes('permission') || 
              stderr.includes('Screen Recording') || code === 1) {
            resolve({
              success: false,
              action: 'viewport_screenshot',
              error: 'Screen recording permission denied. Please grant permission in System Preferences > Privacy & Security > Screen Recording and restart the application.',
              code: ERROR_CODES.PERMISSION_DENIED
            });
            return;
          }
          
          resolve({
            success: false,
            action: 'viewport_screenshot',
            error: stderr || `screencapture exited with code ${code}`,
            code: ERROR_CODES.UNKNOWN_ERROR
          });
          return;
        }
        
        // Verify file was created
        if (!existsSync(outputPath)) {
          resolve({
            success: false,
            action: 'viewport_screenshot',
            error: 'Screenshot file was not created',
            code: ERROR_CODES.UNKNOWN_ERROR
          });
          return;
        }
        
        resolve({
          success: true,
          action: 'viewport_screenshot',
          path: outputPath,
          code: ERROR_CODES.OK
        });
      });
      
      child.on('error', (err) => {
        if (timedOut) return;
        
        clearTimeout(timeout);
        resolve({
          success: false,
          action: 'viewport_screenshot',
          error: `Failed to execute screencapture: ${err.message}`,
          code: ERROR_CODES.UNKNOWN_ERROR
        });
      });
      
    } catch (error) {
      resolve({
        success: false,
        action: 'viewport_screenshot',
        error: `Screenshot preparation failed: ${error}`,
        code: ERROR_CODES.UNKNOWN_ERROR
      });
    }
  });
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
 * Capture viewport screenshot with enhanced coordinate calculation and error handling
 * 
 * This implementation uses proper viewport coordinate calculation, dedicated screen capture
 * with permission error handling, and metadata extraction as specified in SHOT-002.
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
    // Activate Chrome window to ensure it's in front
    await execWithTimeout('osascript', ['-e', `tell application "Google Chrome" to activate window ${windowIndex}`], 2000);
    
    // Small delay to ensure window is fully activated
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get accurate viewport information using enhanced coordinate calculation
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
    
    // Use enhanced screen capture with proper error handling
    const captureResult = await captureScreen(
      viewportInfo.x,
      viewportInfo.y,
      viewportInfo.width,
      viewportInfo.height,
      outputPath,
      format
    );
    
    if (!captureResult.success) {
      return captureResult;
    }
    
    // Extract image metadata after successful capture
    const metadata = await getImageMetadata(outputPath);
    
    const screenshotResult: ScreenshotResult = {
      success: true,
      action: 'viewport_screenshot',
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
        // Log warning but continue with successful screenshot
        console.warn('WebP preview generation failed:', previewError);
      }
    }
    
    return screenshotResult;
    
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
 * Capture full window screenshot
 */
export async function captureWindow(
  options: ScreenshotOptions = {},
  windowIndex: number = 1
): Promise<ScreenshotResult> {
  try {
    // Activate Chrome window to ensure it's in front
    await execWithTimeout('osascript', ['-e', `tell application "Google Chrome" to activate window ${windowIndex}`], 2000);
    
    // Small delay to ensure window is fully activated
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get window bounds using the service (with automatic fallback)
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