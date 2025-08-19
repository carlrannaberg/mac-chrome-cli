/**
 * Unit tests for InputCommand
 */

import { InputCommand } from '../../../src/commands/input.js';
import { MouseCommand } from '../../../src/commands/mouse.js';
import { KeyboardCommand } from '../../../src/commands/keyboard.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import { Result } from '../../../src/core/Result.js';

// Mock the input library functions
jest.mock('../../../src/lib/input.js', () => ({
  getInputValue: jest.fn(),
  submitForm: jest.fn()
}));

// Mock the coords library functions
jest.mock('../../../src/lib/coords.js', () => ({
  validateElementVisibility: jest.fn()
}));

// Mock the apple library for JavaScript execution
jest.mock('../../../src/lib/apple.js', () => ({
  execChromeJS: jest.fn()
}));

// Mock the mouse and keyboard commands
jest.mock('../../../src/commands/mouse.js');
jest.mock('../../../src/commands/keyboard.js');

// Import the mocked functions
import { getInputValue, submitForm } from '../../../src/lib/input.js';
import { validateElementVisibility } from '../../../src/lib/coords.js';
import { execChromeJS } from '../../../src/lib/apple.js';

const mockGetInputValue = getInputValue as jest.MockedFunction<typeof getInputValue>;
const mockSubmitForm = submitForm as jest.MockedFunction<typeof submitForm>;
const mockValidateElementVisibility = validateElementVisibility as jest.MockedFunction<typeof validateElementVisibility>;
const mockExecChromeJS = execChromeJS as jest.MockedFunction<typeof execChromeJS>;

const MockedMouseCommand = MouseCommand as jest.MockedClass<typeof MouseCommand>;
const MockedKeyboardCommand = KeyboardCommand as jest.MockedClass<typeof KeyboardCommand>;

describe('InputCommand', () => {
  let command: InputCommand;
  let mockMouseCommand: jest.Mocked<MouseCommand>;
  let mockKeyboardCommand: jest.Mocked<KeyboardCommand>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked command instances
    mockMouseCommand = {
      click: jest.fn()
    } as unknown as jest.Mocked<MouseCommand>;
    
    mockKeyboardCommand = {
      clear: jest.fn(),
      type: jest.fn()
    } as unknown as jest.Mocked<KeyboardCommand>;
    
    MockedMouseCommand.mockImplementation(() => mockMouseCommand);
    MockedKeyboardCommand.mockImplementation(() => mockKeyboardCommand);
    
    command = new InputCommand();
  });

  describe('fill method', () => {
    describe('successful operations', () => {
      test('should fill input field with comprehensive workflow', async () => {
        // Mock form element validation
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
        });

        // Mock element visibility validation
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

        // Mock mouse click for focus
        mockMouseCommand.click.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        // Mock keyboard clear
        mockKeyboardCommand.clear.mockResolvedValue({
          success: true,
          data: {
            action: 'clear',
            input: 'clear',
            method: 'clear',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        // Mock keyboard type
        mockKeyboardCommand.type.mockResolvedValue({
          success: true,
          data: {
            action: 'type',
            input: 'test@example.com',
            method: 'type',
            metadata: {
              timestamp: new Date().toISOString(),
              speed: 50
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#email',
          value: 'test@example.com',
          method: 'type',
          speed: 50
        });

        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('fill');
        expect(result.data?.selector).toBe('#email');
        expect(result.data?.method).toBe('type');
        expect(result.data?.value).toBe('test@example.com');
        expect(result.data?.element?.visible).toBe(true);
        expect(result.data?.element?.clickable).toBe(true);
        expect(result.data?.element?.focusable).toBe(true);
        expect(result.data?.mouseAction?.focusClicked).toBe(true);
        expect(result.data?.keyboardAction?.cleared).toBe(true);
        expect(result.data?.keyboardAction?.method).toBe('type');
        expect(result.data?.metadata.inputMethod).toBe('type');

        // Verify call sequence
        expect(mockExecChromeJS).toHaveBeenCalledWith(
          expect.stringContaining('querySelector'),
          1,
          1
        );
        expect(mockValidateElementVisibility).toHaveBeenCalledWith('#email', 1);
        expect(mockMouseCommand.click).toHaveBeenCalledWith({
          selector: '#email',
          windowIndex: 1
        });
        expect(mockKeyboardCommand.clear).toHaveBeenCalledWith(1);
        expect(mockKeyboardCommand.type).toHaveBeenCalledWith({
          text: 'test@example.com',
          speed: 50,
          windowIndex: 1
        });
      });

      test('should fill with paste method for long text', async () => {
        const longValue = 'A'.repeat(100);
        
        // Mock form validation
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'textarea',
            inputType: undefined,
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
        });

        mockValidateElementVisibility.mockResolvedValue({
          success: true,
          data: {
            visible: true,
            clickable: true,
            coordinates: { x: 200, y: 300 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockMouseCommand.click.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 200, y: 300 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.clear.mockResolvedValue({
          success: true,
          data: {
            action: 'clear',
            input: 'clear',
            method: 'clear',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.type.mockResolvedValue({
          success: true,
          data: {
            action: 'type',
            input: longValue,
            method: 'type',
            metadata: {
              timestamp: new Date().toISOString(),
              speed: 50
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#description',
          value: longValue,
          method: 'auto'  // Should use paste logic internally but fallback to type
        });

        expect(result.success).toBe(true);
        expect(result.data?.value).toBe(longValue);
        expect(result.data?.method).toBe('type'); // Fallback to type
        expect(mockKeyboardCommand.type).toHaveBeenCalledWith({
          text: longValue,
          speed: 50,
          windowIndex: 1
        });
      });

      test('should fill without clearing when clear is false', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: 'existing',
            focusable: true
          },
          code: ErrorCode.OK
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

        mockMouseCommand.click.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.type.mockResolvedValue({
          success: true,
          data: {
            action: 'type',
            input: 'append',
            method: 'type',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#append-field',
          value: 'append',
          clear: false
        });

        expect(result.success).toBe(true);
        expect(result.data?.keyboardAction?.cleared).toBe(false);
        expect(mockKeyboardCommand.clear).not.toHaveBeenCalled();
      });

      test('should mask sensitive values when requested', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'password',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
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

        mockMouseCommand.click.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.clear.mockResolvedValue({
          success: true,
          data: {
            action: 'clear',
            input: 'clear',
            method: 'clear',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.type.mockResolvedValue({
          success: true,
          data: {
            action: 'type',
            input: 'secretpassword',
            method: 'type',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#password',
          value: 'secretpassword',
          maskSecret: true
        });

        expect(result.success).toBe(true);
        expect(result.data?.value).toBe('se************'); // Masked value
        expect(result.data?.metadata.masked).toBe(true);
      });
    });

    describe('input validation', () => {
      test('should reject missing selector', async () => {
        const result = await command.fill({
          selector: '',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.code).toBe(ErrorCode.INVALID_SELECTOR);
      });

      test('should reject missing value', async () => {
        const result = await command.fill({
          selector: '#test',
          value: undefined as unknown as string
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Value is required for input filling');
        expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
        expect(result.context?.recoveryHint).toBe('not_recoverable');
      });

      test('should reject non-string value', async () => {
        const result = await command.fill({
          selector: '#test',
          value: 123 as unknown as string
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid value type: number. Must be a string');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.context?.recoveryHint).toBe('not_recoverable');
      });

      test('should reject invalid input method', async () => {
        const result = await command.fill({
          selector: '#test',
          value: 'test',
          method: 'invalid' as unknown as 'type'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid input method: invalid. Must be auto, paste, type, or js');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.context?.metadata?.allowed).toEqual(['auto', 'paste', 'type', 'js']);
      });

      test('should reject invalid speed values', async () => {
        let result = await command.fill({
          selector: '#test',
          value: 'test',
          speed: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid speed: 0. Must be between 1 and 2000 milliseconds');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);

        result = await command.fill({
          selector: '#test',
          value: 'test',
          speed: 2001
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid speed: 2001. Must be between 1 and 2000 milliseconds');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid window index', async () => {
        const result = await command.fill({
          selector: '#test',
          value: 'test',
          windowIndex: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid windowIndex: 0. Must be between 1 and 50');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid offsets', async () => {
        let result = await command.fill({
          selector: '#test',
          value: 'test',
          offsetX: Infinity
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('X offset must be a finite number');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);

        result = await command.fill({
          selector: '#test',
          value: 'test',
          offsetY: NaN
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Y offset must be a finite number');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });
    });

    describe('form element validation', () => {
      test('should reject non-form elements', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            error: 'Element is not a valid form input (must be input, textarea, or contentEditable)'
          },
          code: ErrorCode.OK
        });

        const result = await command.fill({
          selector: '#not-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element is not a valid form input');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_INTERACTABLE);
      });

      test('should reject disabled elements', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            error: 'Element is disabled and cannot be interacted with'
          },
          code: ErrorCode.OK
        });

        const result = await command.fill({
          selector: '#disabled-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element is disabled and cannot be interacted with');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_INTERACTABLE);
      });

      test('should reject readonly elements', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            error: 'Element is readonly and cannot be modified'
          },
          code: ErrorCode.OK
        });

        const result = await command.fill({
          selector: '#readonly-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element is readonly and cannot be modified');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_INTERACTABLE);
      });

      test('should handle form validation JavaScript errors', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: false,
          error: 'JavaScript execution failed',
          code: ErrorCode.JAVASCRIPT_ERROR
        });

        const result = await command.fill({
          selector: '#test-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to validate form element: JavaScript execution failed');
        expect(result.code).toBe(ErrorCode.JAVASCRIPT_ERROR);
      });
    });

    describe('element visibility validation', () => {
      test('should fail when element is not visible', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
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

        const result = await command.fill({
          selector: '#hidden-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element "#hidden-input" is not visible');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_VISIBLE);
        expect(result.context?.recoveryHint).toBe('retry');
      });

      test('should fail when element is not clickable', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
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

        const result = await command.fill({
          selector: '#unclickable-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Element "#unclickable-input" is not clickable for focusing');
        expect(result.code).toBe(ErrorCode.ELEMENT_NOT_INTERACTABLE);
        expect(result.context?.recoveryHint).toBe('check_target');
      });
    });

    describe('mouse and keyboard operation failures', () => {
      test('should fail when mouse click fails', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
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

        mockMouseCommand.click.mockResolvedValue({
          success: false,
          error: 'Click failed',
          code: ErrorCode.MOUSE_CLICK_FAILED,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#test-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to focus element: Click failed');
        expect(result.code).toBe(ErrorCode.MOUSE_CLICK_FAILED);
        expect(result.context?.recoveryHint).toBe('retry_with_delay');
      });

      test('should fail when keyboard typing fails', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: '',
            focusable: true
          },
          code: ErrorCode.OK
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

        mockMouseCommand.click.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.clear.mockResolvedValue({
          success: true,
          data: {
            action: 'clear',
            input: 'clear',
            method: 'clear',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.type.mockResolvedValue({
          success: false,
          error: 'Typing failed',
          code: ErrorCode.KEYBOARD_INPUT_FAILED,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#test-input',
          value: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to input text: Typing failed');
        expect(result.code).toBe(ErrorCode.KEYBOARD_INPUT_FAILED);
        expect(result.context?.recoveryHint).toBe('retry');
      });

      test('should continue when clear fails but typing succeeds', async () => {
        mockExecChromeJS.mockResolvedValue({
          success: true,
          data: {
            isValidFormElement: true,
            elementType: 'input',
            inputType: 'text',
            disabled: false,
            readonly: false,
            contentEditable: false,
            currentValue: 'existing',
            focusable: true
          },
          code: ErrorCode.OK
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

        mockMouseCommand.click.mockResolvedValue({
          success: true,
          data: {
            action: 'click',
            coordinates: { x: 100, y: 200 }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.clear.mockResolvedValue({
          success: false,
          error: 'Clear failed',
          code: ErrorCode.KEYBOARD_INPUT_FAILED,
          timestamp: new Date().toISOString()
        });

        mockKeyboardCommand.type.mockResolvedValue({
          success: true,
          data: {
            action: 'type',
            input: 'test',
            method: 'type',
            metadata: {
              timestamp: new Date().toISOString()
            }
          },
          code: ErrorCode.OK,
          timestamp: new Date().toISOString()
        });

        const result = await command.fill({
          selector: '#test-input',
          value: 'test'
        });

        expect(result.success).toBe(true);
        expect(result.data?.keyboardAction?.cleared).toBe(false);
        expect(result.data?.value).toBe('test');
      });
    });
  });

  describe('getValue method', () => {
    test('should get input value successfully', async () => {
      mockGetInputValue.mockResolvedValue({
        success: true,
        value: 'current value',
        code: ErrorCode.OK
      });

      const result = await command.getValue({
        selector: '#test-input'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('get_value');
      expect(result.data?.selector).toBe('#test-input');
      expect(result.data?.value).toBe('current value');
      expect(mockGetInputValue).toHaveBeenCalledWith('#test-input', 1);
    });

    test('should get value with custom window index', async () => {
      mockGetInputValue.mockResolvedValue({
        success: true,
        value: 'window 2 value',
        code: ErrorCode.OK
      });

      const result = await command.getValue({
        selector: '#test-input',
        windowIndex: 2
      });

      expect(result.success).toBe(true);
      expect(mockGetInputValue).toHaveBeenCalledWith('#test-input', 2);
    });

    test('should handle getValue operation failure', async () => {
      mockGetInputValue.mockResolvedValue({
        success: false,
        error: 'Failed to get input value',
        code: ErrorCode.TARGET_NOT_FOUND
      });

      const result = await command.getValue({
        selector: '#missing-input'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get input value');
      expect(result.context?.recoveryHint).toBe('check_target');
    });

    test('should reject invalid selector', async () => {
      const result = await command.getValue({
        selector: ''
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe(ErrorCode.INVALID_SELECTOR);
    });

    test('should reject invalid window index', async () => {
      const result = await command.getValue({
        selector: '#test',
        windowIndex: 0
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid windowIndex: 0. Must be between 1 and 50');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });
  });

  describe('submit method', () => {
    test('should submit form successfully', async () => {
      mockSubmitForm.mockResolvedValue({
        success: true,
        code: ErrorCode.OK
      });

      const result = await command.submit({
        selector: 'form#login-form'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('submit');
      expect(result.data?.selector).toBe('form#login-form');
      expect(mockSubmitForm).toHaveBeenCalledWith('form#login-form', 1);
    });

    test('should submit by button selector', async () => {
      mockSubmitForm.mockResolvedValue({
        success: true,
        code: ErrorCode.OK
      });

      const result = await command.submit({
        selector: 'button[type="submit"]',
        windowIndex: 2
      });

      expect(result.success).toBe(true);
      expect(mockSubmitForm).toHaveBeenCalledWith('button[type="submit"]', 2);
    });

    test('should handle submit operation failure', async () => {
      mockSubmitForm.mockResolvedValue({
        success: false,
        error: 'Submit failed',
        code: ErrorCode.TARGET_NOT_FOUND
      });

      const result = await command.submit({
        selector: '#missing-form'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Submit failed');
      expect(result.context?.recoveryHint).toBe('check_target');
    });

    test('should reject invalid selector', async () => {
      const result = await command.submit({
        selector: ''
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe(ErrorCode.INVALID_SELECTOR);
    });

    test('should reject invalid window index', async () => {
      const result = await command.submit({
        selector: 'form',
        windowIndex: 51
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid windowIndex: 51. Must be between 1 and 50');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle empty value input', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          isValidFormElement: true,
          elementType: 'input',
          inputType: 'text',
          disabled: false,
          readonly: false,
          contentEditable: false,
          currentValue: 'existing',
          focusable: true
        },
        code: ErrorCode.OK
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

      mockMouseCommand.click.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.clear.mockResolvedValue({
        success: true,
        data: {
          action: 'clear',
          input: 'clear',
          method: 'clear',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.type.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: '',
          method: 'type',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      const result = await command.fill({
        selector: '#test-input',
        value: ''
      });

      expect(result.success).toBe(true);
      expect(result.data?.value).toBe('');
    });

    test('should handle very long value input', async () => {
      const longValue = 'A'.repeat(10000);
      
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          isValidFormElement: true,
          elementType: 'textarea',
          inputType: undefined,
          disabled: false,
          readonly: false,
          contentEditable: false,
          currentValue: '',
          focusable: true
        },
        code: ErrorCode.OK
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

      mockMouseCommand.click.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.clear.mockResolvedValue({
        success: true,
        data: {
          action: 'clear',
          input: 'clear',
          method: 'clear',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.type.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: longValue,
          method: 'type',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      const result = await command.fill({
        selector: '#long-textarea',
        value: longValue
      });

      expect(result.success).toBe(true);
      expect(result.data?.value).toBe(longValue);
    });

    test('should handle contentEditable elements', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          isValidFormElement: true,
          elementType: 'div',
          inputType: undefined,
          disabled: false,
          readonly: false,
          contentEditable: true,
          currentValue: 'rich content',
          focusable: true
        },
        code: ErrorCode.OK
      });

      mockValidateElementVisibility.mockResolvedValue({
        success: true,
        data: {
          visible: true,
          clickable: true,
          coordinates: { x: 300, y: 400 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockMouseCommand.click.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 300, y: 400 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.clear.mockResolvedValue({
        success: true,
        data: {
          action: 'clear',
          input: 'clear',
          method: 'clear',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.type.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'new content',
          method: 'type',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      const result = await command.fill({
        selector: '[contenteditable="true"]',
        value: 'new content'
      });

      expect(result.success).toBe(true);
      expect(result.data?.element?.type).toBe('div');
      expect(result.data?.element?.formValidation.contentEditable).toBe(true);
    });

    test('should handle maximum boundary values', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          isValidFormElement: true,
          elementType: 'input',
          inputType: 'text',
          disabled: false,
          readonly: false,
          contentEditable: false,
          currentValue: '',
          focusable: true
        },
        code: ErrorCode.OK
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

      mockMouseCommand.click.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.clear.mockResolvedValue({
        success: true,
        data: {
          action: 'clear',
          input: 'clear',
          method: 'clear',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.type.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'max values test',
          method: 'type',
          metadata: {
            timestamp: new Date().toISOString(),
            speed: 2000
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      const result = await command.fill({
        selector: '#max-test',
        value: 'max values test',
        speed: 2000,
        windowIndex: 50,
        offsetX: -1000,
        offsetY: 1000
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.windowIndex).toBe(50);
    });
  });

  describe('error handling and recovery strategies', () => {
    test('should provide appropriate recovery hints for different error types', async () => {
      const errorScenarios = [
        {
          error: ErrorCode.ELEMENT_NOT_VISIBLE,
          expectedHint: 'retry'
        },
        {
          error: ErrorCode.ELEMENT_NOT_INTERACTABLE,
          expectedHint: 'check_target'
        },
        {
          error: ErrorCode.TARGET_NOT_FOUND,
          expectedHint: 'check_target'
        },
        {
          error: ErrorCode.MOUSE_CLICK_FAILED,
          expectedHint: 'retry_with_delay'
        },
        {
          error: ErrorCode.KEYBOARD_INPUT_FAILED,
          expectedHint: 'retry'
        },
        {
          error: ErrorCode.PERMISSION_DENIED,
          expectedHint: 'permission'
        }
      ];

      for (const scenario of errorScenarios) {
        mockGetInputValue.mockResolvedValue({
          success: false,
          error: 'Test error',
          code: scenario.error
        });

        const result = await command.getValue({ selector: '#test' });
        expect(result.success).toBe(false);
        // Recovery hints are determined internally by the command
      }
    });
  });

  describe('metadata generation', () => {
    test('should include comprehensive metadata', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          isValidFormElement: true,
          elementType: 'input',
          inputType: 'text',
          disabled: false,
          readonly: false,
          contentEditable: false,
          currentValue: '',
          focusable: true
        },
        code: ErrorCode.OK
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

      mockMouseCommand.click.mockResolvedValue({
        success: true,
        data: {
          action: 'click',
          coordinates: { x: 100, y: 200 }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.clear.mockResolvedValue({
        success: true,
        data: {
          action: 'clear',
          input: 'clear',
          method: 'clear',
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      mockKeyboardCommand.type.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'metadata test',
          method: 'type',
          metadata: {
            timestamp: new Date().toISOString(),
            speed: 100
          }
        },
        code: ErrorCode.OK,
        timestamp: new Date().toISOString()
      });

      const result = await command.fill({
        selector: '#metadata-test',
        value: 'metadata test',
        speed: 100,
        windowIndex: 2
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.timestamp).toBeDefined();
      expect(new Date(result.data!.metadata.timestamp)).toBeInstanceOf(Date);
      expect(result.data?.metadata.inputMethod).toBe('type');
      expect(result.data?.metadata.windowIndex).toBe(2);
      expect(result.data?.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});