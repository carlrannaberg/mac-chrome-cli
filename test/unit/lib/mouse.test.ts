/**
 * Unit tests for mouse library
 */

import {
  mouseClick,
  mouseDoubleClick,
  mouseRightClick,
  mouseMove,
  mouseDrag,
  mouseContext,
  type MouseOptions,
  type MouseResult,
  type MouseActionData
} from '../../../src/lib/mouse.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import * as coords from '../../../src/lib/coords.js';
import * as ui from '../../../src/lib/ui.js';

// Mock the coords library
jest.mock('../../../src/lib/coords.js', () => ({
  getScreenCoordinates: jest.fn(),
  validateElementVisibility: jest.fn()
}));

// Mock the ui library
jest.mock('../../../src/lib/ui.js', () => ({
  clickAt: jest.fn(),
  doubleClickAt: jest.fn(),
  rightClickAt: jest.fn(),
  moveTo: jest.fn(),
  dragFromTo: jest.fn()
}));

const mockGetScreenCoordinates = coords.getScreenCoordinates as jest.MockedFunction<typeof coords.getScreenCoordinates>;
const mockValidateElementVisibility = coords.validateElementVisibility as jest.MockedFunction<typeof coords.validateElementVisibility>;
const mockClickAt = ui.clickAt as jest.MockedFunction<typeof ui.clickAt>;
const mockDoubleClickAt = ui.doubleClickAt as jest.MockedFunction<typeof ui.doubleClickAt>;
const mockRightClickAt = ui.rightClickAt as jest.MockedFunction<typeof ui.rightClickAt>;
const mockMoveTo = ui.moveTo as jest.MockedFunction<typeof ui.moveTo>;
const mockDragFromTo = ui.dragFromTo as jest.MockedFunction<typeof ui.dragFromTo>;

describe('Mouse Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mouseClick', () => {
    test('should click at coordinates successfully', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('click');
      expect(result.data?.coordinates).toEqual({ x: 100, y: 200 });
      expect(mockGetScreenCoordinates).toHaveBeenCalledWith({ x: 100, y: 200 }, 1);
      expect(mockClickAt).toHaveBeenCalledWith(100, 200, { windowIndex: 1 });
    });

    test('should click at element selector successfully', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 150, y: 300 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: true
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        selector: '#button'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('click');
      expect(result.data?.coordinates).toEqual({ x: 150, y: 300 });
      expect(result.data?.element?.selector).toBe('#button');
      expect(result.data?.element?.visible).toBe(true);
      expect(result.data?.element?.clickable).toBe(true);
      expect(mockGetScreenCoordinates).toHaveBeenCalledWith({ selector: '#button' }, 1);
      expect(mockValidateElementVisibility).toHaveBeenCalledWith('#button', 1);
    });

    test('should apply offset to coordinates', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        x: 100,
        y: 200,
        offsetX: 10,
        offsetY: -5
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 110, y: 195 });
      expect(mockClickAt).toHaveBeenCalledWith(110, 195, { windowIndex: 1 });
    });

    test('should handle custom button and click count', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        x: 100,
        y: 200,
        button: 'right',
        clickCount: 2
      });

      expect(result.success).toBe(true);
      expect(mockClickAt).toHaveBeenCalledWith(100, 200, {
        button: 'right',
        clickCount: 2,
        windowIndex: 1
      });
    });

    test('should use custom window index', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        x: 100,
        y: 200,
        windowIndex: 3
      });

      expect(result.success).toBe(true);
      expect(mockGetScreenCoordinates).toHaveBeenCalledWith({ x: 100, y: 200 }, 3);
      expect(mockClickAt).toHaveBeenCalledWith(100, 200, { windowIndex: 3 });
    });

    test('should reject missing coordinates and selector', async () => {
      const result = await mouseClick({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject invalid coordinates', async () => {
      let result = await mouseClick({
        x: 'invalid' as unknown as number,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid x coordinate');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);

      result = await mouseClick({
        x: 100,
        y: 'invalid' as unknown as number
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid y coordinate');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject invalid selector', async () => {
      const result = await mouseClick({
        selector: null as unknown as string
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle coordinate resolution failure', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: false,
        error: 'Element not found',
        code: ErrorCode.ELEMENT_NOT_FOUND
      });

      const result = await mouseClick({
        selector: '#missing'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
      expect(result.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    });

    test('should reject invisible elements', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: false,
          clickable: true
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        selector: '#invisible'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element "#invisible" is not visible');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should reject non-clickable elements', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        selector: '#disabled'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element "#disabled" is not clickable');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should handle click execution failure', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: false,
        code: ErrorCode.APPLESCRIPT_ERROR,
        error: 'AppleScript execution failed'
      });

      const result = await mouseClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('AppleScript execution failed');
      expect(result.code).toBe(ErrorCode.APPLESCRIPT_ERROR);
    });

    test('should handle exceptions', async () => {
      mockGetScreenCoordinates.mockRejectedValue(new Error('Unexpected error'));

      const result = await mouseClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mouse click failed: Error: Unexpected error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('mouseDoubleClick', () => {
    test('should double-click at coordinates successfully', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockDoubleClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseDoubleClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('double_click');
      expect(result.data?.coordinates).toEqual({ x: 100, y: 200 });
      expect(mockDoubleClickAt).toHaveBeenCalledWith(100, 200);
    });

    test('should apply offset for double-click', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockDoubleClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseDoubleClick({
        x: 100,
        y: 200,
        offsetX: 5,
        offsetY: 10
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 105, y: 210 });
      expect(mockDoubleClickAt).toHaveBeenCalledWith(105, 210);
    });

    test('should handle double-click failure', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockDoubleClickAt.mockResolvedValue({
        success: false,
        code: ErrorCode.MOUSE_ACTION_FAILED,
        error: 'Double-click failed'
      });

      const result = await mouseDoubleClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Double-click failed');
      expect(result.code).toBe(ErrorCode.MOUSE_ACTION_FAILED);
    });
  });

  describe('mouseRightClick', () => {
    test('should right-click at coordinates successfully', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockRightClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseRightClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('right_click');
      expect(result.data?.coordinates).toEqual({ x: 100, y: 200 });
      expect(mockRightClickAt).toHaveBeenCalledWith(100, 200);
    });

    test('should apply offset for right-click', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockRightClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseRightClick({
        x: 100,
        y: 200,
        offsetX: -10,
        offsetY: 15
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 90, y: 215 });
      expect(mockRightClickAt).toHaveBeenCalledWith(90, 215);
    });
  });

  describe('mouseMove', () => {
    test('should move to coordinates successfully', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 300, y: 400 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockMoveTo.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseMove({
        x: 300,
        y: 400
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('move');
      expect(result.data?.coordinates).toEqual({ x: 300, y: 400 });
      expect(mockMoveTo).toHaveBeenCalledWith(300, 400, { windowIndex: 1 });
    });

    test('should move to element selector', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 250, y: 350 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockMoveTo.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseMove({
        selector: '.hover-target',
        windowIndex: 2
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('move');
      expect(result.data?.element?.selector).toBe('.hover-target');
      expect(mockGetScreenCoordinates).toHaveBeenCalledWith({ selector: '.hover-target' }, 2);
      expect(mockMoveTo).toHaveBeenCalledWith(250, 350, { windowIndex: 2 });
    });

    test('should handle move failure', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockMoveTo.mockResolvedValue({
        success: false,
        code: ErrorCode.MOUSE_ACTION_FAILED,
        error: 'Move operation failed'
      });

      const result = await mouseMove({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Move operation failed');
      expect(result.code).toBe(ErrorCode.MOUSE_ACTION_FAILED);
    });
  });

  describe('mouseDrag', () => {
    test('should drag from coordinates to coordinates successfully', async () => {
      mockGetScreenCoordinates
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 300, y: 400 }
          },
          code: ErrorCode.OK,
          error: undefined
        });

      mockDragFromTo.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseDrag(
        { x: 100, y: 200 },
        { x: 300, y: 400 }
      );

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('drag');
      expect(result.data?.coordinates).toEqual({ x: 300, y: 400 });
      expect(mockDragFromTo).toHaveBeenCalledWith(100, 200, 300, 400, { windowIndex: 1 });
    });

    test('should drag from selector to selector', async () => {
      mockGetScreenCoordinates
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 150, y: 250 }
          },
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 350, y: 450 }
          },
          code: ErrorCode.OK,
          error: undefined
        });

      mockDragFromTo.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseDrag(
        { selector: '.drag-source' },
        { selector: '.drop-target' }
      );

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('drag');
      expect(result.data?.element?.selector).toBe('.drop-target');
      expect(mockGetScreenCoordinates).toHaveBeenNthCalledWith(1, { selector: '.drag-source' }, 1);
      expect(mockGetScreenCoordinates).toHaveBeenNthCalledWith(2, { selector: '.drop-target' }, 1);
    });

    test('should apply offsets to both source and target', async () => {
      mockGetScreenCoordinates
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 300, y: 400 }
          },
          code: ErrorCode.OK,
          error: undefined
        });

      mockDragFromTo.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseDrag(
        { x: 100, y: 200, offsetX: 5, offsetY: 10 },
        { x: 300, y: 400, offsetX: -5, offsetY: -10 }
      );

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 295, y: 390 });
      expect(mockDragFromTo).toHaveBeenCalledWith(105, 210, 295, 390, { windowIndex: 1 });
    });

    test('should handle invalid source options', async () => {
      const result = await mouseDrag(
        { x: 'invalid' as unknown as number, y: 200 },
        { x: 300, y: 400 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source: Invalid x coordinate');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle invalid target options', async () => {
      const result = await mouseDrag(
        { x: 100, y: 200 },
        { x: 300, y: 'invalid' as unknown as number }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target: Invalid y coordinate');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle source coordinate resolution failure', async () => {
      mockGetScreenCoordinates.mockResolvedValueOnce({
        success: false,
        error: 'Source element not found',
        code: ErrorCode.ELEMENT_NOT_FOUND
      });

      const result = await mouseDrag(
        { selector: '.missing-source' },
        { x: 300, y: 400 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source: Source element not found');
      expect(result.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    });

    test('should handle target coordinate resolution failure', async () => {
      mockGetScreenCoordinates
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Target element not found',
          code: ErrorCode.ELEMENT_NOT_FOUND
        });

      const result = await mouseDrag(
        { x: 100, y: 200 },
        { selector: '.missing-target' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target: Target element not found');
      expect(result.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    });

    test('should handle drag execution failure', async () => {
      mockGetScreenCoordinates
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            coordinates: { x: 300, y: 400 }
          },
          code: ErrorCode.OK,
          error: undefined
        });

      mockDragFromTo.mockResolvedValue({
        success: false,
        code: ErrorCode.MOUSE_ACTION_FAILED,
        error: 'Drag operation failed'
      });

      const result = await mouseDrag(
        { x: 100, y: 200 },
        { x: 300, y: 400 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Drag operation failed');
      expect(result.code).toBe(ErrorCode.MOUSE_ACTION_FAILED);
    });
  });

  describe('mouseContext', () => {
    test('should be an alias for mouseRightClick', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockRightClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseContext({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('right_click');
      expect(mockRightClickAt).toHaveBeenCalledWith(100, 200);
    });
  });

  describe('validation edge cases', () => {
    test('should handle partial coordinate specification', async () => {
      let result = await mouseClick({
        x: 100
        // Missing y coordinate
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');

      result = await mouseClick({
        y: 200
        // Missing x coordinate
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');
    });

    test('should handle null and undefined values correctly', async () => {
      const result = await mouseClick({
        x: null as unknown as number,
        y: undefined as unknown as number
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');
    });

    test('should reject invalid x coordinate', async () => {
      const result = await mouseClick({
        x: null as unknown as number,
        y: 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid x coordinate');
    });

    test('should handle empty selector', async () => {
      const result = await mouseClick({
        selector: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must provide either selector or x,y coordinates');
    });

    test('should reject non-string selector', async () => {
      const result = await mouseClick({
        selector: 123 as unknown as string
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid selector');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });
  });

  describe('coordinate and element data in results', () => {
    test('should include element data for selector-based actions', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: true
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        selector: '.test-button'
      });

      expect(result.success).toBe(true);
      expect(result.data?.element).toEqual({
        selector: '.test-button',
        visible: true,
        clickable: true
      });
    });

    test('should not include element data for coordinate-based actions', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      mockClickAt.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await mouseClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(true);
      expect(result.data?.element).toBeUndefined();
    });
  });

  describe('error propagation', () => {
    test('should propagate error codes from coordinate resolution', async () => {
      const errorCodes = [
        ErrorCode.ELEMENT_NOT_FOUND,
        ErrorCode.CHROME_NOT_RUNNING,
        ErrorCode.JAVASCRIPT_ERROR
      ];

      for (const errorCode of errorCodes) {
        mockGetScreenCoordinates.mockResolvedValue({
          success: false,
          error: 'Test error',
          code: errorCode
        });

        const result = await mouseClick({ x: 100, y: 200 });
        expect(result.success).toBe(false);
        expect(result.code).toBe(errorCode);
      }
    });

    test('should propagate error codes from UI operations', async () => {
      mockGetScreenCoordinates.mockResolvedValue({
        success: true,
        data: {
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const errorCodes = [
        ErrorCode.APPLESCRIPT_ERROR,
        ErrorCode.MOUSE_ACTION_FAILED,
        ErrorCode.CHROME_NOT_RUNNING
      ];

      for (const errorCode of errorCodes) {
        mockClickAt.mockResolvedValue({
          success: false,
          error: 'UI operation failed',
          code: errorCode
        });

        const result = await mouseClick({ x: 100, y: 200 });
        expect(result.success).toBe(false);
        expect(result.code).toBe(errorCode);
      }
    });
  });
});