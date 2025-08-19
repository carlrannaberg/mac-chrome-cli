/**
 * Unit tests for MouseCommand
 */

import { MouseCommand } from '../../../src/commands/mouse.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import { Result } from '../../../src/core/Result.js';

// Mock the mouse library functions
jest.mock('../../../src/lib/mouse.js', () => ({
  mouseClick: jest.fn(),
  mouseMove: jest.fn(),
  mouseDrag: jest.fn(),
  mouseDoubleClick: jest.fn(),
  mouseRightClick: jest.fn()
}));

// Mock the coords library functions
jest.mock('../../../src/lib/coords.js', () => ({
  validateElementVisibility: jest.fn()
}));

// Mock the scroll command
jest.mock('../../../src/commands/scroll.js', () => ({
  scrollToElement: jest.fn()
}));

// Import the mocked functions
import {
  mouseClick,
  mouseMove,
  mouseDrag,
  mouseDoubleClick,
  mouseRightClick
} from '../../../src/lib/mouse.js';

import { validateElementVisibility } from '../../../src/lib/coords.js';
import { scrollToElement } from '../../../src/commands/scroll.js';

const mockMouseClick = mouseClick as jest.MockedFunction<typeof mouseClick>;
const mockMouseMove = mouseMove as jest.MockedFunction<typeof mouseMove>;
const mockMouseDrag = mouseDrag as jest.MockedFunction<typeof mouseDrag>;
const mockMouseDoubleClick = mouseDoubleClick as jest.MockedFunction<typeof mouseDoubleClick>;
const mockMouseRightClick = mouseRightClick as jest.MockedFunction<typeof mouseRightClick>;
const mockValidateElementVisibility = validateElementVisibility as jest.MockedFunction<typeof validateElementVisibility>;
const mockScrollToElement = scrollToElement as jest.MockedFunction<typeof scrollToElement>;

describe('MouseCommand', () => {
  let command: MouseCommand;
  
  beforeEach(() => {
    command = new MouseCommand();
    jest.clearAllMocks();
  });

  describe('click method', () => {
    describe('successful operations', () => {
      test('should click element by selector successfully', async () => {
        // Setup mocks
        mockScrollToElement.mockResolvedValue({
          success: true,
          data: undefined,
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockValidateElementVisibility.mockResolvedValue({
          success: true,
          data: {
            visible: true,
            clickable: true,
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockMouseClick.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 },
            element: {
              selector: '#test-button',
              visible: true,
              clickable: true
            }
          },
          code: ErrorCode.OK
        });

        const result = await command.click({
          selector: '#test-button'
        });

        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('click');
        expect(result.data?.coordinates).toEqual({ x: 100, y: 200 });
        expect(mockScrollToElement).toHaveBeenCalledWith('#test-button', false, 1, 1, 5000);
        expect(mockValidateElementVisibility).toHaveBeenCalledWith('#test-button', 1);
        expect(mockMouseClick).toHaveBeenCalledWith({
          selector: '#test-button'
        });
      });

      test('should click at coordinates successfully', async () => {
        mockMouseClick.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 150, y: 250 }
          },
          code: ErrorCode.OK
        });

        const result = await command.click({
          x: 150,
          y: 250
        });

        expect(result.success).toBe(true);
        expect(result.data?.coordinates).toEqual({ x: 150, y: 250 });
        expect(mockScrollToElement).not.toHaveBeenCalled();
        expect(mockValidateElementVisibility).not.toHaveBeenCalled();
        expect(mockMouseClick).toHaveBeenCalledWith({
          x: 150,
          y: 250
        });
      });

      test('should handle different button types', async () => {
        mockMouseClick.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK
        });

        const result = await command.click({
          x: 100,
          y: 200,
          button: 'right'
        });

        expect(result.success).toBe(true);
        expect(mockMouseClick).toHaveBeenCalledWith({
          x: 100,
          y: 200,
          button: 'right'
        });
      });

      test('should handle offset coordinates', async () => {
        mockScrollToElement.mockResolvedValue({
          success: true,
          data: undefined,
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockValidateElementVisibility.mockResolvedValue({
          success: true,
          data: {
            visible: true,
            clickable: true,
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockMouseClick.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 110, y: 190 }
          },
          code: ErrorCode.OK
        });

        const result = await command.click({
          selector: '#test-element',
          offsetX: 10,
          offsetY: -10
        });

        expect(result.success).toBe(true);
        expect(mockMouseClick).toHaveBeenCalledWith({
          selector: '#test-element',
          offsetX: 10,
          offsetY: -10
        });
      });
    });

    describe('input validation', () => {
      test('should reject missing target', async () => {
        const result = await command.click({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Must provide either selector or x,y coordinates');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject both selector and coordinates', async () => {
        const result = await command.click({
          selector: '#test',
          x: 100,
          y: 200
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot specify both selector and coordinates');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid selector', async () => {
        const result = await command.click({
          selector: ''
        });

        expect(result.success).toBe(false);
        expect(result.code).toBe(ErrorCode.INVALID_SELECTOR);
      });

      test('should reject invalid coordinates', async () => {
        let result = await command.click({
          x: -1,
          y: 100
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('X coordinate must be a non-negative finite number');
        expect(result.code).toBe(ErrorCode.INVALID_COORDINATES);

        result = await command.click({
          x: 100,
          y: NaN
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Y coordinate must be a non-negative finite number');
        expect(result.code).toBe(ErrorCode.INVALID_COORDINATES);
      });

      test('should reject invalid button type', async () => {
        const result = await command.click({
          x: 100,
          y: 200,
          button: 'invalid' as any
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid mouse button: invalid');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid offsets', async () => {
        let result = await command.click({
          selector: '#test',
          offsetX: Infinity
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('X offset must be a finite number');
        expect(result.code).toBe(ErrorCode.INVALID_COORDINATES);

        result = await command.click({
          selector: '#test',
          offsetY: NaN
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Y offset must be a finite number');
        expect(result.code).toBe(ErrorCode.INVALID_COORDINATES);
      });

      test('should reject invalid window index', async () => {
        const result = await command.click({
          selector: '#test',
          windowIndex: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Window index must be a positive integer');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });
    });

    describe('element visibility validation', () => {
      test('should fail when element visibility validation fails', async () => {
        mockScrollToElement.mockResolvedValue({
          success: true,
          data: undefined,
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockValidateElementVisibility.mockResolvedValue({
          success: false,
          error: 'Element not found',
          code: ErrorCode.TARGET_NOT_FOUND,
          timestamp: new Date().toISOString()
        });

        const result = await command.click({
          selector: '#missing-element'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element validation failed: Element not found');
        expect(result.code).toBe(ErrorCode.JAVASCRIPT_ERROR);
        expect(result.context?.recoveryHint).toBe('check_target');
      });

      test('should fail when element is not visible', async () => {
        mockScrollToElement.mockResolvedValue({
          success: true,
          data: undefined,
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockValidateElementVisibility.mockResolvedValue({
          success: true,
          data: {
            visible: false,
            clickable: true,
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.click({
          selector: '#hidden-element'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element "#hidden-element" is not visible');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_VISIBLE);
        expect(result.context?.recoveryHint).toBe('retry');
      });

      test('should fail when element is not clickable', async () => {
        mockScrollToElement.mockResolvedValue({
          success: true,
          data: undefined,
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockValidateElementVisibility.mockResolvedValue({
          success: true,
          data: {
            visible: true,
            clickable: false,
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.click({
          selector: '#disabled-element'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element "#disabled-element" is not clickable');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_INTERACTABLE);
        expect(result.context?.recoveryHint).toBe('retry_with_delay');
      });
    });

    describe('mouse operation failures', () => {
      test('should handle mouse click failure', async () => {
        mockMouseClick.mockResolvedValue({
          success: false,
          error: 'Click failed',
          code: ErrorCode.MOUSE_CLICK_FAILED
        });

        const result = await command.click({
          x: 100,
          y: 200
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Click failed');
      });

      test('should handle timeout errors with appropriate recovery hint', async () => {
        mockMouseClick.mockResolvedValue({
          success: false,
          error: 'Operation timed out',
          code: ErrorCode.TIMEOUT
        });

        const result = await command.click({
          x: 100,
          y: 200
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Operation timed out');
      });
    });
  });

  describe('move method', () => {
    test('should move mouse to element successfully', async () => {
      mockScrollToElement.mockResolvedValue({
        success: true,
        data: undefined,
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockMouseMove.mockResolvedValue({
        success: true,
        data: {
          action: 'move',
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK
      });

      const result = await command.move({
        selector: '#hover-target'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('move');
      expect(mockScrollToElement).toHaveBeenCalledWith('#hover-target', false, 1, 1, 5000);
      expect(mockMouseMove).toHaveBeenCalledWith({
        selector: '#hover-target'
      });
    });

    test('should move mouse to coordinates successfully', async () => {
      mockMouseMove.mockResolvedValue({
        success: true,
        data: {
          action: 'move',
          coordinates: { x: 300, y: 400 }
        },
        code: ErrorCode.OK
      });

      const result = await command.move({
        x: 300,
        y: 400
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 300, y: 400 });
      expect(mockScrollToElement).not.toHaveBeenCalled();
      expect(mockMouseMove).toHaveBeenCalledWith({
        x: 300,
        y: 400
      });
    });

    test('should handle move operation failure', async () => {
      mockMouseMove.mockResolvedValue({
        success: false,
        error: 'Move operation failed',
        code: ErrorCode.UI_AUTOMATION_FAILED
      });

      const result = await command.move({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Move operation failed');
    });
  });

  describe('drag method', () => {
    test('should drag from element to element successfully', async () => {
      mockMouseDrag.mockResolvedValue({
        success: true,
        data: {
          action: 'drag',
          coordinates: { x: 200, y: 300 }
        },
        code: ErrorCode.OK
      });

      const result = await command.drag(
        { selector: '#drag-source' },
        { selector: '#drag-target' }
      );

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('drag');
      expect(mockMouseDrag).toHaveBeenCalledWith(
        { selector: '#drag-source' },
        { selector: '#drag-target' }
      );
    });

    test('should drag from coordinates to coordinates successfully', async () => {
      mockMouseDrag.mockResolvedValue({
        success: true,
        data: {
          action: 'drag',
          coordinates: { x: 400, y: 500 }
        },
        code: ErrorCode.OK
      });

      const result = await command.drag(
        { x: 100, y: 200 },
        { x: 400, y: 500 }
      );

      expect(result.success).toBe(true);
      expect(mockMouseDrag).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        { x: 400, y: 500 }
      );
    });

    test('should fail with invalid from options', async () => {
      const result = await command.drag(
        {}, // Invalid: no selector or coordinates
        { selector: '#drag-target' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Must provide either selector or x,y coordinates');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should fail with invalid to options', async () => {
      const result = await command.drag(
        { selector: '#drag-source' },
        { x: -1, y: 200 } // Invalid coordinates
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('X coordinate must be a non-negative finite number');
      expect(result.code).toBe(ErrorCode.INVALID_COORDINATES);
    });

    test('should handle drag operation failure', async () => {
      mockMouseDrag.mockResolvedValue({
        success: false,
        error: 'Drag operation failed',
        code: ErrorCode.UI_AUTOMATION_FAILED
      });

      const result = await command.drag(
        { x: 100, y: 200 },
        { x: 300, y: 400 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Drag operation failed');
    });
  });

  describe('doubleClick method', () => {
    test('should double-click element successfully', async () => {
      mockScrollToElement.mockResolvedValue({
        success: true,
        data: undefined,
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: true,
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockMouseDoubleClick.mockResolvedValue({
        success: true,
        data: {
          action: 'double-click',
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK
      });

      const result = await command.doubleClick({
        selector: '#double-click-target'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('double-click');
      expect(mockScrollToElement).toHaveBeenCalledWith('#double-click-target', false, 1, 1, 5000);
      expect(mockValidateElementVisibility).toHaveBeenCalledWith('#double-click-target', 1);
      expect(mockMouseDoubleClick).toHaveBeenCalledWith({
        selector: '#double-click-target'
      });
    });

    test('should double-click at coordinates successfully', async () => {
      mockMouseDoubleClick.mockResolvedValue({
        success: true,
        data: {
          action: 'double-click',
          coordinates: { x: 250, y: 350 }
        },
        code: ErrorCode.OK
      });

      const result = await command.doubleClick({
        x: 250,
        y: 350
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 250, y: 350 });
      expect(mockMouseDoubleClick).toHaveBeenCalledWith({
        x: 250,
        y: 350
      });
    });

    test('should handle double-click failure', async () => {
      mockMouseDoubleClick.mockResolvedValue({
        success: false,
        error: 'Double-click failed',
        code: ErrorCode.MOUSE_CLICK_FAILED
      });

      const result = await command.doubleClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Double-click failed');
    });
  });

  describe('rightClick method', () => {
    test('should right-click element successfully', async () => {
      mockScrollToElement.mockResolvedValue({
        success: true,
        data: undefined,
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: true,
          coordinates: { x: 150, y: 250 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockMouseRightClick.mockResolvedValue({
        success: true,
        data: {
          action: 'right-click',
          coordinates: { x: 150, y: 250 }
        },
        code: ErrorCode.OK
      });

      const result = await command.rightClick({
        selector: '#context-menu-target'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('right-click');
      expect(mockScrollToElement).toHaveBeenCalledWith('#context-menu-target', false, 1, 1, 5000);
      expect(mockValidateElementVisibility).toHaveBeenCalledWith('#context-menu-target', 1);
      expect(mockMouseRightClick).toHaveBeenCalledWith({
        selector: '#context-menu-target'
      });
    });

    test('should right-click at coordinates successfully', async () => {
      mockMouseRightClick.mockResolvedValue({
        success: true,
        data: {
          action: 'right-click',
          coordinates: { x: 400, y: 300 }
        },
        code: ErrorCode.OK
      });

      const result = await command.rightClick({
        x: 400,
        y: 300
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 400, y: 300 });
      expect(mockMouseRightClick).toHaveBeenCalledWith({
        x: 400,
        y: 300
      });
    });

    test('should handle right-click failure', async () => {
      mockMouseRightClick.mockResolvedValue({
        success: false,
        error: 'Right-click failed',
        code: ErrorCode.MOUSE_CLICK_FAILED
      });

      const result = await command.rightClick({
        x: 100,
        y: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Right-click failed');
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle zero coordinates', async () => {
      mockMouseClick.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 0, y: 0 }
        },
        code: ErrorCode.OK
      });

      const result = await command.click({
        x: 0,
        y: 0
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 0, y: 0 });
    });

    test('should handle large coordinates', async () => {
      mockMouseClick.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 999999, y: 999999 }
        },
        code: ErrorCode.OK
      });

      const result = await command.click({
        x: 999999,
        y: 999999
      });

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 999999, y: 999999 });
    });

    test('should handle complex selectors', async () => {
      const complexSelector = 'div.container > ul.list li:nth-child(2) a[data-test="link"]';
      
      mockScrollToElement.mockResolvedValue({
        success: true,
        data: undefined,
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: true,
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockMouseClick.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 100, y: 200 },
          element: {
            selector: complexSelector,
            visible: true,
            clickable: true
          }
        },
        code: ErrorCode.OK
      });

      const result = await command.click({
        selector: complexSelector
      });

      expect(result.success).toBe(true);
      expect(mockMouseClick).toHaveBeenCalledWith({
        selector: complexSelector
      });
    });
  });
});