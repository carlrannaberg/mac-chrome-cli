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
import { Result, ok, error } from '../core/Result.js';
import { ErrorCode } from '../core/ErrorCodes.js';
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
export interface ScreenshotOptions {
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
 * Screenshot command implementation with service-oriented architecture
 * 
 * Provides type-safe screenshot capture methods with comprehensive error handling,
 * validation, and integration with the unified Result pattern.
 */
export class ScreenshotCommand extends BrowserCommandBase {
  
  /**
   * Capture screenshot of the browser viewport (visible content area)
   * 
   * @param options Screenshot capture options
   * @returns Promise resolving to screenshot data or error
   * 
   * @example
   * ```typescript
   * const result = await screenshotCmd.viewport({
   *   format: 'png',
   *   preview: true,
   *   windowIndex: 1
   * });
   * 
   * if (result.success) {
   *   console.log(`Screenshot saved to: ${result.data.path}`);
   *   if (result.data.preview) {
   *     console.log(`Preview size: ${result.data.preview.size} bytes`);
   *   }
   * }
   * ```
   */
  async viewport(options: ScreenshotOptions = {}): Promise<Result<ScreenshotData, string>> {
    const startTime = Date.now();
    
    // Validate options
    const validationResult = this.validateScreenshotOptions(options);
    if (!validationResult.success) {
      return validationResult as Result<ScreenshotData, string>;
    }
    
    try {
      // Convert to library options format
      const libOptions: LibScreenshotOptions = {
        ...(options.outputPath && { outputPath: options.outputPath }),
        ...(options.format && { format: options.format }),
        ...(options.quality && { quality: options.quality }),
        ...(options.preview !== undefined && { preview: options.preview }),
        ...(options.previewMaxSize && { previewMaxSize: options.previewMaxSize })
      };
      
      const libResult = await captureViewport(libOptions, options.windowIndex);
      const convertedResult = this.convertLibResult(libResult, 'viewport_screenshot', startTime);
      
      if (!convertedResult.success) {
        return convertedResult;
      }
      
      return ok(convertedResult.data);
    } catch (error) {
      return error(`Viewport screenshot failed: ${error instanceof Error ? error.message : String(error)}`, ErrorCode.UNKNOWN_ERROR);
    }
  }
  
  /**
   * Capture screenshot of the entire browser window (including chrome and title bar)
   * 
   * @param options Screenshot capture options
   * @returns Promise resolving to screenshot data or error
   * 
   * @example
   * ```typescript
   * const result = await screenshotCmd.window({
   *   format: 'jpg',
   *   quality: 85,
   *   outputPath: './window-capture.jpg'
   * });
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
      const convertedResult = this.convertLibResult(libResult, 'window_screenshot', startTime);
      
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
   * @example
   * ```typescript
   * const result = await screenshotCmd.element('#header', {
   *   format: 'png',
   *   preview: false
   * });
   * 
   * if (!result.success) {
   *   console.error('Element screenshot failed:', result.error);
   *   // Check for recovery suggestions
   *   if (result.context?.recoveryHint === 'check_target') {
   *     console.log('Verify element exists and is visible');
   *   }
   * }
   * ```
   */
  async element(selector: string, options: ScreenshotOptions = {}): Promise<Result<ScreenshotData, string>> {
    const startTime = Date.now();
    
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
    
    // Use custom retry logic that excludes screenshot-specific errors
    return this.executeCommand(async () => {
      const libOptions: LibScreenshotOptions = {
        ...(options.outputPath && { outputPath: options.outputPath }),
        ...(options.format && { format: options.format }),
        ...(options.quality && { quality: options.quality }),
        ...(options.preview !== undefined && { preview: options.preview }),
        ...(options.previewMaxSize && { previewMaxSize: options.previewMaxSize })
      };
      
      const libResult = await captureElement(selector, libOptions, options.windowIndex);
      const convertedResult = this.convertLibResult(libResult, 'element_screenshot', startTime);
      
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
    }, 'element_screenshot', {
      maxAttempts: 1  // No retries for screenshots
    });
  }
  
  /**
   * Capture screenshot of the entire screen (all displays)
   * 
   * @param options Screenshot capture options (windowIndex ignored for fullscreen)
   * @returns Promise resolving to screenshot data or error
   * 
   * @example
   * ```typescript
   * const result = await screenshotCmd.fullscreen({
   *   format: 'pdf',
   *   outputPath: './fullscreen-capture.pdf'
   * });
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
      const convertedResult = this.convertLibResult(libResult, 'fullscreen_screenshot', startTime);
      
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
   * @returns Converted result with unified error handling
   */
  private convertLibResult(
    libResult: LibScreenshotResult, 
    operation: string, 
    startTime: number
  ): Result<ScreenshotData, string> {
    const duration = Date.now() - startTime;
    
    if (!libResult.success) {
      // Convert library error codes to service error codes
      let errorCode: ErrorCode;
      let recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' = 'retry';
      
      switch (libResult.code) {
        case 30: // PERMISSION_DENIED from legacy ERROR_CODES
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
    
    // Add preview data if available
    if (libResult.preview) {
      screenshotData.preview = {
        base64: libResult.preview.base64,
        size: libResult.preview.size
      };
    }
    
    return ok(screenshotData);
  }
  
}