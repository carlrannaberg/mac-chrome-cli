/**
 * Unit tests for ui library
 */

import {
  clickAt,
  doubleClickAt,
  rightClickAt,
  moveTo,
  dragFromTo,
  typeText,
  sendKeys,
  pressKey,
  clearField,
  type UIResult,
  type ClickOptions,
  type KeyboardOptions
} from '../../../src/lib/ui.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import * as util from '../../../src/lib/util.js';
import * as apple from '../../../src/lib/apple.js';

// Mock the util library
jest.mock('../../../src/lib/util.js', () => ({
  execWithTimeout: jest.fn(),
  ERROR_CODES: {
    OK: 0,
    TARGET_NOT_FOUND: 20,
    PERMISSION_DENIED: 30,
    UNKNOWN_ERROR: 99,
    CHROME_NOT_RUNNING: 51
  },
  sleep: jest.fn()
}));

// Mock the apple library
jest.mock('../../../src/lib/apple.js', () => ({
  focusChromeWindow: jest.fn()
}));

const mockExecWithTimeout = util.execWithTimeout as jest.MockedFunction<typeof util.execWithTimeout>;
const mockSleep = util.sleep as jest.MockedFunction<typeof util.sleep>;
const mockFocusChromeWindow = apple.focusChromeWindow as jest.MockedFunction<typeof apple.focusChromeWindow>;

describe('UI Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockFocusChromeWindow.mockResolvedValue({
      success: true,
      code: ErrorCode.OK,
      error: undefined
    });

    // Mock cliclick availability check (which cliclick)
    mockExecWithTimeout.mockImplementation((command, args) => {
      if (command === 'which' && args?.[0] === 'cliclick') {
        return Promise.resolve({
          success: true,
          data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
          code: ErrorCode.OK,
          error: undefined
        });
      }
      
      // Default cliclick execution
      if (command === 'cliclick') {
        return Promise.resolve({
          success: true,
          data: { stdout: 'OK', stderr: '' },
          code: ErrorCode.OK,
          error: undefined
        });
      }
      
      return Promise.resolve({
        success: false,
        error: 'Unknown command',
        code: ErrorCode.UNKNOWN_ERROR
      });
    });
  });

  describe('cliclick availability checking', () => {
    test('should detect when cliclick is not installed', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'not found',
            code: ErrorCode.TARGET_NOT_FOUND
          });
        }
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('cliclick is not installed. Install with: brew install cliclick');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should handle permission denied errors', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'not authorized to perform this action',
            code: ErrorCode.PERMISSION_DENIED
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied. Grant accessibility permissions to Terminal in System Preferences > Privacy & Security > Accessibility');
      expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
    });
  });

  describe('clickAt', () => {
    test('should click at coordinates successfully', async () => {
      const result = await clickAt(150, 250);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('left_click');
      expect(result.data?.coordinates).toEqual({ x: 150, y: 250 });
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['c:150,250'], 10000);
    });

    test('should handle right click', async () => {
      const result = await clickAt(100, 200, { button: 'right' });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('right_click');
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['rc:100,200'], 10000);
    });

    test('should handle middle click', async () => {
      const result = await clickAt(100, 200, { button: 'middle' });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('middle_click');
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['mc:100,200'], 10000);
    });

    test('should handle multiple clicks', async () => {
      const result = await clickAt(100, 200, { clickCount: 3 });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('left_click');
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['c:100,200', 'c:100,200', 'c:100,200'], 10000);
    });

    test('should round coordinates to integers', async () => {
      const result = await clickAt(100.7, 200.3);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 100.7, y: 200.3 });
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['c:101,200'], 10000);
    });

    test('should use custom window index', async () => {
      const result = await clickAt(100, 200, { windowIndex: 2 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(2);
    });

    test('should handle Chrome window focus failure', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: false,
        error: 'Chrome window not found',
        code: ErrorCode.CHROME_NOT_RUNNING
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Chrome window not found');
      expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
    });

    test('should handle cliclick execution failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'cliclick command failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('cliclick command failed');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('doubleClickAt', () => {
    test('should perform double-click', async () => {
      const result = await doubleClickAt(100, 200);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('left_click');
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['c:100,200', 'c:100,200'], 10000);
    });
  });

  describe('rightClickAt', () => {
    test('should perform right-click', async () => {
      const result = await rightClickAt(100, 200);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('right_click');
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['rc:100,200'], 10000);
    });
  });

  describe('moveTo', () => {
    test('should move mouse to coordinates', async () => {
      const result = await moveTo(300, 400);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('mouse_move');
      expect(result.data?.coordinates).toEqual({ x: 300, y: 400 });
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['m:300,400'], 10000);
    });

    test('should use custom window index', async () => {
      const result = await moveTo(300, 400, { windowIndex: 3 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(3);
    });

    test('should round coordinates', async () => {
      const result = await moveTo(300.8, 400.2);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 300.8, y: 400.2 });
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['m:301,400'], 10000);
    });

    test('should handle mouse move failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'Mouse move failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await moveTo(300, 400);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mouse move failed');
    });
  });

  describe('dragFromTo', () => {
    test('should drag from one point to another', async () => {
      const result = await dragFromTo(100, 200, 300, 400);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('drag');
      expect(result.data?.coordinates).toEqual({ x: 300, y: 400 });
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['dd:100,200', 'dm:300,400', 'du:300,400'], 10000);
    });

    test('should use custom window index', async () => {
      const result = await dragFromTo(100, 200, 300, 400, { windowIndex: 2 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(2);
    });

    test('should round coordinates', async () => {
      const result = await dragFromTo(100.3, 200.7, 300.9, 400.1);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toEqual({ x: 300.9, y: 400.1 });
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['dd:100,201', 'dm:301,400', 'du:301,400'], 10000);
    });

    test('should handle drag failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'Drag operation failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await dragFromTo(100, 200, 300, 400);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Drag operation failed');
    });
  });

  describe('typeText', () => {
    test('should type text successfully', async () => {
      const result = await typeText('Hello World');

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('type_text');
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['t:Hello World'], 10000);
    });

    test('should escape special characters', async () => {
      const result = await typeText('Text with "quotes" and \\backslashes and \'apostrophes\'');

      expect(result.success).toBe(true);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['t:Text with \\"quotes\\" and \\\\backslashes and \\\'apostrophes\\\''], 10000);
    });

    test('should use custom window index', async () => {
      const result = await typeText('test', { windowIndex: 2 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(2);
    });

    test('should handle custom speed with delay', async () => {
      mockSleep.mockResolvedValue();

      const result = await typeText('test', { speed: 100 });

      expect(result.success).toBe(true);
      expect(mockSleep).toHaveBeenCalledWith(50); // 100 - 50 (default)
    });

    test('should not add delay for speed less than or equal to default', async () => {
      const result = await typeText('test', { speed: 30 });

      expect(result.success).toBe(true);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    test('should handle typing failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'Type command failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await typeText('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Type command failed');
    });

    test('should handle exceptions', async () => {
      mockFocusChromeWindow.mockRejectedValue(new Error('Focus error'));

      const result = await typeText('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to type text: Error: Focus error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('sendKeys', () => {
    test('should send key combinations', async () => {
      const result = await sendKeys('cmd+s');

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('send_keys');
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['kp:cmd,s'], 10000);
    });

    test('should normalize key names', async () => {
      const testCases = [
        { input: 'command+shift+r', expected: 'cmd,shift,r' },
        { input: 'option+tab', expected: 'alt,tab' },
        { input: 'control+a', expected: 'ctrl,a' },
        { input: 'CMD+SHIFT+Z', expected: 'cmd,shift,z' }
      ];

      for (const testCase of testCases) {
        await sendKeys(testCase.input);
        expect(mockExecWithTimeout).toHaveBeenLastCalledWith('cliclick', [`kp:${testCase.expected}`], 10000);
      }
    });

    test('should use custom window index', async () => {
      const result = await sendKeys('cmd+r', { windowIndex: 3 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(3);
    });

    test('should handle send keys failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'Key combination failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await sendKeys('cmd+s');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key combination failed');
    });

    test('should handle exceptions', async () => {
      mockExecWithTimeout.mockRejectedValue(new Error('Execution error'));

      const result = await sendKeys('cmd+s');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send key combination: Error: Execution error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('pressKey', () => {
    test('should press individual key', async () => {
      const result = await pressKey('Enter');

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('press_key');
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['kp:enter'], 10000);
    });

    test('should convert key to lowercase', async () => {
      const result = await pressKey('ESCAPE');

      expect(result.success).toBe(true);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['kp:escape'], 10000);
    });

    test('should use custom window index', async () => {
      const result = await pressKey('Tab', { windowIndex: 2 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(2);
    });

    test('should handle press key failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: false,
            error: 'Key press failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await pressKey('Enter');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key press failed');
    });

    test('should handle exceptions', async () => {
      mockFocusChromeWindow.mockRejectedValue(new Error('Focus failed'));

      const result = await pressKey('Enter');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to press key: Error: Focus failed');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('clearField', () => {
    test('should clear field successfully', async () => {
      mockSleep.mockResolvedValue();

      const result = await clearField();

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('clear_field');
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['kp:cmd,a'], 10000);
      expect(mockSleep).toHaveBeenCalledWith(100);
      expect(mockExecWithTimeout).toHaveBeenCalledWith('cliclick', ['kp:delete'], 10000);
    });

    test('should use custom window index', async () => {
      mockSleep.mockResolvedValue();

      const result = await clearField({ windowIndex: 2 });

      expect(result.success).toBe(true);
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(2);
    });

    test('should handle select all failure', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick' && args?.[0] === 'kp:cmd,a') {
          return Promise.resolve({
            success: false,
            error: 'Select all failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        if (command === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: 'OK', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clearField();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Select all failed');
    });

    test('should handle delete key failure', async () => {
      mockSleep.mockResolvedValue();
      
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick' && args?.[0] === 'kp:cmd,a') {
          return Promise.resolve({
            success: true,
            data: { stdout: 'OK', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick' && args?.[0] === 'kp:delete') {
          return Promise.resolve({
            success: false,
            error: 'Delete key failed',
            code: ErrorCode.UNKNOWN_ERROR
          });
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clearField();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete key failed');
    });

    test('should handle exceptions', async () => {
      mockFocusChromeWindow.mockRejectedValue(new Error('Clear field error'));

      const result = await clearField();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to clear field: Error: Clear field error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('error handling edge cases', () => {
    test('should handle cliclick availability check exceptions', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          throw new Error('which command failed');
        }
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('cliclick is not installed. Install with: brew install cliclick');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should handle cliclick execution exceptions', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '/usr/local/bin/cliclick', stderr: '' },
            code: ErrorCode.OK,
            error: undefined
          });
        }
        
        if (command === 'cliclick') {
          throw new Error('cliclick execution exception');
        }
        
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to execute cliclick: Error: cliclick execution exception');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    test('should handle empty cliclick path response', async () => {
      mockExecWithTimeout.mockImplementation((command, args) => {
        if (command === 'which' && args?.[0] === 'cliclick') {
          return Promise.resolve({
            success: true,
            data: { stdout: '', stderr: '' }, // Empty stdout
            code: ErrorCode.OK,
            error: undefined
          });
        }
        return Promise.resolve({ success: false, error: 'test', code: ErrorCode.UNKNOWN_ERROR });
      });

      const result = await clickAt(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('cliclick is not installed. Install with: brew install cliclick');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });
  });

  describe('Chrome window focus integration', () => {
    test('should handle all functions requiring Chrome window focus', async () => {
      const functions = [
        () => clickAt(100, 200),
        () => moveTo(300, 400),
        () => dragFromTo(100, 200, 300, 400),
        () => typeText('test'),
        () => sendKeys('cmd+s'),
        () => pressKey('Enter'),
        () => clearField()
      ];

      for (const func of functions) {
        mockFocusChromeWindow.mockClear();
        
        const result = await func();
        
        expect(result.success).toBe(true);
        expect(mockFocusChromeWindow).toHaveBeenCalledTimes(1);
      }
    });

    test('should propagate Chrome window focus errors', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: false,
        error: 'Chrome not running',
        code: ErrorCode.CHROME_NOT_RUNNING
      });

      const functions = [
        () => clickAt(100, 200),
        () => moveTo(300, 400),
        () => dragFromTo(100, 200, 300, 400),
        () => typeText('test'),
        () => sendKeys('cmd+s'),
        () => pressKey('Enter'),
        () => clearField()
      ];

      for (const func of functions) {
        const result = await func();
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Chrome not running');
        expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
      }
    });
  });
});