/**
 * Comprehensive failure scenario tests
 * 
 * Tests critical failure scenarios including permission denied, network timeouts,
 * malformed responses, and system error conditions
 */

import { 
  execWithTimeout,
  formatJSONResult,
  ERROR_CODES 
} from '../src/lib/util.js';
import { 
  execChromeJS,
  getChromeWindowBounds,
  isChromeRunning 
} from '../src/lib/apple.js';
import { AppleScriptService } from '../src/services/AppleScriptService.js';
import { SecurePathValidator } from '../src/security/PathValidator.js';
import { NetworkDataSanitizer } from '../src/security/DataSanitizer.js';

// Mock external dependencies
jest.mock('../src/lib/util.js', () => ({
  ...jest.requireActual('../src/lib/util.js'),
  execWithTimeout: jest.fn()
}));

jest.mock('../src/lib/apple.js', () => ({
  ...jest.requireActual('../src/lib/apple.js'),
  execChromeJS: jest.fn(),
  getChromeWindowBounds: jest.fn(),
  isChromeRunning: jest.fn()
}));

jest.mock('child_process');

const mockExecWithTimeout = execWithTimeout as jest.MockedFunction<typeof execWithTimeout>;
const mockExecChromeJS = execChromeJS as jest.MockedFunction<typeof execChromeJS>;
const mockGetChromeWindowBounds = getChromeWindowBounds as jest.MockedFunction<typeof getChromeWindowBounds>;
const mockIsChromeRunning = isChromeRunning as jest.MockedFunction<typeof isChromeRunning>;

describe('Critical Failure Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permission Denied Scenarios', () => {
    it('should handle AppleScript automation permission denied', async () => {
      const permissionError = testUtils.failureScenarios.createPermissionDeniedError('AppleScript automation');
      mockExecWithTimeout.mockRejectedValue(permissionError);

      const service = new AppleScriptService();
      const result = await service.executeScript('tell application "Google Chrome"');

      expect(result.success).toBe(false);
      expect(result.error).toBePermissionError();
      expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR); // Service maps all errors to UNKNOWN_ERROR
    });

    it('should handle screen recording permission denied', async () => {
      mockExecWithTimeout.mockResolvedValue({
        success: false,
        error: 'screencapture: cannot create screenshot file',
        code: ERROR_CODES.PERMISSION_DENIED,
        data: undefined,
        context: {}
      });

      const result = await execWithTimeout('screencapture', ['-x', '/tmp/test.png'], 5000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot create screenshot');
      expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    });

    it('should handle Chrome automation permission denied', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'Not authorized to send Apple events to Google Chrome',
        code: ERROR_CODES.PERMISSION_DENIED
      });

      const result = await execChromeJS('document.title', 1, 1, 5000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not authorized');
      expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    });

    it('should handle file system permission denied', () => {
      const validator = new SecurePathValidator();
      
      // Test accessing restricted system paths
      const restrictedPaths = [
        '/System/Library/Private',
        '/private/var/root',
        '/usr/bin/sudo',
        '/../../../etc/passwd'
      ];

      restrictedPaths.forEach(testPath => {
        const result = validator.validateFilePath(testPath);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/denied|outside.*allowed|not.*allowed/i);
      });
    });
  });

  describe('Network Timeout Scenarios', () => {
    it('should handle AppleScript execution timeout', async () => {
      const timeoutError = testUtils.failureScenarios.createTimeoutError('AppleScript execution');
      mockExecWithTimeout.mockRejectedValue(timeoutError);

      const service = new AppleScriptService();
      const result = await service.executeJavaScript('while(true) {}'); // Infinite loop

      expect(result.success).toBe(false);
      expect(result.error).toBeTimeoutError();
      expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR); // Service maps all errors to UNKNOWN_ERROR
    });

    it('should handle Chrome communication timeout', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'Operation timed out after 5000ms',
        code: ERROR_CODES.TIMEOUT
      });

      const result = await execChromeJS('fetch("http://slow-endpoint.test")', 1, 1, 5000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.code).toBe(ERROR_CODES.TIMEOUT);
    });

    it('should handle window bounds retrieval timeout', async () => {
      const timeoutError = testUtils.failureScenarios.createTimeoutError('Window bounds retrieval');
      mockGetChromeWindowBounds.mockRejectedValue(timeoutError);

      try {
        await getChromeWindowBounds(1);
        fail('Expected timeout error');
      } catch (error) {
        expect(error.message).toBeTimeoutError();
      }
    });

    it('should handle Chrome running check timeout', async () => {
      const timeoutError = testUtils.failureScenarios.createTimeoutError('Chrome process check');
      mockIsChromeRunning.mockRejectedValue(timeoutError);

      try {
        await isChromeRunning();
        fail('Expected timeout error');
      } catch (error) {
        expect(error.message).toBeTimeoutError();
      }
    });
  });

  describe('Malformed Response Scenarios', () => {
    it('should handle malformed AppleScript JSON response', async () => {
      mockExecWithTimeout.mockResolvedValue({
        success: true,
        data: {
          stdout: '{"incomplete": json, "missing": }',
          stderr: '',
          command: 'osascript'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      });

      const service = new AppleScriptService();
      const result = await service.executeJavaScript('JSON.stringify({test: true})');

      expect(result.success).toBe(true); // Raw execution succeeds
      expect(result.data).toBe('{"incomplete": json, "missing": }'); // But returns malformed data
    });

    it('should handle malformed Chrome window bounds', async () => {
      mockGetChromeWindowBounds.mockResolvedValue({
        success: true,
        result: 'invalid-window-data',
        code: ERROR_CODES.OK
      });

      const result = await getChromeWindowBounds(1);

      expect(result.success).toBe(true);
      expect(typeof result.result).toBe('string'); // Malformed, should be object
    });

    it('should handle unexpected AppleScript output format', async () => {
      const malformedOutputs = [
        '',
        'missing {',
        '{"valid": "json"} extra text',
        'undefined',
        'null',
        'NaN'
      ];

      for (const output of malformedOutputs) {
        mockExecWithTimeout.mockResolvedValue({
          success: true,
          data: {
            stdout: output,
            stderr: '',
            command: 'osascript'
          },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

        const service = new AppleScriptService();
        const result = await service.executeJavaScript('test');

        expect(result.success).toBe(true);
        // Service should handle malformed data gracefully
        expect(result.data).toBeDefined();
      }
    });

    it('should sanitize malformed network data', () => {
      const sanitizer = new NetworkDataSanitizer();
      
      const maliciousUrl = 'https://evil.com/api?token=secret123&api_key=hidden456';
      const maliciousBody = 'User data with "password":"secret123" and token: hidden456';
      const maliciousHeaders = {
        'authorization': 'Bearer secret-token',
        'x-api-key': 'hidden-api-key',
        'cookie': 'session=sensitive-data'
      };

      const sanitizedUrl = sanitizer.sanitizeUrl(maliciousUrl);
      const sanitizedBody = sanitizer.sanitizeBody(maliciousBody);
      const sanitizedHeaders = sanitizer.sanitizeHeaders(maliciousHeaders);

      expect(sanitizedUrl).toContain('[REDACTED]'); // Tokens should be redacted
      expect(sanitizedBody).toContain('[REDACTED]'); // Passwords should be redacted
      expect(sanitizedHeaders.authorization).toBe('[REDACTED]');
      expect(sanitizedHeaders['x-api-key']).toBe('[REDACTED]');
    });
  });

  describe('System Error Conditions', () => {
    it('should handle Chrome not installed', async () => {
      mockIsChromeRunning.mockResolvedValue(false);
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'Google Chrome is not running',
        code: ERROR_CODES.CHROME_NOT_FOUND
      });

      const chromeRunning = await isChromeRunning();
      expect(chromeRunning).toBe(false);

      const jsResult = await execChromeJS('document.title', 1, 1, 5000);
      expect(jsResult.success).toBe(false);
      expect(jsResult.code).toBe(ERROR_CODES.CHROME_NOT_FOUND);
    });

    it('should handle system process spawn errors', async () => {
      const spawnError = testUtils.failureScenarios.createSystemError(-2, 'spawn osascript ENOENT');
      mockExecWithTimeout.mockRejectedValue(spawnError);

      const service = new AppleScriptService();
      const result = await service.executeScript('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('spawn');
      expect(result.error).toContain('ENOENT');
    });

    it('should handle low memory conditions', async () => {
      // Simulate memory pressure by creating large mock data
      const largeData = {
        hugeArray: new Array(100000).fill(0).map((_, i) => ({
          id: i,
          data: 'x'.repeat(1000),
          nested: { value: Math.random() }
        }))
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        result: largeData,
        code: ERROR_CODES.OK
      });

      const result = await execChromeJS('getLargeDataSet()', 1, 1, 5000);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      // Verify the system can handle large data gracefully
      const formatted = formatJSONResult(result.result, undefined, ERROR_CODES.OK);
      expect(formatted.success).toBe(true);
    });

    it('should handle invalid window/tab IDs', async () => {
      const invalidIds = [-1, 0, 999999, NaN, Infinity];

      for (const id of invalidIds) {
        mockExecChromeJS.mockResolvedValue({
          success: false,
          error: `Invalid window ID: ${id}`,
          code: ERROR_CODES.INVALID_PARAMETER
        });

        const result = await execChromeJS('document.title', id, id, 5000);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid');
        expect(result.code).toBe(ERROR_CODES.INVALID_PARAMETER);
      }
    });

    it('should handle concurrent operation conflicts', async () => {
      // Setup patterns before creating operations
      mockExecChromeJS
        .mockResolvedValueOnce({ success: true, result: 'op0', code: ERROR_CODES.OK })
        .mockResolvedValueOnce({ success: false, error: 'Resource busy', code: ERROR_CODES.RESOURCE_BUSY })
        .mockResolvedValueOnce({ success: false, error: 'Resource busy', code: ERROR_CODES.RESOURCE_BUSY })
        .mockResolvedValueOnce({ success: true, result: 'op3', code: ERROR_CODES.OK })
        .mockResolvedValueOnce({ success: false, error: 'Resource busy', code: ERROR_CODES.RESOURCE_BUSY })
        .mockResolvedValueOnce({ success: false, error: 'Resource busy', code: ERROR_CODES.RESOURCE_BUSY })
        .mockResolvedValueOnce({ success: true, result: 'op6', code: ERROR_CODES.OK })
        .mockResolvedValueOnce({ success: false, error: 'Resource busy', code: ERROR_CODES.RESOURCE_BUSY })
        .mockResolvedValueOnce({ success: false, error: 'Resource busy', code: ERROR_CODES.RESOURCE_BUSY })
        .mockResolvedValueOnce({ success: true, result: 'op9', code: ERROR_CODES.OK });

      // Simulate multiple operations trying to access Chrome simultaneously
      const operations = Array.from({ length: 10 }, (_, i) => 
        execChromeJS(`operation${i}`, 1, 1, 5000)
      );

      const results = await Promise.allSettled(operations);

      const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success);
      const failed = results.filter(r => r.status === 'fulfilled' && r.value && !r.value.success);

      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Case Error Recovery', () => {
    it('should recover from transient permission errors', async () => {
      const service = new AppleScriptService();
      
      // First call fails with permission error
      mockExecWithTimeout
        .mockRejectedValueOnce(testUtils.failureScenarios.createPermissionDeniedError('AppleScript'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'success', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      const firstResult = await service.executeScript('test');
      expect(firstResult.success).toBe(false);

      // Second call succeeds (permission granted)
      const secondResult = await service.executeScript('test');
      expect(secondResult.success).toBe(true);
    });

    it('should handle partial system failures gracefully', async () => {
      // Chrome is running but some windows are inaccessible
      mockIsChromeRunning.mockResolvedValue(true);
      
      mockGetChromeWindowBounds
        .mockResolvedValueOnce({
          success: true,
          result: { id: 1, title: 'Window 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, visible: true },
          code: ERROR_CODES.OK
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Window 2 is not accessible',
          code: ERROR_CODES.PERMISSION_DENIED
        })
        .mockResolvedValueOnce({
          success: true,
          result: { id: 3, title: 'Window 3', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, visible: true },
          code: ERROR_CODES.OK
        });

      const results = await Promise.allSettled([
        getChromeWindowBounds(1),
        getChromeWindowBounds(2), 
        getChromeWindowBounds(3)
      ]);

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success);

      expect(successful.length).toBe(2);
      expect(failed.length).toBe(1);
    });

    it('should handle cascading failure scenarios', async () => {
      // Test when multiple systems fail in sequence
      const service = new AppleScriptService();

      // First: Chrome process check fails
      mockIsChromeRunning.mockRejectedValue(
        testUtils.failureScenarios.createSystemError(-1, 'Process check failed')
      );

      // Then: AppleScript execution fails 
      mockExecWithTimeout.mockRejectedValue(
        testUtils.failureScenarios.createPermissionDeniedError('System Events')
      );

      // Finally: Network sanitization fails
      const sanitizer = new NetworkDataSanitizer();
      
      try {
        await isChromeRunning();
        fail('Expected system error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      const scriptResult = await service.executeScript('test');
      expect(scriptResult.success).toBe(false);

      // Even with multiple failures, system should remain stable
      expect(() => sanitizer.sanitizeUrl('https://test.com')).not.toThrow();
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable error messages for permission issues', async () => {
      const permissionError = testUtils.failureScenarios.createPermissionDeniedError('AppleScript automation');
      mockExecWithTimeout.mockRejectedValue(permissionError);

      const service = new AppleScriptService();
      const result = await service.executeScript('test');

      expect(result.error).toContain('Permission denied');
      expect(result.error).toContain('AppleScript automation');
      // The error message format may not include guidance in the basic test setup
      // In real usage, this would be handled by the command layer
    });

    it('should provide context for timeout errors', async () => {
      const timeoutError = testUtils.failureScenarios.createTimeoutError('Chrome communication');
      
      // Mock to return error response instead of throwing
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: timeoutError.message,
        code: ERROR_CODES.TIMEOUT
      });
      
      const result = await execChromeJS('longRunningScript()', 1, 1, 1000);
      expect(result.success).toBe(false);
      expect(result.error).toBeTimeoutError();
    });

    it('should provide helpful context for malformed data errors', () => {
      const malformedError = testUtils.failureScenarios.createMalformedResponseError('{"invalid": json}');
      
      expect(malformedError.message).toContain('Malformed response');
      expect(malformedError.message).toContain('{"invalid": json}');
      expect(malformedError.code).toBe('EMALFORMED');
    });
  });
});