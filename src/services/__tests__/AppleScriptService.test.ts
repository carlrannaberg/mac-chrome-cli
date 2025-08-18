import { AppleScriptService, appleScriptService } from '../AppleScriptService.js';
import { ERROR_CODES } from '../../lib/util.js';

// Mock the external dependencies
jest.mock('../../lib/util.js', () => ({
  ...jest.requireActual('../../lib/util.js'),
  execWithTimeout: jest.fn()
}));

jest.mock('../../lib/performance.js', () => ({
  startBenchmark: jest.fn(() => 'test-benchmark'),
  endBenchmark: jest.fn()
}));

jest.mock('../../security/DataSanitizer.js', () => ({
  NetworkDataSanitizer: jest.fn().mockImplementation(() => ({}))
}));

import { execWithTimeout } from '../../lib/util.js';
const mockExecWithTimeout = execWithTimeout as jest.MockedFunction<typeof execWithTimeout>;

describe('AppleScriptService', () => {
  let service: AppleScriptService;

  beforeEach(() => {
    service = new AppleScriptService();
    mockExecWithTimeout.mockClear();
  });

  afterEach(() => {
    service.clearCaches();
  });

  describe('escapeAppleScriptString', () => {
    it('should escape special characters in AppleScript strings', () => {
      const testCases = [
        { input: 'simple text', expected: 'simple text' },
        { input: 'text with "quotes"', expected: 'text with \\"quotes\\"' },
        { input: 'text with\nNewline', expected: 'text with\\nNewline' },
        { input: 'text with\tTab', expected: 'text with\\tTab' },
        { input: 'text with\\Backslash', expected: 'text with\\\\Backslash' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(service.escapeAppleScriptString(input)).toBe(expected);
      });
    });

    it('should handle null and undefined values', () => {
      expect(service.escapeAppleScriptString(null as unknown as string)).toBe('');
      expect(service.escapeAppleScriptString(undefined as unknown as string)).toBe('');
    });
  });

  describe('executeScript', () => {
    it('should execute AppleScript successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: 'Success result',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.executeScript('tell application "test"\nend tell');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('Success result');
      expect(result.code).toBe(ERROR_CODES.OK);
    });

    it('should handle AppleScript permission errors', async () => {
      const mockResult = {
        success: false,
        error: 'not authorized to access application',
        code: ERROR_CODES.PERMISSION_DENIED,
        data: undefined,
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.executeScript('tell application "test"\nend tell');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('AppleScript automation permission denied');
      expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    });

    it('should handle Chrome not running errors', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: 'ERROR: Chrome is not running',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.executeScript('tell application "Google Chrome"\nend tell');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Google Chrome is not running');
      expect(result.code).toBe(ERROR_CODES.CHROME_NOT_FOUND);
    });
  });

  describe('executeJavaScript', () => {
    it('should execute JavaScript in Chrome successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: '{"result": "test"}',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.executeJavaScript('console.log("test")');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'test' });
      expect(result.code).toBe(ERROR_CODES.OK);
    });

    it('should handle non-JSON responses', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: 'plain text result',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.executeJavaScript('document.title');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('plain text result');
    });
  });

  describe('performance and caching', () => {
    it('should track performance statistics', () => {
      const stats = service.getPerformanceStats();
      
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('executionCount');
    });

    it('should clear caches properly', () => {
      service.clearCaches();
      const stats = service.getPerformanceStats();
      
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.executionCount).toBe(0);
    });
  });

  describe('Chrome-specific methods', () => {
    it('should check if Chrome is running', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: 'true',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.isChromeRunning();
      
      expect(result).toBe(true);
    });

    it('should focus Chrome window successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: 'true',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const result = await service.focusChromeWindow(1);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(result.code).toBe(ERROR_CODES.OK);
    });
  });

  describe('singleton instance', () => {
    it('should provide a singleton instance', () => {
      expect(appleScriptService).toBeInstanceOf(AppleScriptService);
    });
  });

  describe('batch operations', () => {
    it('should execute batch operations', async () => {
      const mockResult = {
        success: true,
        data: {
          stdout: 'success',
          stderr: '',
          command: 'osascript -e test'
        },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      };
      
      mockExecWithTimeout.mockResolvedValue(mockResult);
      
      const operations = [
        { script: 'tell application "test1"\nend tell' },
        { script: 'tell application "test2"\nend tell' }
      ];
      
      const results = await service.executeBatch(operations);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});
