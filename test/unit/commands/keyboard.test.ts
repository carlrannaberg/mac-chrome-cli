/**
 * Unit tests for KeyboardCommand
 */

import { KeyboardCommand } from '../../../src/commands/keyboard.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import { Result } from '../../../src/core/Result.js';

// Mock the keyboard library functions
jest.mock('../../../src/lib/keyboard.js', () => ({
  keyboardType: jest.fn(),
  keyboardCombo: jest.fn(),
  keyboardPress: jest.fn(),
  keyboardClear: jest.fn(),
  keyboardShortcut: jest.fn(),
  KeyboardShortcuts: {
    copy: 'cmd+c',
    paste: 'cmd+v',
    cut: 'cmd+x',
    undo: 'cmd+z',
    redo: 'cmd+shift+z',
    selectAll: 'cmd+a',
    save: 'cmd+s',
    refresh: 'cmd+r'
  }
}));

// Import the mocked functions
import {
  keyboardType,
  keyboardCombo,
  keyboardPress,
  keyboardClear,
  keyboardShortcut
} from '../../../src/lib/keyboard.js';

const mockKeyboardType = keyboardType as jest.MockedFunction<typeof keyboardType>;
const mockKeyboardCombo = keyboardCombo as jest.MockedFunction<typeof keyboardCombo>;
const mockKeyboardPress = keyboardPress as jest.MockedFunction<typeof keyboardPress>;
const mockKeyboardClear = keyboardClear as jest.MockedFunction<typeof keyboardClear>;
const mockKeyboardShortcut = keyboardShortcut as jest.MockedFunction<typeof keyboardShortcut>;

describe('KeyboardCommand', () => {
  let command: KeyboardCommand;
  
  beforeEach(() => {
    command = new KeyboardCommand();
    jest.clearAllMocks();
  });

  describe('type method', () => {
    test('should type text successfully', async () => {
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'Hello, World!',
          method: 'type',
          speed: 50,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: 'Hello, World!',
        speed: 50
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('type');
      expect(result.data?.input).toBe('Hello, World!');
      expect(result.data?.method).toBe('type');
      expect(result.data?.metadata.speed).toBe(50);
      expect(mockKeyboardType).toHaveBeenCalledWith({
        text: 'Hello, World!',
        speed: 50,
        windowIndex: 1
      });
    });

    test('should type with default speed', async () => {
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'Default speed',
          method: 'type',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: 'Default speed'
      });

      expect(result.success).toBe(true);
      expect(mockKeyboardType).toHaveBeenCalledWith({
        text: 'Default speed',
        windowIndex: 1
      });
    });

    test('should reject missing text', async () => {
      const result = await command.type({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text is required for typing operation');
      expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
      expect(result.context?.recoveryHint).toBe('user_action');
    });

    test('should reject non-string text', async () => {
      const result = await command.type({
        text: 123 as unknown as string
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid text type: number. Must be a string');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      expect(result.context?.recoveryHint).toBe('user_action');
    });

    test('should reject invalid speed values', async () => {
      let result = await command.type({
        text: 'Test',
        speed: 0
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid speed: 0. Must be between 1 and 2000 milliseconds');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);

      result = await command.type({
        text: 'Test',
        speed: 2001
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid speed: 2001. Must be between 1 and 2000 milliseconds');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle typing failure', async () => {
      mockKeyboardType.mockResolvedValue({
        success: false,
        error: 'Typing failed',
        code: ErrorCode.KEYBOARD_INPUT_FAILED
      });

      const result = await command.type({
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Typing failed');
    });
  });

  describe('combo method', () => {
    test('should execute keyboard combo successfully', async () => {
      mockKeyboardCombo.mockResolvedValue({
        success: true,
        data: {
          action: 'combo',
          input: 'cmd+s',
          method: 'combo',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.combo({
        combo: 'cmd+s'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('combo');
      expect(result.data?.input).toBe('cmd+s');
      expect(result.data?.method).toBe('combo');
      expect(mockKeyboardCombo).toHaveBeenCalledWith({
        combo: 'cmd+s',
        windowIndex: 1
      });
    });

    test('should reject missing combo', async () => {
      const result = await command.combo({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Combo is required for combination operation');
      expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
      expect(result.context?.recoveryHint).toBe('user_action');
    });

    test('should reject non-string combo', async () => {
      const result = await command.combo({
        combo: ['cmd', 's'] as unknown as string
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid combo type: object. Must be a string');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });
  });

  describe('press method', () => {
    test('should press key successfully', async () => {
      mockKeyboardPress.mockResolvedValue({
        success: true,
        data: {
          action: 'press',
          input: 'Enter',
          method: 'key',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.press({
        key: 'Enter'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('press');
      expect(result.data?.input).toBe('Enter');
      expect(result.data?.method).toBe('key');
      expect(mockKeyboardPress).toHaveBeenCalledWith({
        key: 'Enter',
        windowIndex: 1
      });
    });

    test('should reject missing key', async () => {
      const result = await command.press({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Key is required for press operation');
      expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
      expect(result.context?.recoveryHint).toBe('user_action');
    });

    test('should reject non-string key', async () => {
      const result = await command.press({
        key: 13 as unknown as string
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid key type: number. Must be a string');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });
  });

  describe('clear method', () => {
    test('should clear input field successfully', async () => {
      mockKeyboardClear.mockResolvedValue({
        success: true,
        data: {
          action: 'clear',
          input: 'clear',
          method: 'clear',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.clear();

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('clear');
      expect(result.data?.method).toBe('clear');
      expect(mockKeyboardClear).toHaveBeenCalledWith(1);
    });

    test('should handle clear operation failure', async () => {
      mockKeyboardClear.mockResolvedValue({
        success: false,
        error: 'Clear operation failed',
        code: ErrorCode.KEYBOARD_INPUT_FAILED
      });

      const result = await command.clear();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clear operation failed');
    });
  });

  describe('shortcut method', () => {
    test('should execute predefined shortcut successfully', async () => {
      mockKeyboardShortcut.mockResolvedValue({
        success: true,
        data: {
          action: 'shortcut',
          input: 'copy',
          method: 'shortcut',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.shortcut('copy');

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('shortcut');
      expect(result.data?.input).toBe('copy');
      expect(result.data?.method).toBe('shortcut');
      expect(mockKeyboardShortcut).toHaveBeenCalledWith('copy', 1);
    });

    test('should reject invalid repeat count', async () => {
      let result = await command.shortcut('copy', 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid repeat count: 0. Must be between 1 and 10');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);

      result = await command.shortcut('copy', 11);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid repeat count: 11. Must be between 1 and 10');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle empty text input', async () => {
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: '',
          method: 'type',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: ''
      });

      expect(result.success).toBe(true);
      expect(result.data?.input).toBe('');
    });

    test('should handle long text input', async () => {
      const longText = 'A'.repeat(1000);
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: longText,
          method: 'type',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: longText
      });

      expect(result.success).toBe(true);
      expect(result.data?.input).toBe(longText);
    });

    test('should handle special characters in text', async () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: specialText,
          method: 'type',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: specialText
      });

      expect(result.success).toBe(true);
      expect(result.data?.input).toBe(specialText);
    });

    test('should handle maximum speed value', async () => {
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'Max speed',
          method: 'type',
          speed: 2000,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: 'Max speed',
        speed: 2000
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.speed).toBe(2000);
    });

    test('should handle minimum speed value', async () => {
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'Min speed',
          method: 'type',
          speed: 1,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({
        text: 'Min speed',
        speed: 1
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.speed).toBe(1);
    });
  });

  describe('metadata generation', () => {
    test('should include timestamp in metadata', async () => {
      mockKeyboardType.mockResolvedValue({
        success: true,
        data: {
          action: 'type',
          input: 'test',
          method: 'type',
          speed: undefined,
          repeat: 1
        },
        code: ErrorCode.OK
      });

      const result = await command.type({ text: 'test' });
      
      expect(result.success).toBe(true);
      expect(result.data?.metadata.timestamp).toBeDefined();
      expect(new Date(result.data!.metadata.timestamp)).toBeInstanceOf(Date);
    });
  });
});