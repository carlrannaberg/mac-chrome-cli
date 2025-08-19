import { domEval, formatDomEvalResult } from '../dom';
import { ERROR_CODES } from '../../lib/util';

// Mock the execChromeJS function
jest.mock('../../lib/apple', () => ({
  execChromeJS: jest.fn()
}));

import { execChromeJS } from '../../lib/apple';
const mockExecChromeJS = execChromeJS as jest.MockedFunction<typeof execChromeJS>;

describe('DOM Evaluation Command', () => {
  beforeEach(() => {
    mockExecChromeJS.mockClear();
  });

  describe('domEval', () => {
    it('should validate required JavaScript input', async () => {
      const result = await domEval({ js: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('JavaScript code is required');
      expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
    });

    it('should reject dangerous JavaScript patterns', async () => {
      const dangerousPatterns = [
        'eval("malicious code")',
        'Function("return process")()',
        'setTimeout(() => {}, 1000)',
        'delete window.something',
        '__proto__.constructor'
      ];

      for (const pattern of dangerousPatterns) {
        const result = await domEval({ js: pattern });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('dangerous patterns');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      }
    });

    it('should execute simple JavaScript expressions successfully', async () => {
      const mockResult = {
        success: true,
        result: 'Hello World',
        executionTimeMs: 5,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockResult,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      });

      const result = await domEval({ js: '"Hello World"' });
      
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
      expect(result.data?.result).toBe('Hello World');
      expect(result.data?.meta.executionTimeMs).toBe(5);
    });

    it('should handle JavaScript execution errors gracefully', async () => {
      const mockResult = {
        success: false,
        error: 'ReferenceError: undefined_variable is not defined',
        executionTimeMs: 2,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockResult,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      });

      const result = await domEval({ js: 'undefined_variable' });
      
      expect(result.success).toBe(true); // Chrome execution succeeded
      expect(result.data?.success).toBe(false); // JS execution failed
      expect(result.data?.error).toContain('ReferenceError');
    });

    it('should handle Chrome execution failures', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'Chrome is not running',
        code: ERROR_CODES.CHROME_NOT_FOUND
      });

      const result = await domEval({ js: 'document.title' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome is not running');
      expect(result.code).toBe(ERROR_CODES.CHROME_NOT_FOUND);
    });

    it('should handle complex objects and serialize them properly', async () => {
      const mockResult = {
        success: true,
        result: { title: 'Test Page', url: 'https://example.com' },
        executionTimeMs: 10,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockResult,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      });

      const result = await domEval({ js: '({ title: document.title, url: location.href })' });
      
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
      expect(result.data?.result).toEqual({ title: 'Test Page', url: 'https://example.com' });
    });

    it('should respect custom tab and window indices', async () => {
      const mockResult = {
        success: true,
        result: 'tab 2 result',
        executionTimeMs: 5,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        result: mockResult,
        code: ERROR_CODES.OK
      });

      await domEval({ 
        js: 'document.title', 
        tabIndex: 2, 
        windowIndex: 3,
        timeout: 5000
      });
      
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.any(String), // wrapped script
        2, // tabIndex
        3, // windowIndex
        5000 // timeout
      );
    });
  });

  describe('formatDomEvalResult', () => {
    it('should format successful results correctly', () => {
      const mockResult = {
        success: true,
        result: 'test result',
        meta: {
          executionTimeMs: 5,
          timestamp: '2024-01-01T00:00:00.000Z',
          resultSize: 11,
          truncated: false
        }
      };

      const jsResult = {
        success: true,
        data: mockResult,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const formatted = formatDomEvalResult(jsResult);
      
      expect(formatted.success).toBe(true);
      expect(formatted.data).toEqual(mockResult);
      expect(formatted.code).toBe(ERROR_CODES.OK);
    });

    it('should format failure results correctly', () => {
      const jsResult = {
        success: false,
        error: 'Test error',
        code: ERROR_CODES.UNKNOWN_ERROR,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const formatted = formatDomEvalResult(jsResult);
      
      expect(formatted.success).toBe(false);
      expect(formatted.error).toBe('Test error');
      expect(formatted.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(formatted.data).toBeUndefined();
    });

    it('should handle missing result data', () => {
      const jsResult = {
        success: true,
        data: undefined,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const formatted = formatDomEvalResult(jsResult);
      
      expect(formatted.success).toBe(false);
      expect(formatted.error).toBe('No evaluation result returned');
      expect(formatted.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });
  });
});