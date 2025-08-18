/**
 * Unit tests for coordinate calculation functions
 */

import {
  viewportToScreen,
  selectorToScreen,
  getScreenCoordinates,
  isCoordinateVisible,
  validateElementVisibility,
  type Coordinates,
  type ElementRect,
  type ViewportRect,
  type WindowBounds,
  type CoordinateResult
} from '../../src/lib/coords.js';
import { ERROR_CODES } from '../../src/lib/util.js';
import * as apple from '../../src/lib/apple.js';
import { clearPerformanceCaches } from '../../src/lib/performance.js';

// Mock the apple module
jest.mock('../../src/lib/apple.js');
const mockApple = apple as jest.Mocked<typeof apple>;

describe('Coordinate Math Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPerformanceCaches();
  });

  describe('viewportToScreen', () => {
    it('should convert viewport coordinates to screen coordinates successfully', async () => {
      // Mock successful viewport info and window bounds
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await viewportToScreen(500, 300, 1);

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeValidCoordinates();
      expect(result.coordinates).toEqual({ x: 600, y: 424 }); // 100 + 500, 124 + 300 (with title bar)
      expect(result.code).toBeErrorCode(ERROR_CODES.OK);
      expect(result.viewport).toBeDefined();
      expect(result.window).toBeDefined();
    });

    it('should handle viewport info failure', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: false,
        error: 'Failed to get viewport',
        code: ERROR_CODES.UNKNOWN_ERROR
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await viewportToScreen(500, 300, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get viewport information');
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should handle window bounds failure', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: false,
        error: 'Chrome not found',
        code: ERROR_CODES.CHROME_NOT_FOUND
      });

      const result = await viewportToScreen(500, 300, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get window bounds');
      expect(result.code).toBeErrorCode(ERROR_CODES.CHROME_NOT_FOUND);
    });

    it('should handle exceptions gracefully', async () => {
      mockApple.execChromeJS.mockRejectedValueOnce(new Error('Network error'));

      const result = await viewportToScreen(500, 300, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to convert viewport to screen coordinates');
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should calculate coordinates correctly with scrolling', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 100, 200),
        code: ERROR_CODES.OK
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 50, y: 50, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await viewportToScreen(400, 300, 1);

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual({ x: 450, y: 374 }); // 50 + 400, 74 + 300
    });
  });

  describe('selectorToScreen', () => {
    it('should convert CSS selector to screen coordinates successfully', async () => {
      const mockElement = testUtils.createMockElement({ x: 100, y: 200, width: 150, height: 50 });
      const mockViewport = testUtils.createMockViewport(1920, 1080, 0, 0);
      const mockWindow = {
        id: 1,
        title: 'Test Window',
        bounds: { x: 100, y: 100, width: 1920, height: 1080 },
        visible: true
      };

      // Mock element rect
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          result: mockElement,
          code: ERROR_CODES.OK
        })
        // Mock viewport info
        .mockResolvedValueOnce({
          success: true,
          result: mockViewport,
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: mockWindow,
        code: ERROR_CODES.OK
      });

      const result = await selectorToScreen('#test-button', 1);

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual({ x: 275, y: 349 }); // Center of element + window offset
      expect(result.element).toEqual(mockElement);
      expect(result.viewport).toEqual(mockViewport);
      expect(result.code).toBeErrorCode(ERROR_CODES.OK);
    });

    it('should handle element not found', async () => {
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          result: null, // Element not found
          code: ERROR_CODES.OK
        })
        .mockResolvedValueOnce({
          success: true,
          result: testUtils.createMockViewport(),
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await selectorToScreen('#non-existent', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found: #non-existent');
      expect(result.code).toBeErrorCode(ERROR_CODES.TARGET_NOT_FOUND);
    });

    it('should handle JavaScript execution failure', async () => {
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: false,
          error: 'JavaScript execution failed',
          code: ERROR_CODES.UNKNOWN_ERROR
        })
        .mockResolvedValueOnce({
          success: true,
          result: testUtils.createMockViewport(),
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await selectorToScreen('#test-button', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to execute JavaScript: JavaScript execution failed');
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should escape CSS selectors properly', async () => {
      const mockElement = testUtils.createMockElement({ x: 100, y: 200, width: 150, height: 50 });
      
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          result: mockElement,
          code: ERROR_CODES.OK
        })
        .mockResolvedValueOnce({
          success: true,
          result: testUtils.createMockViewport(),
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      await selectorToScreen("button[title='Test']", 1);

      // Verify the selector was properly escaped in the JavaScript
      const jsCall = mockApple.execChromeJS.mock.calls[0];
      expect(jsCall[0]).toContain("button[title=\\'Test\\']");
    });
  });

  describe('getScreenCoordinates', () => {
    it('should use selector when provided', async () => {
      const mockElement = testUtils.createMockElement({ x: 100, y: 200, width: 150, height: 50 });
      
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          result: mockElement,
          code: ERROR_CODES.OK
        })
        .mockResolvedValueOnce({
          success: true,
          result: testUtils.createMockViewport(),
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await getScreenCoordinates({ selector: '#test' }, 1);

      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
    });

    it('should use x,y coordinates when provided', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(),
        code: ERROR_CODES.OK
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await getScreenCoordinates({ x: 500, y: 300 }, 1);

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual({ x: 600, y: 424 });
    });

    it('should require either selector or coordinates', async () => {
      const result = await getScreenCoordinates({}, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');
      expect(result.code).toBeErrorCode(ERROR_CODES.INVALID_INPUT);
    });

    it('should prioritize selector over coordinates', async () => {
      const mockElement = testUtils.createMockElement({ x: 100, y: 200, width: 150, height: 50 });
      
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          result: mockElement,
          code: ERROR_CODES.OK
        })
        .mockResolvedValueOnce({
          success: true,
          result: testUtils.createMockViewport(),
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await getScreenCoordinates({ selector: '#test', x: 500, y: 300 }, 1);

      expect(result.success).toBe(true);
      expect(result.element).toBeDefined(); // Should use selector, not x,y
    });
  });

  describe('isCoordinateVisible', () => {
    it('should return true for coordinates within viewport', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      const result = await isCoordinateVisible(500, 300, 1);
      expect(result).toBe(true);
    });

    it('should return false for coordinates outside viewport', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      const resultNegative = await isCoordinateVisible(-100, 300, 1);
      expect(resultNegative).toBe(false);

      const resultTooLarge = await isCoordinateVisible(2000, 300, 1);
      expect(resultTooLarge).toBe(false);

      const resultTooHigh = await isCoordinateVisible(500, 1200, 1);
      expect(resultTooHigh).toBe(false);
    });

    it('should return false on viewport info failure', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: false,
        error: 'Failed to get viewport',
        code: ERROR_CODES.UNKNOWN_ERROR
      });

      const result = await isCoordinateVisible(500, 300, 1);
      expect(result).toBe(false);
    });

    it('should handle boundary coordinates correctly', async () => {
      mockApple.execChromeJS.mockResolvedValue({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      const resultOrigin = await isCoordinateVisible(0, 0, 1);
      expect(resultOrigin).toBe(true);

      const resultCenter = await isCoordinateVisible(960, 540, 1);
      expect(resultCenter).toBe(true);
    });

    it('should handle exceptions gracefully', async () => {
      mockApple.execChromeJS.mockRejectedValueOnce(new Error('Network error'));

      const result = await isCoordinateVisible(500, 300, 1);
      expect(result).toBe(false);
    });
  });

  describe('validateElementVisibility', () => {
    it('should validate visible and clickable element', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: { visible: true, clickable: true, inViewport: true },
        code: ERROR_CODES.OK
      });

      const result = await validateElementVisibility('#visible-button', 1);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        visible: true,
        clickable: true,
        inViewport: true
      });
    });

    it('should detect hidden elements', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: { visible: false, clickable: false, inViewport: false },
        code: ERROR_CODES.OK
      });

      const result = await validateElementVisibility('#hidden-element', 1);

      expect(result.success).toBe(true);
      expect(result.result?.visible).toBe(false);
      expect(result.result?.clickable).toBe(false);
    });

    it('should detect elements outside viewport', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: { visible: true, clickable: true, inViewport: false },
        code: ERROR_CODES.OK
      });

      const result = await validateElementVisibility('#offscreen-element', 1);

      expect(result.success).toBe(true);
      expect(result.result?.visible).toBe(true);
      expect(result.result?.inViewport).toBe(false);
    });

    it('should handle JavaScript execution failure', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: false,
        error: 'JavaScript execution failed',
        code: ERROR_CODES.UNKNOWN_ERROR
      });

      const result = await validateElementVisibility('#test-element', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('JavaScript execution failed');
    });

    it('should escape CSS selectors in validation', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: { visible: true, clickable: true, inViewport: true },
        code: ERROR_CODES.OK
      });

      await validateElementVisibility("input[name='test']", 1);

      const jsCall = mockApple.execChromeJS.mock.calls[0];
      expect(jsCall[0]).toContain("input[name=\\'test\\']");
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero dimensions correctly', async () => {
      const mockElement = testUtils.createMockElement({ x: 100, y: 200, width: 0, height: 0 });
      
      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          result: mockElement,
          code: ERROR_CODES.OK
        })
        .mockResolvedValueOnce({
          success: true,
          result: testUtils.createMockViewport(),
          code: ERROR_CODES.OK
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await selectorToScreen('#zero-size', 1);

      expect(result.success).toBe(true);
      expect(result.element).toBeValidRect();
      expect(result.coordinates).toEqual({ x: 200, y: 324 }); // Center is still calculated
    });

    it('should handle negative coordinates', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await viewportToScreen(-50, -30, 1);

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual({ x: 50, y: 94 }); // Window offset still applied
    });

    it('should handle multiple window indices', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        result: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        result: {
          id: 2,
          title: 'Test Window 2',
          bounds: { x: 200, y: 200, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK
      });

      const result = await viewportToScreen(500, 300, 2); // Window index 2

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual({ x: 700, y: 524 }); // Different window offset
      expect(mockApple.execChromeJS).toHaveBeenCalledWith(expect.any(String), 1, 2);
      expect(mockApple.getChromeWindowBounds).toHaveBeenCalledWith(2);
    });
  });
});