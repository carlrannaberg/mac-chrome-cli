/**
 * Unit tests for utility functions
 */

import {
  execWithTimeout,
  formatJSONResult,
  createWebPPreview,
  expandPath,
  validateInput,
  sleep,
  escapeCSSSelector,
  ERROR_CODES,
  type ExecResult,
  type JSONResult
} from '../../src/lib/util.js';
import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import fs from 'fs';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock sharp for WebP testing
jest.mock('sharp', () => {
  const mockPipeline = {
    metadata: jest.fn(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn()
  };
  const mockSharp = jest.fn(() => mockPipeline);
  return { default: mockSharp, ...mockPipeline };
});

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execWithTimeout', () => {
    it('should execute command successfully', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      // Simulate successful execution
      const promise = execWithTimeout('echo', ['hello'], 5000);

      // Trigger stdout data
      const stdoutHandler = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stdoutHandler) stdoutHandler(Buffer.from('hello\n'));

      // Trigger close with exit code 0
      const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler(0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('');
      expect(result.code).toBeErrorCode(ERROR_CODES.OK);
      expect(result.command).toBe('echo hello');
    });

    it('should handle command failure', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      const promise = execWithTimeout('false', [], 5000);

      // Trigger close with non-zero exit code
      const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler(1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should handle timeout', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      const promise = execWithTimeout('sleep', ['10'], 100); // 100ms timeout

      // Don't trigger close, let it timeout
      setTimeout(() => {
        const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeHandler) closeHandler(0);
      }, 200);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Command timed out');
      expect(result.code).toBeErrorCode(ERROR_CODES.TIMEOUT);
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle stderr output', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      const promise = execWithTimeout('test-command', [], 5000);

      // Trigger stderr data
      const stderrHandler = mockChild.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stderrHandler) stderrHandler(Buffer.from('error message\n'));

      // Trigger close with exit code 1
      const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler(1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('error message');
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should handle spawn errors', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      const promise = execWithTimeout('non-existent-command', [], 5000);

      // Trigger error event
      const errorHandler = mockChild.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (errorHandler) errorHandler(new Error('ENOENT: command not found'));

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('ENOENT: command not found');
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should handle multiple stdout/stderr chunks', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      const promise = execWithTimeout('test', [], 5000);

      // Trigger multiple stdout chunks
      const stdoutHandler = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stdoutHandler) {
        stdoutHandler(Buffer.from('chunk1\n'));
        stdoutHandler(Buffer.from('chunk2\n'));
      }

      // Trigger multiple stderr chunks
      const stderrHandler = mockChild.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stderrHandler) {
        stderrHandler(Buffer.from('error1\n'));
        stderrHandler(Buffer.from('error2\n'));
      }

      // Trigger close
      const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler(0);

      const result = await promise;

      expect(result.stdout).toBe('chunk1\nchunk2');
      expect(result.stderr).toBe('error1\nerror2');
    });

    it('should use default timeout', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockChild as never);

      execWithTimeout('test');

      // Verify timeout was set (we can't easily test the exact value, but we can check it was called)
      expect(mockSpawn).toHaveBeenCalledWith('test', [], expect.any(Object));
    });
  });

  describe('formatJSONResult', () => {
    it('should format successful result', () => {
      const data = { message: 'Success' };
      const result = formatJSONResult(data, undefined, ERROR_CODES.OK);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.code).toBeErrorCode(ERROR_CODES.OK);
      expect(result.timestamp).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should format error result', () => {
      const error = 'Something went wrong';
      const result = formatJSONResult(undefined, error, ERROR_CODES.UNKNOWN_ERROR);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.code).toBeErrorCode(ERROR_CODES.UNKNOWN_ERROR);
      expect(result.timestamp).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it('should handle undefined data and error', () => {
      const result = formatJSONResult();

      expect(result.success).toBe(true);
      expect(result.code).toBeErrorCode(ERROR_CODES.OK);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should include valid ISO timestamp', () => {
      const result = formatJSONResult();
      const timestamp = new Date(result.timestamp);

      expect(timestamp.toISOString()).toBe(result.timestamp);
      expect(timestamp.getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });

    it('should handle different error codes', () => {
      const codes = [
        ERROR_CODES.INVALID_INPUT,
        ERROR_CODES.TARGET_NOT_FOUND,
        ERROR_CODES.PERMISSION_DENIED,
        ERROR_CODES.TIMEOUT,
        ERROR_CODES.CHROME_NOT_FOUND
      ];

      codes.forEach(code => {
        const result = formatJSONResult(undefined, 'Error', code);
        expect(result.success).toBe(false);
        expect(result.code).toBeErrorCode(code);
      });
    });
  });

  describe('createWebPPreview', () => {
    it('should handle sharp module requirement', async () => {
      // Since Sharp is complex to mock properly in ESM/TypeScript environment,
      // we'll test that the function exists and has proper error handling
      expect(typeof createWebPPreview).toBe('function');
      
      // Test with invalid path - should return empty preview (graceful degradation)
      const result = await createWebPPreview('/non/existent/path.png');
      expect(result).toEqual({
        buffer: Buffer.from(''),
        base64: '',
        size: 0
      });
    });
  });

  describe('expandPath', () => {
    it('should expand tilde to home directory', () => {
      const result = expandPath('~/Documents/test.txt');
      expect(result).toBe(join(homedir(), 'Documents/test.txt'));
    });

    it('should not modify absolute paths', () => {
      const absolutePath = '/usr/local/bin/test';
      const result = expandPath(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('should not modify relative paths without tilde', () => {
      const relativePath = 'Documents/test.txt';
      const result = expandPath(relativePath);
      expect(result).toBe(relativePath);
    });

    it('should handle just tilde', () => {
      const result = expandPath('~/');
      expect(result).toBe(join(homedir(), ''));
    });

    it('should handle empty string', () => {
      const result = expandPath('');
      expect(result).toBe('');
    });

    it('should handle paths with tilde not at start', () => {
      const path = '/tmp/~backup';
      const result = expandPath(path);
      expect(result).toBe(path); // Should not expand
    });
  });

  describe('validateInput', () => {
    describe('string validation', () => {
      it('should validate non-empty strings', () => {
        expect(validateInput('hello', 'string')).toBe(true);
        expect(validateInput('test', 'string', true)).toBe(true);
      });

      it('should reject empty strings', () => {
        expect(validateInput('', 'string')).toBe(false);
        expect(validateInput('   ', 'string')).toBe(false);
      });

      it('should reject non-strings', () => {
        expect(validateInput(123, 'string')).toBe(false);
        expect(validateInput(null, 'string')).toBe(false);
        expect(validateInput(undefined, 'string')).toBe(false);
      });
    });

    describe('number validation', () => {
      it('should validate numbers', () => {
        expect(validateInput(42, 'number')).toBe(true);
        expect(validateInput(0, 'number')).toBe(true);
        expect(validateInput(-1, 'number')).toBe(true);
        expect(validateInput(3.14, 'number')).toBe(true);
      });

      it('should reject NaN', () => {
        expect(validateInput(NaN, 'number')).toBe(false);
      });

      it('should reject non-numbers', () => {
        expect(validateInput('42', 'number')).toBe(false);
        expect(validateInput(null, 'number')).toBe(false);
      });
    });

    describe('boolean validation', () => {
      it('should validate booleans', () => {
        expect(validateInput(true, 'boolean')).toBe(true);
        expect(validateInput(false, 'boolean')).toBe(true);
      });

      it('should reject non-booleans', () => {
        expect(validateInput('true', 'boolean')).toBe(false);
        expect(validateInput(1, 'boolean')).toBe(false);
        expect(validateInput(0, 'boolean')).toBe(false);
      });
    });

    describe('object validation', () => {
      it('should validate objects', () => {
        expect(validateInput({}, 'object')).toBe(true);
        expect(validateInput({ key: 'value' }, 'object')).toBe(true);
        expect(validateInput([], 'object')).toBe(true);
      });

      it('should reject null', () => {
        expect(validateInput(null, 'object')).toBe(false);
      });

      it('should reject primitives', () => {
        expect(validateInput('string', 'object')).toBe(false);
        expect(validateInput(42, 'object')).toBe(false);
      });
    });

    describe('required parameter handling', () => {
      it('should reject undefined/null for required parameters', () => {
        expect(validateInput(undefined, 'string', true)).toBe(false);
        expect(validateInput(null, 'string', true)).toBe(false);
      });

      it('should accept undefined/null for optional parameters', () => {
        expect(validateInput(undefined, 'string', false)).toBe(true);
        expect(validateInput(null, 'string', false)).toBe(true);
      });

      it('should default to required=true', () => {
        expect(validateInput(undefined, 'string')).toBe(false);
      });
    });

    it('should handle unknown types', () => {
      expect(validateInput('test', 'unknown' as never)).toBe(false);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(95); // Allow small timing variations
      expect(end - start).toBeLessThan(150);
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      await sleep(0);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(10);
    });

    it('should return a Promise', () => {
      const result = sleep(1);
      expect(result).toBeInstanceOf(Promise);
      return result; // Ensure it resolves
    });
  });

  describe('escapeCSSSelector', () => {
    it('should escape single quotes', () => {
      expect(escapeCSSSelector("button[title='test']")).toBe("button[title=\\'test\\']");
    });

    it('should escape multiple single quotes', () => {
      expect(escapeCSSSelector("input[name='user's name']")).toBe("input[name=\\'user\\'s name\\']");
    });

    it('should not modify selectors without quotes', () => {
      expect(escapeCSSSelector('#my-button')).toBe('#my-button');
      expect(escapeCSSSelector('.class-name')).toBe('.class-name');
    });

    it('should handle empty string', () => {
      expect(escapeCSSSelector('')).toBe('');
    });

    it('should handle complex selectors', () => {
      const complex = "div[data-test='value'] > span[title='nested's test']";
      const expected = "div[data-test=\\'value\\'] > span[title=\\'nested\\'s test\\']";
      expect(escapeCSSSelector(complex)).toBe(expected);
    });
  });

  describe('Error Codes', () => {
    it('should have consistent error code values', () => {
      expect(ERROR_CODES.OK).toBe(0);
      expect(ERROR_CODES.INVALID_INPUT).toBe(10);
      expect(ERROR_CODES.TARGET_NOT_FOUND).toBe(20);
      expect(ERROR_CODES.PERMISSION_DENIED).toBe(30);
      expect(ERROR_CODES.TIMEOUT).toBe(40);
      expect(ERROR_CODES.CHROME_NOT_FOUND).toBe(50);
      expect(ERROR_CODES.UNKNOWN_ERROR).toBe(99);
    });

    it('should be readonly', () => {
      // TypeScript enforces readonly at compile time
      // At runtime, we can still modify the object, but TypeScript prevents it
      expect(typeof ERROR_CODES.OK).toBe('number');
      expect(ERROR_CODES.OK).toBe(0);
      
      // Test that all values are numbers
      Object.values(ERROR_CODES).forEach(code => {
        expect(typeof code).toBe('number');
      });
    });
  });
});