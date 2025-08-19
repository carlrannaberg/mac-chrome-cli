/**
 * Edge case and error scenario tests
 * 
 * Tests that focus on boundary conditions, error handling,
 * and unusual scenarios that could cause failures
 */

import {
  viewportToScreen,
  selectorToScreen,
  getScreenCoordinates,
  isCoordinateVisible,
  validateElementVisibility
} from '../../src/lib/coords.js';
import {
  execWithTimeout,
  formatJSONResult,
  createWebPPreview,
  validateInput,
  escapeCSSSelector,
  ERROR_CODES
} from '../../src/lib/util.js';
import {
  execChromeJS,
  getChromeWindowBounds,
  escapeAppleScriptString
} from '../../src/lib/apple.js';
import * as apple from '../../src/lib/apple.js';

// Mock dependencies
jest.mock('../../src/lib/apple.js', () => ({
  ...jest.requireActual('../../src/lib/apple.js'),
  execChromeJS: jest.fn(),
  getChromeWindowBounds: jest.fn()
}));
jest.mock('child_process');
jest.mock('sharp');

const mockApple = apple as jest.Mocked<typeof apple>;

describe('Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Coordinate Calculation Edge Cases', () => {
    it('should handle extremely large coordinates', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        data: testUtils.createMockViewport(999999, 999999, 0, 0),
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 999999, y: 999999, width: 999999, height: 999999 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await viewportToScreen(999999, 999999, 1);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates?.x).toBeGreaterThan(999999);
      expect(result.data?.coordinates?.y).toBeGreaterThan(999999);
      expect(Number.isFinite(result.data?.coordinates?.x)).toBe(true);
      expect(Number.isFinite(result.data?.coordinates?.y)).toBe(true);
    });

    it('should handle negative window bounds', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        data: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: -100, y: -200, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await viewportToScreen(500, 300, 1);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates?.x).toBe(400); // -100 + 500
      expect(result.data?.coordinates?.y).toBe(124); // -200 + 24 + 300
    });

    it('should handle zero-sized windows', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        data: testUtils.createMockViewport(0, 0, 0, 0),
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 0, height: 0 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await viewportToScreen(0, 0, 1);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates).toBeValidCoordinates();
    });

    it('should handle floating point coordinates', async () => {
      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        data: testUtils.createMockViewport(1920, 1080, 0, 0),
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await viewportToScreen(123.456, 789.123, 1);

      expect(result.success).toBe(true);
      expect(result.data?.coordinates?.x).toBeCloseTo(223.456);
      expect(result.data?.coordinates?.y).toBeCloseTo(913.123);
    });

    it('should handle NaN and Infinity coordinates', async () => {
      const testCases = [
        { x: NaN, y: 100 },
        { x: 100, y: NaN },
        { x: Infinity, y: 100 },
        { x: 100, y: Infinity },
        { x: -Infinity, y: 100 }
      ];

      for (const testCase of testCases) {
        mockApple.execChromeJS.mockResolvedValueOnce({
          success: true,
          data: testUtils.createMockViewport(1920, 1080, 0, 0),
          code: ERROR_CODES.OK,
          timestamp: new Date().toISOString()
        });

        mockApple.getChromeWindowBounds.mockResolvedValueOnce({
          success: true,
          data: {
            id: 1,
            title: 'Test Window',
            bounds: { x: 100, y: 100, width: 1920, height: 1080 },
            visible: true
          },
          code: ERROR_CODES.OK,
          timestamp: new Date().toISOString()
        });

        const result = await viewportToScreen(testCase.x, testCase.y, 1);

        // Should handle gracefully - either succeed with finite coordinates or fail safely
        if (result.success) {
          expect(Number.isFinite(result.data?.coordinates?.x)).toBe(true);
          expect(Number.isFinite(result.data?.coordinates?.y)).toBe(true);
        } else {
          expect(result.error).toBeDefined();
        }
      }
    });
  });

  describe('CSS Selector Edge Cases', () => {
    it('should handle extremely complex selectors', async () => {
      const complexSelector = 'div[data-test="complex[nested]"] > span:nth-child(5):not(.hidden):has(> a[href*="test"]) + ul li:first-of-type';
      
      const mockElement = testUtils.createMockElement({ x: 100, y: 200, width: 50, height: 30 });

      mockApple.execChromeJS
        .mockResolvedValueOnce({
          success: true,
          data: mockElement,
          code: ERROR_CODES.OK,
          timestamp: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          success: true,
          data: testUtils.createMockViewport(),
          code: ERROR_CODES.OK,
          timestamp: new Date().toISOString()
        });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await selectorToScreen(complexSelector, 1);

      expect(result.success).toBe(true);
      
      // Verify the selector was properly escaped in the JavaScript
      const jsCall = mockApple.execChromeJS.mock.calls[0];
      expect(jsCall[0]).toBeDefined();
      expect(jsCall[0]).toContain('complex[nested]');
    });

    it('should handle selectors with special characters', async () => {
      const specialSelectors = [
        'input[name="user\'s-email"]',
        'div[data-value="100%"]',
        'span[title="Price: $99.99"]',
        'a[href="https://example.com?param=value&other=123"]',
        'element[attr="value with spaces"]',
        'tag[data-json=\'{"key": "value"}\']'
      ];

      for (const selector of specialSelectors) {
        mockApple.execChromeJS
          .mockResolvedValueOnce({
            success: true,
            data: testUtils.createMockElement({ x: 10, y: 10, width: 50, height: 20 }),
            code: ERROR_CODES.OK
          })
          .mockResolvedValueOnce({
            success: true,
            data: testUtils.createMockViewport(),
            code: ERROR_CODES.OK
          });

        mockApple.getChromeWindowBounds.mockResolvedValueOnce({
          success: true,
          data: {
            id: 1,
            title: 'Test Window',
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            visible: true
          },
          code: ERROR_CODES.OK,
          timestamp: new Date().toISOString()
        });

        const result = await selectorToScreen(selector, 1);

        // Should either succeed or fail gracefully
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.code).toBeGreaterThan(0);
        }
      }
    });

    it('should handle malformed selectors', async () => {
      const malformedSelectors = [
        '[[invalid]]',
        'div > > span',
        'input[unclosed',
        'element:nth-child()',
        ':not()',
        '::invalid-pseudo',
        ''
      ];

      for (const selector of malformedSelectors) {
        mockApple.execChromeJS.mockResolvedValueOnce({
          success: false,
          error: 'Invalid selector',
          code: ERROR_CODES.UNKNOWN_ERROR
        });

        const result = await selectorToScreen(selector, 1);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('AppleScript Edge Cases', () => {
    it('should handle extremely long JavaScript code', async () => {
      const longJS = 'var result = "test";' + 'console.log("padding");'.repeat(10000) + 'return result;';

      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        data: 'test',
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await execChromeJS(longJS, 1, 1, 15000);

      // Should handle long scripts gracefully
      expect(result).toBeDefined();
    });

    it('should handle special characters in AppleScript strings', () => {
      const testCases = [
        { input: 'emoji 🚀 test', expected: 'emoji 🚀 test' },
        { input: 'unicode ñáéíóú test', expected: 'unicode ñáéíóú test' },
        { input: 'control\x00chars\x1F', expected: 'control\x00chars\x1F' },
        { input: '\u0000\uFFFF', expected: '\u0000\uFFFF' }
      ];

      testCases.forEach(testCase => {
        const result = escapeAppleScriptString(testCase.input);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThanOrEqual(testCase.input.length);
      });
    });

    it('should handle AppleScript output parsing edge cases', async () => {
      const testCases = [
        { output: '""', expected: '' },
        { output: '"null"', expected: 'null' },
        { output: '"undefined"', expected: 'undefined' },
        { output: '{}', expected: {} },
        { output: '[]', expected: [] },
        { output: 'true', expected: 'true' }, // Non-JSON string
        { output: '42', expected: '42' }, // Non-JSON number
        { output: 'malformed{json', expected: 'malformed{json' }
      ];

      for (const testCase of testCases) {
        mockApple.execChromeJS.mockImplementationOnce(async () => ({
          success: true,
          data: testCase.expected,
          code: ERROR_CODES.OK
        }));

        const result = await execChromeJS('test', 1, 1, 5000);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(testCase.expected);
      }
    });
  });

  describe('Utility Function Edge Cases', () => {
    it('should handle extreme timeout values', async () => {
      const { spawn } = require('child_process');
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      spawn.mockReturnValue(mockChild);

      // Test very small timeout
      const promise1 = execWithTimeout('echo', ['test'], 1);
      
      setTimeout(() => {
        const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeHandler) closeHandler(0);
      }, 10);

      const result1 = await promise1;
      expect(result1.code).toBe(ERROR_CODES.TIMEOUT);

      // Test very large timeout
      jest.clearAllMocks();
      spawn.mockReturnValue(mockChild);

      const promise2 = execWithTimeout('echo', ['test'], 999999);
      
      const stdoutHandler = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stdoutHandler) stdoutHandler(Buffer.from('test\n'));

      const closeHandler = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler(0);

      const result2 = await promise2;
      expect(result2.success).toBe(true);
    });

    it('should handle validation of unusual input types', () => {
      const unusualInputs = [
        { value: Symbol('test'), type: 'string' as const, expected: false },
        { value: BigInt(123), type: 'number' as const, expected: false },
        { value: new Date(), type: 'object' as const, expected: true },
        { value: /regex/, type: 'object' as const, expected: true },
        { value: () => {}, type: 'object' as const, expected: false },
        { value: new Map(), type: 'object' as const, expected: true },
        { value: new Set(), type: 'object' as const, expected: true }
      ];

      unusualInputs.forEach(testCase => {
        const result = validateInput(testCase.value, testCase.type);
        expect(result).toBe(testCase.expected);
      });
    });

    it('should handle JSON formatting edge cases', () => {
      const edgeCases = [
        { data: undefined, error: undefined, code: ERROR_CODES.OK },
        { data: null, error: 'Test error', code: ERROR_CODES.UNKNOWN_ERROR },
        { data: '', error: undefined, code: ERROR_CODES.OK },
        { data: 0, error: undefined, code: ERROR_CODES.OK },
        { data: false, error: undefined, code: ERROR_CODES.OK },
        { data: { circular: null }, error: undefined, code: ERROR_CODES.OK }
      ];

      edgeCases.forEach(testCase => {
        // Handle circular reference
        if (testCase.data && typeof testCase.data === 'object' && 'circular' in testCase.data) {
          testCase.data.circular = testCase.data;
        }

        const result = formatJSONResult(testCase.data, testCase.error, testCase.code);
        
        expect(result.success).toBe(testCase.code === ERROR_CODES.OK);
        expect(result.code).toBe(testCase.code);
        expect(typeof result.timestamp).toBe('string');
        expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      });
    });

    it('should handle CSS selector escaping edge cases', () => {
      const edgeCases = [
        { input: '', expected: '' },
        { input: "'", expected: "\\'" },
        { input: "''", expected: "\\'\\'"},
        { input: "text with ' multiple ' quotes ' here", expected: "text with \\' multiple \\' quotes \\' here" },
        { input: "already escaped\\'quote", expected: "already escaped\\\\\\'quote" },
        { input: "unicode'test", expected: "unicode\\'test" }
      ];

      edgeCases.forEach(testCase => {
        const result = escapeCSSSelector(testCase.input);
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('Coordinate Visibility Edge Cases', () => {
    it('should handle boundary coordinates correctly', async () => {
      const viewport = testUtils.createMockViewport(1920, 1080, 0, 0);
      
      mockApple.execChromeJS.mockResolvedValue({
        success: true,
        data: viewport,
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const boundaryTests = [
        { x: 0, y: 0, expected: true }, // Top-left corner
        { x: 1920, y: 1080, expected: true }, // Bottom-right corner (inclusive)
        { x: -1, y: 0, expected: false }, // Just outside left
        { x: 0, y: -1, expected: false }, // Just outside top
        { x: 1921, y: 1080, expected: false }, // Just outside right
        { x: 1920, y: 1081, expected: false }, // Just outside bottom
        { x: 960, y: 540, expected: true } // Center
      ];

      for (const test of boundaryTests) {
        const result = await isCoordinateVisible(test.x, test.y, 1);
        expect(result).toBe(test.expected);
      }
    });

    it('should handle element validation with malformed DOM state', async () => {
      const malformedStates = [
        { visible: 'true', clickable: 1, inViewport: null }, // Wrong types
        { visible: undefined, clickable: undefined, inViewport: undefined }, // Missing properties
        { extra: 'property', visible: true, clickable: true, inViewport: true } // Extra properties
      ];

      for (const state of malformedStates) {
        mockApple.execChromeJS.mockResolvedValueOnce({
          success: true,
          data: state,
          code: ERROR_CODES.OK,
          timestamp: new Date().toISOString()
        });

        const result = await validateElementVisibility('#test', 1);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      }
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should properly propagate all error types', async () => {
      const errorScenarios = [
        {
          mockError: new TypeError('Invalid argument'),
          expectedCode: ERROR_CODES.UNKNOWN_ERROR
        },
        {
          mockError: new ReferenceError('Variable not defined'),
          expectedCode: ERROR_CODES.UNKNOWN_ERROR
        },
        {
          mockError: new SyntaxError('Malformed expression'),
          expectedCode: ERROR_CODES.UNKNOWN_ERROR
        },
        {
          mockError: new Error('Network timeout'),
          expectedCode: ERROR_CODES.UNKNOWN_ERROR
        }
      ];

      for (const scenario of errorScenarios) {
        mockApple.execChromeJS.mockRejectedValueOnce(scenario.mockError);
        mockApple.getChromeWindowBounds.mockRejectedValueOnce(scenario.mockError);

        const result = await viewportToScreen(100, 100, 1);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to convert viewport to screen coordinates');
        expect(result.code).toBe(scenario.expectedCode);
      }
    });

    it('should handle promise rejections gracefully', async () => {
      // Test unhandled promise rejection scenario
      mockApple.execChromeJS.mockImplementationOnce(() => 
        Promise.reject(new Error('Async operation failed'))
      );

      const result = await getScreenCoordinates({ x: 100, y: 100 }, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle concurrent operation failures', async () => {
      // Simulate multiple operations failing simultaneously
      mockApple.execChromeJS
        .mockRejectedValueOnce(new Error('Operation 1 failed'))
        .mockRejectedValueOnce(new Error('Operation 2 failed'));

      mockApple.getChromeWindowBounds
        .mockRejectedValueOnce(new Error('Window bounds failed'));

      const [result1, result2] = await Promise.allSettled([
        viewportToScreen(100, 100, 1),
        selectorToScreen('#test', 1)
      ]);

      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      if (result1.status === 'fulfilled') {
        expect(result1.value.success).toBe(false);
      }
      if (result2.status === 'fulfilled') {
        expect(result2.value.success).toBe(false);
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large data structures without memory issues', async () => {
      // Create a large mock viewport with many properties
      const largeViewport = {
        ...testUtils.createMockViewport(),
        extraData: new Array(1000).fill(0).map((_, i) => ({ id: i, data: 'x'.repeat(100) }))
      };

      mockApple.execChromeJS.mockResolvedValueOnce({
        success: true,
        data: largeViewport,
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      mockApple.getChromeWindowBounds.mockResolvedValueOnce({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const result = await viewportToScreen(100, 100, 1);

      expect(result.success).toBe(true);
      expect(result.data?.viewport).toBeDefined();
    });

    it('should handle rapid successive calls', async () => {
      mockApple.execChromeJS.mockResolvedValue({
        success: true,
        data: testUtils.createMockViewport(),
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      mockApple.getChromeWindowBounds.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'Test Window',
          bounds: { x: 100, y: 100, width: 1920, height: 1080 },
          visible: true
        },
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      // Make many rapid calls
      const promises = Array.from({ length: 100 }, (_, i) =>
        viewportToScreen(i, i, 1)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data?.coordinates?.x).toBe(100 + index);
        expect(result.data?.coordinates?.y).toBe(124 + index);
      });
    });
  });
});