/**
 * @fileoverview Tests for screenshot command implementation
 * 
 * This test suite verifies the viewport screenshot capture functionality
 * including coordinate calculation, screen capture execution, permission
 * error handling, and WebP preview generation as specified in SHOT-002.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { ScreenshotCommand, type ScreenshotOptions, type ScreenshotData } from '../screenshot.js';
import { ErrorCode } from '../../core/ErrorCodes.js';
import type { IServiceContainer } from '../../di/ServiceContainer.js';
import type { IRateLimiterService } from '../../di/IRateLimiterService.js';
import { SERVICE_TOKENS } from '../../di/ServiceTokens.js';
import { Result, ok } from '../../core/Result.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock the capture library
jest.mock('../../lib/capture.js', () => ({
  captureViewport: jest.fn(),
  captureWindow: jest.fn(),
  captureElement: jest.fn(),
  captureFullScreen: jest.fn()
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  statSync: jest.fn()
}));

import { 
  captureViewport, 
  captureWindow, 
  captureElement, 
  captureFullScreen 
} from '../../lib/capture.js';

const mockCaptureViewport = captureViewport as jest.MockedFunction<typeof captureViewport>;
const mockCaptureWindow = captureWindow as jest.MockedFunction<typeof captureWindow>;
const mockCaptureElement = captureElement as jest.MockedFunction<typeof captureElement>;
const mockCaptureFullScreen = captureFullScreen as jest.MockedFunction<typeof captureFullScreen>;

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

describe('ScreenshotCommand', () => {
  let screenshotCmd: ScreenshotCommand;
  let mockContainer: jest.Mocked<IServiceContainer>;
  let mockRateLimiter: jest.Mocked<IRateLimiterService>;
  
  beforeEach(() => {
    // Create mock rate limiter service
    mockRateLimiter = {
      checkLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetTimeMs: 60000,
        retryAfterMs: 0,
        rule: 'default'
      }),
      recordUsage: jest.fn().mockResolvedValue(),
      configureLimit: jest.fn().mockResolvedValue(),
      adjustLimit: jest.fn().mockResolvedValue(),
      getStats: jest.fn().mockResolvedValue({
        totalChecked: 0,
        allowed: 0,
        denied: 0,
        allowRate: 1.0
      }),
      checkAndRecord: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetTimeMs: 60000,
        retryAfterMs: 0,
        rule: 'default'
      }),
      destroy: jest.fn().mockResolvedValue()
    };

    // Create mock service container
    mockContainer = {
      resolve: jest.fn().mockImplementation((token) => {
        if (token === SERVICE_TOKENS.RateLimiterService) {
          return Promise.resolve(ok(mockRateLimiter));
        }
        return Promise.resolve(ok({}));
      }),
      registerSingleton: jest.fn(),
      registerTransient: jest.fn(),
      registerFactory: jest.fn(),
      isRegistered: jest.fn().mockReturnValue(true),
      createScope: jest.fn(),
      dispose: jest.fn().mockResolvedValue()
    };

    screenshotCmd = new ScreenshotCommand(mockContainer);
    
    // Reset all mocks
    mockCaptureViewport.mockClear();
    mockCaptureWindow.mockClear();
    mockCaptureElement.mockClear();
    mockCaptureFullScreen.mockClear();
    mockExistsSync.mockClear();
    mockMkdirSync.mockClear();
  });

  describe('viewport screenshot', () => {
    const mockViewportResult = {
      success: true as const,
      action: 'viewport_screenshot',
      path: '/tmp/screenshot.png',
      code: 0,
      metadata: {
        width: 1200,
        height: 800,
        windowTitle: 'Test Page - Chrome'
      },
      preview: {
        base64: 'base64encodeddata',
        size: 50000
      }
    };

    it('should capture viewport with default options', async () => {
      mockCaptureViewport.mockResolvedValue(mockViewportResult);

      const result = await screenshotCmd.viewport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/tmp/screenshot.png');
        expect(result.data.format).toBe('png');
        expect(result.data.metadata.width).toBe(1200);
        expect(result.data.metadata.height).toBe(800);
        expect(result.data.metadata.windowTitle).toBe('Test Page - Chrome');
        expect(result.data.preview).toBeDefined();
        expect(result.data.preview?.base64).toBe('base64encodeddata');
        expect(result.data.preview?.size).toBe(50000);
      }
    });

    it('should capture viewport with custom format and quality', async () => {
      const mockJpgResult = {
        ...mockViewportResult,
        path: '/tmp/screenshot.jpg'
      };
      
      mockCaptureViewport.mockResolvedValue(mockJpgResult);

      const options: ScreenshotOptions = {
        format: 'jpg',
        quality: 85,
        outputPath: '/tmp/screenshot.jpg'
      };

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/tmp/screenshot.jpg');
        expect(result.data.format).toBe('jpg');
      }

      expect(mockCaptureViewport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'jpg',
          quality: 85,
          outputPath: '/tmp/screenshot.jpg'
        }),
        undefined
      );
    });

    it('should handle viewport capture failure', async () => {
      const mockFailureResult = {
        success: false as const,
        action: 'viewport_screenshot',
        error: 'Failed to get viewport information',
        code: 50 // CHROME_NOT_FOUND
      };

      mockCaptureViewport.mockResolvedValue(mockFailureResult);

      const result = await screenshotCmd.viewport();

      expect(result.success).toBe(false);
      if (!result.success) {
        // Debug what we actually get
        console.log('Actual error:', result.error);
        console.log('Error type:', typeof result.error);
        console.log('Full result:', JSON.stringify(result, null, 2));
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('Failed to get viewport information');
        expect(result.code).toBe(ErrorCode.CHROME_NOT_FOUND);
      }
    });

    it('should handle screen recording permission errors', async () => {
      const mockPermissionError = {
        success: false as const,
        action: 'viewport_screenshot',
        error: 'Screen recording permission denied. Please grant permission in System Preferences > Privacy & Security > Screen Recording and restart the application.',
        code: 30 // PERMISSION_DENIED
      };

      mockCaptureViewport.mockResolvedValue(mockPermissionError);

      const result = await screenshotCmd.viewport();

      // Debug what we actually get
      console.log('Permission error result:', JSON.stringify(result, null, 2));
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Screen recording permission denied. Please grant permission in System Preferences > Privacy & Security > Screen Recording and restart the application.');
        expect(result.code).toBe(ErrorCode.SCREEN_RECORDING_DENIED);
        expect(result.context?.recoveryHint).toBe('permission');
      }
    });

    it('should handle invalid viewport dimensions', async () => {
      const mockInvalidViewportResult = {
        success: false as const,
        action: 'viewport_screenshot',
        error: 'Invalid viewport dimensions: 0x0',
        code: 20 // TARGET_NOT_FOUND
      };

      mockCaptureViewport.mockResolvedValue(mockInvalidViewportResult);

      const result = await screenshotCmd.viewport();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid viewport dimensions: 0x0');
        expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
        expect(result.context?.recoveryHint).toBe('check_target');
      }
    });

    it('should validate format parameter', async () => {
      const options = {
        format: 'gif' // Invalid format - not in 'png' | 'jpg' | 'pdf' union
      } as ScreenshotOptions;

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid format: gif');
        expect(result.error).toContain('Must be png, jpg, or pdf');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.context?.recoveryHint).toBe('user_action');
      }
    });

    it('should validate quality parameter', async () => {
      const options: ScreenshotOptions = {
        format: 'jpg',
        quality: 150 // Invalid quality
      };

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid quality: 150');
        expect(result.error).toContain('Must be a number between 1 and 100');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      }
    });

    it('should validate quality only applies to jpg format', async () => {
      const options: ScreenshotOptions = {
        format: 'png',
        quality: 90
      };

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Quality parameter only applies to jpg format');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      }
    });

    it('should validate window index parameter', async () => {
      const options: ScreenshotOptions = {
        windowIndex: 0 // Invalid window index
      };

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid windowIndex: 0');
        expect(result.error).toContain('Must be between 1 and 50');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      }
    });

    it('should handle WebP preview generation failure gracefully', async () => {
      const mockResultWithoutPreview = {
        ...mockViewportResult,
        preview: undefined
      };

      mockCaptureViewport.mockResolvedValue(mockResultWithoutPreview);

      const result = await screenshotCmd.viewport({ preview: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preview).toBeUndefined();
        // Screenshot should still succeed even if preview fails
        expect(result.data.path).toBe('/tmp/screenshot.png');
      }
    });

    it('should create output directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockReturnValue(undefined);
      mockCaptureViewport.mockResolvedValue(mockViewportResult);

      const options: ScreenshotOptions = {
        outputPath: '/path/to/new/dir/screenshot.png'
      };

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(true);
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/new/dir'),
        { recursive: true }
      );
    });

    it('should handle directory creation failure', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const options: ScreenshotOptions = {
        outputPath: '/root/restricted/screenshot.png'
      };

      const result = await screenshotCmd.viewport(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Cannot create output directory');
        expect(result.code).toBe(ErrorCode.DIRECTORY_NOT_FOUND);
      }
    });
  });

  describe('element screenshot', () => {
    const mockElementResult = {
      success: true as const,
      action: 'element_screenshot',
      path: '/tmp/element.png',
      code: 0,
      metadata: {
        width: 200,
        height: 50
      }
    };

    it('should capture element screenshot with valid selector', async () => {
      mockCaptureElement.mockResolvedValue(mockElementResult);

      const result = await screenshotCmd.element('#test-button');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/tmp/element.png');
        expect(result.data.metadata.width).toBe(200);
        expect(result.data.metadata.height).toBe(50);
      }

      expect(mockCaptureElement).toHaveBeenCalledWith(
        '#test-button',
        expect.any(Object),
        undefined
      );
    });

    it('should handle invalid selector', async () => {
      const result = await screenshotCmd.element('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Selector is required');
        expect(result.code).toBe(ErrorCode.INVALID_SELECTOR);
        expect(result.context?.recoveryHint).toBe('check_target');
      }
    });

    it('should handle element not found', async () => {
      const mockNotFoundResult = {
        success: false as const,
        action: 'element_screenshot',
        error: 'Element "#missing-element" is not visible',
        code: 20 // TARGET_NOT_FOUND
      };

      mockCaptureElement.mockResolvedValue(mockNotFoundResult);

      const result = await screenshotCmd.element('#missing-element');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Element "#missing-element" is not visible');
        expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
      }
    });
  });

  describe('window and fullscreen screenshots', () => {
    it('should capture window screenshot', async () => {
      const mockWindowResult = {
        success: true as const,
        action: 'window_screenshot',
        path: '/tmp/window.png',
        code: 0,
        metadata: {
          width: 1280,
          height: 720,
          windowTitle: 'Chrome Window'
        }
      };

      mockCaptureWindow.mockResolvedValue(mockWindowResult);

      const result = await screenshotCmd.window();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/tmp/window.png');
        expect(result.data.metadata.width).toBe(1280);
        expect(result.data.metadata.height).toBe(720);
      }
    });

    it('should capture fullscreen screenshot', async () => {
      const mockFullscreenResult = {
        success: true as const,
        action: 'fullscreen_screenshot',
        path: '/tmp/fullscreen.png',
        code: 0
      };

      mockCaptureFullScreen.mockResolvedValue(mockFullscreenResult);

      const result = await screenshotCmd.fullscreen();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/tmp/fullscreen.png');
      }
    });
  });
});