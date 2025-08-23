/**
 * Unit tests for keyboard library
 */

import {
  keyboardType,
  keyboardCombo,
  keyboardPress,
  keyboardClear,
  keyboardShortcut,
  KeyboardShortcuts,
  type KeyInputOptions,
  type KeyboardResult,
  type KeyboardActionData
} from '../../../src/lib/keyboard.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import * as ui from '../../../src/lib/ui.js';

// Mock the ui library
jest.mock('../../../src/lib/ui.js', () => ({
  typeText: jest.fn(),
  sendKeys: jest.fn(),
  pressKey: jest.fn(),
  clearField: jest.fn()
}));

const mockTypeText = ui.typeText as jest.MockedFunction<typeof ui.typeText>;
const mockSendKeys = ui.sendKeys as jest.MockedFunction<typeof ui.sendKeys>;
const mockPressKey = ui.pressKey as jest.MockedFunction<typeof ui.pressKey>;
const mockClearField = ui.clearField as jest.MockedFunction<typeof ui.clearField>;

describe('Keyboard Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('keyboardType', () => {
    test('should type text successfully', async () => {
      mockTypeText.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardType({
        text: 'Hello World',
        speed: 100
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('type');
      expect(result.data?.input).toBe('Hello World');
      expect(result.data?.method).toBe('type');
      expect(result.data?.speed).toBe(100);
      expect(mockTypeText).toHaveBeenCalledWith('Hello World', { speed: 100, windowIndex: 1 });
    });

    test('should type with default speed and repeat', async () => {
      mockTypeText.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardType({
        text: 'Default settings'
      });

      expect(result.success).toBe(true);
      expect(mockTypeText).toHaveBeenCalledWith('Default settings', { speed: 50, windowIndex: 1 });
    });

    test('should handle multiple repetitions', async () => {
      mockTypeText.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardType({
        text: 'Repeat me',
        repeat: 3
      });

      expect(result.success).toBe(true);
      expect(result.data?.repeat).toBe(3);
      expect(mockTypeText).toHaveBeenCalledTimes(3);
    });

    test('should stop on first failure in repetitions', async () => {
      mockTypeText
        .mockResolvedValueOnce({
          success: true,
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: false,
          code: ErrorCode.KEYBOARD_INPUT_FAILED,
          error: 'Typing failed'
        });

      const result = await keyboardType({
        text: 'Fail on second',
        repeat: 3
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Typing failed');
      expect(mockTypeText).toHaveBeenCalledTimes(2);
    });

    test('should reject empty options', async () => {
      const result = await keyboardType({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must specify exactly one of: text, combo, key, or clear');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject empty text', async () => {
      const result = await keyboardType({ text: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid text value');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject invalid options', async () => {
      const result = await keyboardType({
        text: 'Valid',
        combo: 'cmd+s' // Can't have both text and combo
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must specify exactly one of: text, combo, key, or clear');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject invalid text value', async () => {
      const result = await keyboardType({
        text: null as unknown as string
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid text value');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject invalid speed', async () => {
      const result = await keyboardType({
        text: 'Test',
        speed: -1
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid speed value');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject invalid repeat count', async () => {
      const result = await keyboardType({
        text: 'Test',
        repeat: 0
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid repeat value (must be >= 1)');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle UI errors', async () => {
      mockTypeText.mockResolvedValue({
        success: false,
        code: ErrorCode.CHROME_NOT_RUNNING,
        error: 'Chrome is not running'
      });

      const result = await keyboardType({
        text: 'Will fail'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Chrome is not running');
      expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
    });

    test('should handle exceptions', async () => {
      mockTypeText.mockRejectedValue(new Error('Unexpected error'));

      const result = await keyboardType({
        text: 'Will throw'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keyboard type failed: Error: Unexpected error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('keyboardCombo', () => {
    test('should execute key combination successfully', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardCombo({
        combo: 'cmd+s'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('combo');
      expect(result.data?.input).toBe('cmd+s');
      expect(result.data?.method).toBe('combo');
      expect(mockSendKeys).toHaveBeenCalledWith('cmd+s', { windowIndex: 1 });
    });

    test('should normalize key combinations', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      // Test various normalization cases
      await keyboardCombo({ combo: 'Command + S' });
      expect(mockSendKeys).toHaveBeenLastCalledWith('cmd+s', { windowIndex: 1 });

      await keyboardCombo({ combo: 'CONTROL+A' });
      expect(mockSendKeys).toHaveBeenLastCalledWith('ctrl+a', { windowIndex: 1 });

      await keyboardCombo({ combo: 'Option+Tab' });
      expect(mockSendKeys).toHaveBeenLastCalledWith('alt+tab', { windowIndex: 1 });

      await keyboardCombo({ combo: 'Windows+L' });
      expect(mockSendKeys).toHaveBeenLastCalledWith('cmd+l', { windowIndex: 1 });

      await keyboardCombo({ combo: 'Meta+R' });
      expect(mockSendKeys).toHaveBeenLastCalledWith('cmd+r', { windowIndex: 1 });
    });

    test('should validate key combinations', async () => {
      const result = await keyboardCombo({
        combo: 'invalid+combo+key'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid modifier:');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject empty combination', async () => {
      const result = await keyboardCombo({
        combo: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid key combination');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should reject missing combo', async () => {
      const result = await keyboardCombo({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must specify exactly one of: text, combo, key, or clear');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle valid modifier combinations', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const validCombos = [
        'cmd+s',
        'cmd+shift+z',
        'ctrl+alt+del',
        'shift+f10',
        'alt+f4',
        'cmd+ctrl+space'
      ];

      for (const combo of validCombos) {
        const result = await keyboardCombo({ combo });
        expect(result.success).toBe(true);
      }
    });

    test('should handle function keys', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardCombo({
        combo: 'cmd+f12'
      });

      expect(result.success).toBe(true);
    });

    test('should handle special keys', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const specialKeys = [
        'cmd+space',
        'alt+enter',
        'ctrl+escape',
        'shift+delete',
        'cmd+backspace'
      ];

      for (const combo of specialKeys) {
        const result = await keyboardCombo({ combo });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('keyboardPress', () => {
    test('should press individual key successfully', async () => {
      mockPressKey.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardPress({
        key: 'Enter'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('press');
      expect(result.data?.input).toBe('Enter');
      expect(result.data?.method).toBe('key');
      expect(mockPressKey).toHaveBeenCalledWith('Enter', { windowIndex: 1 });
    });

    test('should press with repetition', async () => {
      mockPressKey.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardPress({
        key: 'ArrowDown',
        repeat: 5
      });

      expect(result.success).toBe(true);
      expect(result.data?.repeat).toBe(5);
      expect(mockPressKey).toHaveBeenCalledTimes(5);
    });

    test('should reject missing key', async () => {
      const result = await keyboardPress({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must specify exactly one of: text, combo, key, or clear');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    test('should handle various key names', async () => {
      mockPressKey.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const keys = [
        'Enter',
        'Escape',
        'Tab',
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'Delete',
        'Backspace',
        'F1',
        'F12'
      ];

      for (const key of keys) {
        const result = await keyboardPress({ key });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('keyboardClear', () => {
    test('should clear field successfully', async () => {
      mockClearField.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardClear();

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('clear');
      expect(result.data?.input).toBe('clear');
      expect(result.data?.method).toBe('clear');
      expect(mockClearField).toHaveBeenCalledWith({ windowIndex: 1 });
    });

    test('should clear with custom window index', async () => {
      mockClearField.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardClear(2);

      expect(result.success).toBe(true);
      expect(mockClearField).toHaveBeenCalledWith({ windowIndex: 2 });
    });

    test('should handle clear failure', async () => {
      mockClearField.mockResolvedValue({
        success: false,
        code: ErrorCode.ELEMENT_NOT_FOUND,
        error: 'No field to clear'
      });

      const result = await keyboardClear();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No field to clear');
      expect(result.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    });
  });

  describe('keyboardShortcut', () => {
    test('should execute predefined shortcuts', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardShortcut('COPY');

      expect(result.success).toBe(true);
      expect(mockSendKeys).toHaveBeenCalledWith('cmd+c', { windowIndex: 1 });
    });

    test('should handle all predefined shortcuts', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const shortcuts: (keyof typeof KeyboardShortcuts)[] = [
        'COPY', 'PASTE', 'CUT', 'UNDO', 'REDO', 'SELECT_ALL',
        'REFRESH', 'HARD_REFRESH', 'NEW_TAB', 'CLOSE_TAB', 'REOPEN_TAB',
        'NEXT_TAB', 'PREV_TAB', 'BACK', 'FORWARD', 'ADDRESS_BAR',
        'FIND', 'DEVELOPER_TOOLS', 'MINIMIZE', 'HIDE', 'QUIT', 'FORCE_QUIT'
      ];

      for (const shortcut of shortcuts) {
        const result = await keyboardShortcut(shortcut);
        expect(result.success).toBe(true);
      }

      expect(mockSendKeys).toHaveBeenCalledTimes(shortcuts.length);
    });

    test('should execute shortcuts with repetition', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await keyboardShortcut('UNDO', 3);

      expect(result.success).toBe(true);
      expect(mockSendKeys).toHaveBeenCalledTimes(3);
    });
  });

  describe('KeyboardShortcuts constants', () => {
    test('should have correct shortcut definitions', () => {
      expect(KeyboardShortcuts.COPY).toBe('cmd+c');
      expect(KeyboardShortcuts.PASTE).toBe('cmd+v');
      expect(KeyboardShortcuts.CUT).toBe('cmd+x');
      expect(KeyboardShortcuts.UNDO).toBe('cmd+z');
      expect(KeyboardShortcuts.REDO).toBe('cmd+shift+z');
      expect(KeyboardShortcuts.SELECT_ALL).toBe('cmd+a');
      expect(KeyboardShortcuts.REFRESH).toBe('cmd+r');
      expect(KeyboardShortcuts.HARD_REFRESH).toBe('cmd+shift+r');
      expect(KeyboardShortcuts.NEW_TAB).toBe('cmd+t');
      expect(KeyboardShortcuts.CLOSE_TAB).toBe('cmd+w');
      expect(KeyboardShortcuts.REOPEN_TAB).toBe('cmd+shift+t');
      expect(KeyboardShortcuts.NEXT_TAB).toBe('cmd+alt+right');
      expect(KeyboardShortcuts.PREV_TAB).toBe('cmd+alt+left');
      expect(KeyboardShortcuts.BACK).toBe('cmd+left');
      expect(KeyboardShortcuts.FORWARD).toBe('cmd+right');
      expect(KeyboardShortcuts.ADDRESS_BAR).toBe('cmd+l');
      expect(KeyboardShortcuts.FIND).toBe('cmd+f');
      expect(KeyboardShortcuts.DEVELOPER_TOOLS).toBe('cmd+alt+i');
      expect(KeyboardShortcuts.MINIMIZE).toBe('cmd+m');
      expect(KeyboardShortcuts.HIDE).toBe('cmd+h');
      expect(KeyboardShortcuts.QUIT).toBe('cmd+q');
      expect(KeyboardShortcuts.FORCE_QUIT).toBe('cmd+alt+esc');
    });
  });

  describe('validation functions', () => {
    test('should validate input options correctly', async () => {
      // Valid single input
      expect((await keyboardType({ text: 'test' })).success).toBe(true);
      
      // Multiple inputs should fail
      expect((await keyboardType({ text: 'test', combo: 'cmd+s' } as KeyInputOptions)).success).toBe(false);
      
      // No inputs should fail
      expect((await keyboardType({})).success).toBe(false);
    });

    test('should validate key combinations format', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      // Valid combinations
      const validCombos = [
        'a',           // Single key
        'cmd+s',       // Modifier + key
        'ctrl+alt+del', // Multiple modifiers
        'shift+f10'    // Modifier + function key
      ];

      for (const combo of validCombos) {
        const result = await keyboardCombo({ combo });
        expect(result.success).toBe(true);
      }

      // Invalid combinations
      const invalidCombos = [
        '',              // Empty
        'invalid+xyz',   // Invalid modifier
        '+s',           // No key before +
        'cmd+',         // No key after +
        'cmd+invalid'   // Invalid key
      ];

      for (const combo of invalidCombos) {
        const result = await keyboardCombo({ combo });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('window index handling', () => {
    test('should use custom window index', async () => {
      mockTypeText.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      await keyboardType({
        text: 'test',
        windowIndex: 3
      });

      expect(mockTypeText).toHaveBeenCalledWith('test', { speed: 50, windowIndex: 3 });
    });

    test('should default to window index 1', async () => {
      mockTypeText.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      await keyboardType({
        text: 'test'
      });

      expect(mockTypeText).toHaveBeenCalledWith('test', { speed: 50, windowIndex: 1 });
    });
  });

  describe('error code propagation', () => {
    test('should propagate error codes from UI layer', async () => {
      const errorCodes = [
        ErrorCode.CHROME_NOT_RUNNING,
        ErrorCode.ELEMENT_NOT_FOUND,
        ErrorCode.KEYBOARD_INPUT_FAILED,
        ErrorCode.APPLESCRIPT_ERROR
      ];

      for (const errorCode of errorCodes) {
        mockTypeText.mockResolvedValue({
          success: false,
          code: errorCode,
          error: 'Test error'
        });

        const result = await keyboardType({ text: 'test' });
        expect(result.success).toBe(false);
        expect(result.code).toBe(errorCode);
      }
    });
  });

  describe('timing and delays', () => {
    test('should add delays between repetitions for typing', async () => {
      mockTypeText.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const startTime = Date.now();
      await keyboardType({
        text: 'test',
        repeat: 2
      });
      const endTime = Date.now();

      // Should have at least some delay (100ms between repetitions)
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
      expect(mockTypeText).toHaveBeenCalledTimes(2);
    });

    test('should add delays between repetitions for combos', async () => {
      mockSendKeys.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      const startTime = Date.now();
      await keyboardCombo({
        combo: 'cmd+s',
        repeat: 2
      });
      const endTime = Date.now();

      // Should have at least some delay (200ms between repetitions for combos)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      expect(mockSendKeys).toHaveBeenCalledTimes(2);
    });
  });
});