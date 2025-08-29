/**
 * @fileoverview Screenshot command implementation with unified Result<T,E> pattern
 * 
 * This module provides screenshot capture functionality using the service-oriented
 * architecture with standardized error handling and result types. Supports viewport,
 * window, element, and fullscreen captures with format options and preview generation.
 * 
 * @example
 * ```typescript
 * // Capture viewport screenshot with preview
 * const result = await screenshotCmd.viewport({ 
 *   format: 'png', 
 *   preview: true, 
 *   outputPath: './screenshot.png' 
 * });
 * 
 * // Capture specific element
 * const elementResult = await screenshotCmd.element('#login-button', {
 *   format: 'jpg',
 *   quality: 90
 * });
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { BrowserCommandBase } from '../core/CommandBase.js';
import { RateLimitedBrowserCommandBase, RateLimitUtils, type RateLimitedCommandOptions } from '../core/RateLimitedCommandBase.js';
import { Result, ok, error } from '../core/Result.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import type { IServiceContainer } from '../di/ServiceContainer.js';
import { 
  captureViewport, 
  captureWindow, 
  captureElement, 
  captureFullScreen,
  type ScreenshotOptions as LibScreenshotOptions,
  type ScreenshotResult as LibScreenshotResult
} from '../lib/capture.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Custom error class that preserves ErrorCode information
 */
class ScreenshotError extends Error {
  public errorCode: ErrorCode;
  public recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable';
  public metadata?: Record<string, unknown>;

  constructor(
    message: string,
    errorCode: ErrorCode,
    recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' = 'retry',
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScreenshotError';
    this.errorCode = errorCode;
    this.recoveryHint = recoveryHint;
    this.metadata = metadata;
  }
}

/**
 * Screenshot capture options with enhanced validation and type safety
 */
export interface ScreenshotOptions extends RateLimitedCommandOptions {
  /** Custom output path or auto-generate with timestamp */
  outputPath?: string;
  /** Image format selection */
  format?: 'png' | 'jpg' | 'pdf';
  /** JPEG quality (1-100, only applies to jpg format) */
  quality?: number;
  /** Generate WebP preview for efficient transmission */
  preview?: boolean;
  /** Maximum preview size in bytes */
  previewMaxSize?: number;
  /** Target window index (1-based) */
  windowIndex?: number;
}

/**
 * Screenshot operation result data with metadata
 */
export interface ScreenshotData {
  /** Path to the captured screenshot file */
  path: string;
  /** Actual format used for the screenshot */
  format: string;
  /** Image and capture metadata */
  metadata: {
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
    /** Timestamp when screenshot was captured */
    timestamp: string;
    /** Window title (if applicable) */
    windowTitle?: string;
    /** Page URL (if applicable) */
    url?: string;
  };
  /** Optional WebP preview data */
  preview?: {
    /** Base64 encoded preview image */
    base64: string;
    /** Preview size in bytes */
    size: number;
  };
}

/**
 * Screenshot command implementation with service-oriented architecture and rate limiting
 * 
 * Provides type-safe screenshot capture methods with comprehensive error handling,
 * validation, rate limiting, and integration with the unified Result pattern.
 */
export class ScreenshotCommand extends RateLimitedBrowserCommandBase {
  
  constructor(container: IServiceContainer) {
    super(container);
  }
  
  /**
   * Capture screenshot of the browser viewport (visible content area)
   * 
   * @param options Screenshot capture options
   * @returns Promise resolving to screenshot data or error
   * 
   * @throws {INVALID_INPUT} When format, quality, previewMaxSize, or windowIndex parameters are invalid
   * @throws {INVALID_FILE_PATH} When outputPath is malformed or inaccessible
   * @throws {DIRECTORY_NOT_FOUND} When output directory doesn't exist and cannot be created
   * @throws {SCREEN_RECORDING_DENIED} When screen recording permissions not granted in System Preferences
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {SCREEN_CAPTURE_FAILED} When screenshot capture operation fails
   * @throws {FILE_WRITE_ERROR} When screenshot file cannot be written to specified path
   * @throws {DISK_FULL} When insufficient disk space to save screenshot file
   * @throws {PERMISSION_DENIED} When file system permissions prevent writing screenshot
   * @throws {TIMEOUT} When screenshot capture exceeds time limits
   * @throws {MEMORY_ERROR} When insufficient memory to capture or process screenshot
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {SYSTEM_ERROR} When system-level errors prevent screenshot capture
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during screenshot capture
   * 
   * @example
   * ```typescript
   * // Basic viewport screenshot with error handling
   * try {
   *   const result = await screenshotCmd.viewport({
   *     format: 'png',
   *     preview: true,
   *     windowIndex: 1
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.SCREEN_RECORDING_DENIED:
   *         console.log('Enable Screen Recording in System Preferences > Privacy & Security');
   *         break;
   *       case ErrorCode.CHROME_NOT_RUNNING:
   *         console.log('Start Chrome browser and try again');
   *         break;
   *       case ErrorCode.WINDOW_NOT_FOUND:
   *         console.log('Specified window does not exist');
   *         break;
   *       case ErrorCode.DISK_FULL:
   *         console.log('Free up disk space and try again');
   *         break;
   *     }
   *   } else {
   *     console.log(`Screenshot saved to: ${result.data.path}`);
   *     if (result.data.preview) {
   *       console.log(`Preview size: ${result.data.preview.size} bytes`);
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected screenshot error:', error);
   * }
   * ```
   */
  async viewport(options: ScreenshotOptions = {}): Promise<Result<ScreenshotData, string>> {
    // Validate options first
    const validationResult = this.validateScreenshotOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<ScreenshotData, string>;
    }
    
    // Create operation ID for rate limiting
    const operationId = RateLimitUtils.createOperationId('screenshot', 'viewport');
    
    // Execute with rate limiting
    const rateLimitedResult = await this.executeRateLimitedOperation(
      async () => {
        const startTime = Date.now();
        
        // Convert to library options format
        const libOptions: LibScreenshotOptions = {
          ...(options.outputPath && { outputPath: options.outputPath }),
          ...(options.format && { format: options.format }),
          ...(options.quality && { quality: options.quality }),
          ...(options.preview !== undefined && { preview: options.preview }),
          ...(options.previewMaxSize && { previewMaxSize: options.previewMaxSize })
        };
        
        const libResult = await captureViewport(libOptions, options.windowIndex);
        const convertedResult = this.convertLibResult(libResult, 'viewport_screenshot', startTime, !options.outputPath);
        
        if (!convertedResult.success) {
          const customError = new ScreenshotError(
            convertedResult.error,
            convertedResult.code,
            convertedResult.context?.recoveryHint as 'retry' | 'permission' | 'check_target' | 'not_recoverable' || 'retry',
            convertedResult.context?.metadata as Record<string, unknown>
          );
          throw customError;
        }
        
        return convertedResult.data;
      },
      operationId,
      {
        ...options,
        operationWeight: 2, // Screenshots are resource-intensive
        rateLimitMetadata: {
          format: options.format || 'png',
          preview: options.preview,
          windowIndex: options.windowIndex
        }
      }
    );
    
    return rateLimitedResult.result;
  }
  
  /**
   * Capture screenshot of the entire browser window (including chrome and title bar)
   * 
   * @param options Screenshot capture options
   * @returns Promise resolving to screenshot data or error
   * 
   * @throws {INVALID_INPUT} When format, quality, previewMaxSize, or windowIndex parameters are invalid
   * @throws {INVALID_FILE_PATH} When outputPath is malformed or inaccessible
   * @throws {DIRECTORY_NOT_FOUND} When output directory doesn't exist and cannot be created
   * @throws {SCREEN_RECORDING_DENIED} When screen recording permissions not granted in System Preferences
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {SCREEN_CAPTURE_FAILED} When screenshot capture operation fails
   * @throws {FILE_WRITE_ERROR} When screenshot file cannot be written to specified path
   * @throws {DISK_FULL} When insufficient disk space to save screenshot file
   * @throws {PERMISSION_DENIED} When file system permissions prevent writing screenshot
   * @throws {TIMEOUT} When screenshot capture exceeds time limits
   * @throws {MEMORY_ERROR} When insufficient memory to capture or process screenshot
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {SYSTEM_ERROR} When system-level errors prevent screenshot capture
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during screenshot capture
   * 
   * @example
   * ```typescript
   * // Window screenshot with error handling
   * try {
   *   const result = await screenshotCmd.window({
   *     format: 'jpg',
   *     quality: 85,
   *     outputPath: './window-capture.jpg'
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.SCREEN_RECORDING_DENIED:
   *         console.log('Grant screen recording permissions in System Preferences');
   *         break;
   *       case ErrorCode.INVALID_FILE_PATH:
   *         console.log('Check output path and permissions');
   *         break;
   *       case ErrorCode.WINDOW_NOT_FOUND:
   *         console.log('Window not found - check window index');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected window screenshot error:', error);
   * }
   * ```
   */
  async window(options: ScreenshotOptions = {}): Promise<Result<ScreenshotData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateScreenshotOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<ScreenshotData, string>;
    }
    
    // Use custom retry logic that excludes screenshot-specific errors
    return this.executeCommand(async () => {
      const libOptions: LibScreenshotOptions = {
        ...(options.outputPath && { outputPath: options.outputPath }),
        ...(options.format && { format: options.format }),
        ...(options.quality && { quality: options.quality }),
        ...(options.preview !== undefined && { preview: options.preview }),
        ...(options.previewMaxSize && { previewMaxSize: options.previewMaxSize })
      };
      
      const libResult = await captureWindow(libOptions, options.windowIndex);
      const convertedResult = this.convertLibResult(libResult, 'window_screenshot', startTime, !options.outputPath);
      
      if (!convertedResult.success) {
        // Throw custom error that preserves error code and context
        // Create custom error that preserves error code and context
        const customError = new ScreenshotError(
          convertedResult.error,
          convertedResult.code,
          convertedResult.context?.recoveryHint as 'retry' | 'permission' | 'check_target' | 'not_recoverable' || 'retry',
          convertedResult.context?.metadata as Record<string, unknown>
        );
        throw customError;
      }
      
      return convertedResult.data;
    }, 'window_screenshot', {
      maxAttempts: 1  // No retries for screenshots
    });
  }
  
  /**
   * Capture screenshot of a specific DOM element
   * 
   * @param selector CSS selector for the target element
   * @param options Screenshot capture options
   * @returns Promise resolving to screenshot data or error
   * 
   * @throws {INVALID_SELECTOR} When CSS selector is malformed or invalid
   * @throws {INVALID_INPUT} When format, quality, previewMaxSize, or windowIndex parameters are invalid
   * @throws {INVALID_FILE_PATH} When outputPath is malformed or inaccessible
   * @throws {DIRECTORY_NOT_FOUND} When output directory doesn't exist and cannot be created
   * @throws {TARGET_NOT_FOUND} When specified element selector matches no elements on page
   * @throws {ELEMENT_NOT_VISIBLE} When target element exists but is not visible in viewport
   * @throws {ELEMENT_NOT_INTERACTABLE} When target element cannot be captured (hidden, disabled)
   * @throws {TARGET_OUTSIDE_VIEWPORT} When element is outside the visible viewport area
   * @throws {MULTIPLE_TARGETS_FOUND} When selector matches multiple elements (ambiguous target)
   * @throws {SCREEN_RECORDING_DENIED} When screen recording permissions not granted in System Preferences
   * @throws {CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
   * @throws {CHROME_NOT_FOUND} When Chrome application cannot be found on system
   * @throws {WINDOW_NOT_FOUND} When specified window index does not exist
   * @throws {TAB_NOT_FOUND} When no active tab exists in the specified window
   * @throws {JAVASCRIPT_ERROR} When JavaScript execution fails during element location
   * @throws {SCREEN_CAPTURE_FAILED} When screenshot capture operation fails
   * @throws {FILE_WRITE_ERROR} When screenshot file cannot be written to specified path
   * @throws {DISK_FULL} When insufficient disk space to save screenshot file
   * @throws {PERMISSION_DENIED} When file system permissions prevent writing screenshot
   * @throws {TIMEOUT} When element location or screenshot capture exceeds time limits
   * @throws {MEMORY_ERROR} When insufficient memory to capture or process screenshot
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {SYSTEM_ERROR} When system-level errors prevent screenshot capture
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during element screenshot
   * 
   * @example
   * ```typescript
   * // Element screenshot with comprehensive error handling
   * try {
   *   const result = await screenshotCmd.element('#header', {
   *     format: 'png',
   *     preview: false
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.INVALID_SELECTOR:
   *         console.log('Check CSS selector syntax');
   *         break;
   *       case ErrorCode.TARGET_NOT_FOUND:
   *         console.log('Element not found - verify selector and page content');
   *         break;
   *       case ErrorCode.ELEMENT_NOT_VISIBLE:
   *         console.log('Element exists but is not visible - scroll to bring into view');
   *         break;
   *       case ErrorCode.MULTIPLE_TARGETS_FOUND:
   *         console.log('Selector matches multiple elements - use more specific selector');
   *         break;
   *       case ErrorCode.SCREEN_RECORDING_DENIED:
   *         console.log('Grant screen recording permissions in System Preferences');
   *         break;
   *     }
   *     // Check for recovery suggestions
   *     if (result.context?.recoveryHint === 'check_target') {
   *       console.log('Verify element exists and is visible');
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected element screenshot error:', error);
   * }
   * ```
   */
  async element(selector: string, options: ScreenshotOptions = {}): Promise<Result<ScreenshotData, string>> {
    // Validate selector
    const selectorValidation = this.validateSelector(selector);
    if (!selectorValidation.success) {
      return error(selectorValidation.error, ErrorCode.INVALID_SELECTOR, {
        recoveryHint: 'check_target',
        metadata: { selector, operation: 'element_screenshot' }
      });
    }
    
    // Validate options
    const validationResult = this.validateScreenshotOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<ScreenshotData, string>;
    }
    
    // Create operation ID for rate limiting
    const operationId = RateLimitUtils.createOperationId('screenshot', 'element', selector);
    
    // Execute with rate limiting
    const rateLimitedResult = await this.executeRateLimitedOperation(
      async () => {
        const startTime = Date.now();
        
        const libOptions: LibScreenshotOptions = {
          ...(options.outputPath && { outputPath: options.outputPath }),
          ...(options.format && { format: options.format }),
          ...(options.quality && { quality: options.quality }),
          ...(options.preview !== undefined && { preview: options.preview }),
          ...(options.previewMaxSize && { previewMaxSize: options.previewMaxSize })
        };
        
        const libResult = await captureElement(selector, libOptions, options.windowIndex);
        const convertedResult = this.convertLibResult(libResult, 'element_screenshot', startTime, !options.outputPath);
        
        if (!convertedResult.success) {
          const customError = new ScreenshotError(
            convertedResult.error,
            convertedResult.code,
            convertedResult.context?.recoveryHint as 'retry' | 'permission' | 'check_target' | 'not_recoverable' || 'retry',
            convertedResult.context?.metadata as Record<string, unknown>
          );
          throw customError;
        }
        
        return convertedResult.data;
      },
      operationId,
      {
        ...options,
        operationWeight: 3, // Element screenshots are slightly more expensive
        rateLimitMetadata: {
          selector,
          format: options.format || 'png',
          preview: options.preview,
          windowIndex: options.windowIndex
        }
      }
    );
    
    return rateLimitedResult.result;
  }
  
  /**
   * Capture screenshot of the entire screen (all displays)
   * 
   * @param options Screenshot capture options (windowIndex ignored for fullscreen)
   * @returns Promise resolving to screenshot data or error
   * 
   * @throws {INVALID_INPUT} When format, quality, or previewMaxSize parameters are invalid
   * @throws {INVALID_FILE_PATH} When outputPath is malformed or inaccessible
   * @throws {DIRECTORY_NOT_FOUND} When output directory doesn't exist and cannot be created
   * @throws {SCREEN_RECORDING_DENIED} When screen recording permissions not granted in System Preferences
   * @throws {SCREEN_CAPTURE_FAILED} When fullscreen screenshot capture operation fails
   * @throws {FILE_WRITE_ERROR} When screenshot file cannot be written to specified path
   * @throws {DISK_FULL} When insufficient disk space to save screenshot file
   * @throws {PERMISSION_DENIED} When file system permissions prevent writing screenshot
   * @throws {TIMEOUT} When screenshot capture exceeds time limits
   * @throws {MEMORY_ERROR} When insufficient memory to capture or process fullscreen screenshot
   * @throws {APPLESCRIPT_ERROR} When underlying AppleScript execution fails
   * @throws {SYSTEM_ERROR} When system-level errors prevent screenshot capture
   * @throws {UNKNOWN_ERROR} When an unexpected error occurs during fullscreen capture
   * 
   * @example
   * ```typescript
   * // Fullscreen screenshot with error handling
   * try {
   *   const result = await screenshotCmd.fullscreen({
   *     format: 'pdf',
   *     outputPath: './fullscreen-capture.pdf'
   *   });
   *   
   *   if (!result.success) {
   *     switch (result.code) {
   *       case ErrorCode.SCREEN_RECORDING_DENIED:
   *         console.log('Enable Screen Recording in System Preferences > Privacy & Security');
   *         console.log('Add your terminal application to the allowed apps list');
   *         break;
   *       case ErrorCode.INVALID_FILE_PATH:
   *         console.log('Check output path and ensure directory exists');
   *         break;
   *       case ErrorCode.DISK_FULL:
   *         console.log('Free up disk space - fullscreen captures can be large');
   *         break;
   *       case ErrorCode.MEMORY_ERROR:
   *         console.log('Insufficient memory for fullscreen capture - close other apps');
   *         break;
   *     }
   *   }
   * } catch (error) {
   *   console.error('Unexpected fullscreen screenshot error:', error);
   * }
   * ```
   */
  async fullscreen(options: ScreenshotOptions = {}): Promise<Result<ScreenshotData, string>> {
    const startTime = Date.now();
    
    // Validate options (windowIndex is ignored for fullscreen)
    const validationResult = this.validateScreenshotOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<ScreenshotData, string>;
    }
    
    // Use custom retry logic that excludes screenshot-specific errors
    return this.executeCommand(async () => {
      const libOptions: LibScreenshotOptions = {
        ...(options.outputPath && { outputPath: options.outputPath }),
        ...(options.format && { format: options.format }),
        ...(options.quality && { quality: options.quality }),
        ...(options.preview !== undefined && { preview: options.preview }),
        ...(options.previewMaxSize && { previewMaxSize: options.previewMaxSize })
      };
      
      const libResult = await captureFullScreen(libOptions);
      const convertedResult = this.convertLibResult(libResult, 'fullscreen_screenshot', startTime, !options.outputPath);
      
      if (!convertedResult.success) {
        // Throw custom error that preserves error code and context
        // Create custom error that preserves error code and context
        const customError = new ScreenshotError(
          convertedResult.error,
          convertedResult.code,
          convertedResult.context?.recoveryHint as 'retry' | 'permission' | 'check_target' | 'not_recoverable' || 'retry',
          convertedResult.context?.metadata as Record<string, unknown>
        );
        throw customError;
      }
      
      return convertedResult.data;
    }, 'fullscreen_screenshot', {
      maxAttempts: 1  // No retries for screenshots
    });
  }
  
  /**
   * Validate screenshot options with comprehensive error reporting
   * 
   * @private
   * @param options Options to validate
   * @returns Validated options or validation error
   */
  private validateScreenshotOptions(options: ScreenshotOptions): Result<void, string> {
    const validatedOptions: ScreenshotOptions = { ...options };
    
    // Validate format
    if (options.format && !['png', 'jpg', 'pdf'].includes(options.format)) {
      return error(
        `Invalid format: ${options.format}. Must be png, jpg, or pdf`,
        ErrorCode.INVALID_INPUT,
        {
          recoveryHint: 'user_action',
          metadata: { 
            parameter: 'format',
            provided: options.format,
            allowed: ['png', 'jpg', 'pdf']
          }
        }
      );
    }
    
    // Validate quality (only applies to jpg format)
    if (options.quality !== undefined) {
      if (typeof options.quality !== 'number' || options.quality < 1 || options.quality > 100) {
        return error(
          `Invalid quality: ${options.quality}. Must be a number between 1 and 100`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { 
              parameter: 'quality',
              provided: options.quality,
              range: '1-100'
            }
          }
        );
      }
      
      // Quality only makes sense for JPEG format
      if (options.format && options.format !== 'jpg') {
        return error(
          `Quality parameter only applies to jpg format, but format is ${options.format}`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { 
              parameter: 'quality',
              format: options.format,
              note: 'Quality ignored for non-jpg formats'
            }
          }
        );
      }
    }
    
    // Validate output path
    if (options.outputPath) {
      try {
        const resolvedPath = path.resolve(options.outputPath);
        const dir = path.dirname(resolvedPath);
        
        // Check if directory exists or can be created
        if (!fs.existsSync(dir)) {
          try {
            fs.mkdirSync(dir, { recursive: true });
          } catch (dirError) {
            return error(
              `Cannot create output directory: ${dir}`,
              ErrorCode.DIRECTORY_NOT_FOUND,
              {
                recoveryHint: 'user_action',
                metadata: { 
                  parameter: 'outputPath',
                  directory: dir,
                  error: String(dirError)
                }
              }
            );
          }
        }
        
        validatedOptions.outputPath = resolvedPath;
      } catch (pathError) {
        return error(
          `Invalid output path: ${options.outputPath}`,
          ErrorCode.INVALID_FILE_PATH,
          {
            recoveryHint: 'user_action',
            metadata: { 
              parameter: 'outputPath',
              provided: options.outputPath,
              error: String(pathError)
            }
          }
        );
      }
    }
    
    // Validate preview max size
    if (options.previewMaxSize !== undefined) {
      if (typeof options.previewMaxSize !== 'number' || options.previewMaxSize < 1024) {
        return error(
          `Invalid previewMaxSize: ${options.previewMaxSize}. Must be at least 1024 bytes`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { 
              parameter: 'previewMaxSize',
              provided: options.previewMaxSize,
              minimum: 1024
            }
          }
        );
      }
    }
    
    // Validate window index
    if (options.windowIndex !== undefined) {
      if (typeof options.windowIndex !== 'number' || options.windowIndex < 1 || options.windowIndex > 50) {
        return error(
          `Invalid windowIndex: ${options.windowIndex}. Must be between 1 and 50`,
          ErrorCode.INVALID_INPUT,
          {
            recoveryHint: 'user_action',
            metadata: { 
              parameter: 'windowIndex',
              provided: options.windowIndex,
              range: '1-50'
            }
          }
        );
      }
    }
    
    // Set defaults
    validatedOptions.format = validatedOptions.format || 'png';
    validatedOptions.preview = validatedOptions.preview ?? true;
    validatedOptions.windowIndex = validatedOptions.windowIndex || 1;
    
    return ok(undefined);
  }
  
  /**
   * Convert library ScreenshotResult to service Result pattern
   * 
   * @private
   * @param libResult Result from capture library
   * @param operation Operation name for context
   * @param startTime Operation start time for duration calculation
   * @param includePreview Whether to include base64 preview data (false when saving to file)
   * @returns Converted result with unified error handling
   */
  private convertLibResult(
    libResult: LibScreenshotResult, 
    operation: string, 
    startTime: number,
    includePreview: boolean = true
  ): Result<ScreenshotData, string> {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      // Convert library error codes to service error codes
      let errorCode: ErrorCode;
      let recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' = 'retry';
      
      switch (libResult.code) {
        case 30: // PERMISSION_DENIED from legacy ERROR_CODES - map to SCREEN_RECORDING_DENIED for screenshots
          errorCode = ErrorCode.SCREEN_RECORDING_DENIED;
          recoveryHint = 'permission';
          break;
        case 20: // TARGET_NOT_FOUND
          errorCode = ErrorCode.TARGET_NOT_FOUND;
          recoveryHint = 'check_target';
          break;
        case 50: // CHROME_NOT_FOUND
          errorCode = ErrorCode.CHROME_NOT_FOUND;
          recoveryHint = 'not_recoverable';
          break;
        default:
          errorCode = ErrorCode.SCREEN_CAPTURE_FAILED;
          recoveryHint = 'retry';
      }
      
      return error(
        libResult.error || 'Screenshot capture failed',
        errorCode,
        {
          recoveryHint,
          durationMs: duration,
          metadata: {
            operation,
            originalCode: libResult.code,
            action: libResult.action
          }
        }
      );
    }
    
    if (!libResult.path) {
      return error(
        'Screenshot was captured but no file path was returned',
        ErrorCode.UNKNOWN_ERROR,
        {
          recoveryHint: 'retry',
          durationMs: duration,
          metadata: { operation }
        }
      );
    }
    
    // Build successful result data
    const screenshotData: ScreenshotData = {
      path: libResult.path,
      format: path.extname(libResult.path).slice(1) || 'png',
      metadata: {
        width: libResult.metadata?.width || 0,
        height: libResult.metadata?.height || 0,
        timestamp: new Date().toISOString(),
        ...(libResult.metadata?.windowTitle && { windowTitle: libResult.metadata.windowTitle }),
        ...(libResult.metadata?.url && { url: libResult.metadata.url })
      }
    };
    
    // Add preview data if available and requested (don't include base64 when saving to file)
    if (libResult.preview && includePreview) {
      screenshotData.preview = {
        base64: libResult.preview.base64,
        size: libResult.preview.size
      };
    }
    
    return ok(screenshotData);
  }
  
}