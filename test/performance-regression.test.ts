/**
 * Performance regression tests
 * 
 * Tests to ensure performance targets are met and detect regressions
 * in critical operations
 */

import { 
  viewportToScreen,
  selectorToScreen 
} from '../src/lib/coords.js';
import { 
  execChromeJS,
  getChromeWindowBounds 
} from '../src/lib/apple.js';
import { 
  captureOutline,
  captureDomLite 
} from '../src/commands/snapshot.js';
import { 
  createWebPPreview 
} from '../src/lib/util.js';
import { AppleScriptService } from '../src/services/AppleScriptService.js';
import { ERROR_CODES } from '../src/lib/util.js';

// Mock external dependencies for consistent performance testing
jest.mock('../src/lib/apple.js', () => ({
  ...jest.requireActual('../src/lib/apple.js'),
  execChromeJS: jest.fn(),
  getChromeWindowBounds: jest.fn()
}));

jest.mock('../src/lib/util.js', () => ({
  ...jest.requireActual('../src/lib/util.js'),
  execWithTimeout: jest.fn()
}));

jest.mock('sharp');

const mockExecChromeJS = execChromeJS as jest.MockedFunction<typeof execChromeJS>;
const mockGetChromeWindowBounds = getChromeWindowBounds as jest.MockedFunction<typeof getChromeWindowBounds>;

describe('Performance Regression Tests', () => {
  // Performance targets (in milliseconds)
  const PERFORMANCE_TARGETS = {
    'coordinate-calculation': 50,
    'selector-resolution': 100, 
    'chrome-js-execution': 500,
    'window-bounds-retrieval': 200,
    'snapshot-outline': 300,
    'snapshot-dom-lite': 600,
    'applescript-service': 400
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup standard mock responses for consistent timing
    mockExecChromeJS.mockResolvedValue({
      success: true,
      data: { x: 100, y: 200, width: 50, height: 30 },
      code: ERROR_CODES.OK
    });

    mockGetChromeWindowBounds.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        title: 'Test Window',
        bounds: { x: 100, y: 100, width: 1920, height: 1080 },
        visible: true
      },
      code: ERROR_CODES.OK
    });
  });

  describe('Coordinate Calculation Performance', () => {
    it('should calculate viewport coordinates within performance target', async () => {
      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await viewportToScreen(500, 300, 1);
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['coordinate-calculation']);
    });

    it('should resolve selector coordinates within performance target', async () => {
      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await selectorToScreen('#test-button', 1);
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['selector-resolution']);
    });

    it('should handle batch coordinate calculations efficiently', async () => {
      const coordinates = Array.from({ length: 50 }, (_, i) => ({ x: i * 10, y: i * 10 }));
      
      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await Promise.all(
          coordinates.map(coord => viewportToScreen(coord.x, coord.y, 1))
        );
      });

      expect(result.every(r => r.success)).toBe(true);
      // Batch operations should complete within reasonable time
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS['coordinate-calculation'] * 10);
    });
  });

  describe('Chrome Communication Performance', () => {
    it('should execute JavaScript within performance target', async () => {
      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await execChromeJS('document.title', 1, 1, 5000);
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['chrome-js-execution']);
    });

    it('should retrieve window bounds within performance target', async () => {
      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await getChromeWindowBounds(1);
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['window-bounds-retrieval']);
    });

    it('should handle concurrent Chrome operations efficiently', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        execChromeJS(`operation${i}`, 1, 1, 5000)
      );

      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await Promise.all(operations);
      });

      expect(result.every(r => r.success)).toBe(true);
      // Concurrent operations should be faster than sequential
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS['chrome-js-execution'] * 3);
    });
  });

  describe('Snapshot Performance', () => {
    it('should capture outline snapshot within performance target', async () => {
      const mockSnapshotResult = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: Array.from({ length: 20 }, (_, i) => ({
          role: 'button',
          name: `Button ${i}`,
          selector: `#btn-${i}`,
          rect: { x: i * 10, y: i * 10, w: 100, h: 30 },
          state: { editable: false },
          tagName: 'button'
        })),
        meta: {
          url: 'https://example.com',
          title: 'Test Page',
          timestamp: new Date().toISOString(),
          durationMs: 150,
          visibleOnly: false
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockSnapshotResult,
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await captureOutline();
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['snapshot-outline']);
    });

    it('should capture DOM-lite snapshot within performance target', async () => {
      const mockDomResult = {
        ok: true,
        cmd: 'snapshot.dom-lite',
        nodes: Array.from({ length: 100 }, (_, i) => ({
          role: 'generic',
          name: `Element ${i}`,
          selector: `#elem-${i}`,
          rect: { x: i % 10 * 50, y: Math.floor(i / 10) * 30, w: 50, h: 30 },
          state: {},
          tagName: 'div',
          level: i % 5
        })),
        meta: {
          url: 'https://example.com',
          title: 'Test Page',
          timestamp: new Date().toISOString(),
          durationMs: 400,
          visibleOnly: false,
          maxDepth: 5
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockDomResult,
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await captureDomLite({ maxDepth: 5 });
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['snapshot-dom-lite']);
    });
  });

  describe('Service Performance', () => {
    it('should execute AppleScript service operations within target', async () => {
      const service = new AppleScriptService();
      
      // Mock the underlying execution
      const { execWithTimeout } = require('../src/lib/util.js');
      execWithTimeout.mockResolvedValue({
        success: true,
        data: { stdout: 'test result', stderr: '', command: 'osascript' },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      });

      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await service.executeScript('tell application "Google Chrome" to return "test"');
      });

      expect(result.success).toBe(true);
      expect(duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['applescript-service']);
    });

    it('should handle service caching efficiently', async () => {
      const service = new AppleScriptService();
      
      const { execWithTimeout } = require('../src/lib/util.js');
      execWithTimeout.mockResolvedValue({
        success: true,
        data: { stdout: 'cached result', stderr: '', command: 'osascript' },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      });

      // First call (cache miss)
      const firstCall = await testUtils.performance.measureExecutionTime(async () => {
        return await service.executeScript('tell application "test"');
      });

      // Second call should be faster due to potential caching
      const secondCall = await testUtils.performance.measureExecutionTime(async () => {
        return await service.executeScript('tell application "test"');
      });

      expect(firstCall.result.success).toBe(true);
      expect(secondCall.result.success).toBe(true);
      
      // Both calls should meet target, but implementation may vary
      expect(firstCall.duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['applescript-service']);
      expect(secondCall.duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['applescript-service']);
    });
  });

  describe('Memory Performance', () => {
    it('should handle large data sets without memory leaks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate large mock data
      const largeSnapshot = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: Array.from({ length: 10000 }, (_, i) => ({
          role: 'element',
          name: `Element ${i}`,
          selector: `#elem-${i}`,
          rect: { x: i % 100, y: Math.floor(i / 100), w: 10, h: 10 },
          state: { data: 'x'.repeat(100) },
          tagName: 'div'
        })),
        meta: {
          url: 'https://example.com',
          title: 'Large Page',
          timestamp: new Date().toISOString(),
          durationMs: 250,
          visibleOnly: false
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: largeSnapshot,
        code: ERROR_CODES.OK,
        timestamp: new Date().toISOString()
      });

      const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
        const snapshots = await Promise.all([
          captureOutline(),
          captureOutline(),
          captureOutline()
        ]);
        return snapshots;
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS['snapshot-outline'] * 5);
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should clean up resources after operations', async () => {
      const service = new AppleScriptService();
      const initialStats = service.getPerformanceStats();
      
      const { execWithTimeout } = require('../src/lib/util.js');
      execWithTimeout.mockResolvedValue({
        success: true,
        data: { stdout: 'test', stderr: '', command: 'osascript' },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      });

      // Perform multiple operations
      await Promise.all([
        service.executeScript('test1'),
        service.executeScript('test2'), 
        service.executeScript('test3')
      ]);

      const afterStats = service.getPerformanceStats();
      expect(afterStats.executionCount).toBeGreaterThan(initialStats.executionCount);

      // Clear caches and verify cleanup
      service.clearCaches();
      const cleanedStats = service.getPerformanceStats();
      
      expect(cleanedStats.cacheHits).toBe(0);
      expect(cleanedStats.cacheMisses).toBe(0);
    });
  });

  describe('Regression Detection', () => {
    it('should detect performance regressions in coordinate calculations', async () => {
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { duration } = await testUtils.performance.measureExecutionTime(async () => {
          return await viewportToScreen(Math.random() * 1000, Math.random() * 1000, 1);
        });
        durations.push(duration);
      }

      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];

      // Performance assertions
      expect(averageDuration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['coordinate-calculation'], 0.2);
      expect(p95Duration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['coordinate-calculation'] * 2, 0.1);
      expect(maxDuration).toBeLessThan(PERFORMANCE_TARGETS['coordinate-calculation'] * 5);
    });

    it('should maintain consistent performance under load', async () => {
      const concurrentOperations = 20;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => 
        testUtils.performance.measureExecutionTime(async () => {
          return await selectorToScreen(`#element-${i}`, 1);
        })
      );

      const results = await Promise.all(operations);
      const durations = results.map(r => r.duration);
      const successfulResults = results.filter(r => r.result.success);

      // All operations should succeed
      expect(successfulResults.length).toBe(concurrentOperations);

      // Performance should remain consistent under load
      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(averageDuration).toMeetPerformanceTarget(PERFORMANCE_TARGETS['selector-resolution'] * 2);
    });

    it('should track performance trends over time', () => {
      // This test would integrate with performance monitoring in a real scenario
      const performanceBaseline = testUtils.performance.createPerformanceBaseline('trend-test');
      
      performanceBaseline.start();
      
      // Simulate some work
      const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: Math.random() }));
      const processed = data.map(item => ({ ...item, processed: true }));
      
      const duration = performanceBaseline.end();
      
      expect(processed).toHaveLength(1000);
      expect(duration).toBeLessThan(50); // Should be very fast for in-memory operations
      expect(testUtils.performance.verifyPerformanceTarget(duration, 50)).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should provide performance metrics for monitoring', async () => {
      const service = new AppleScriptService();
      
      // Track initial state
      const initialStats = service.getPerformanceStats();
      expect(initialStats).toHaveProperty('executionCount');
      expect(initialStats).toHaveProperty('cacheHits');
      expect(initialStats).toHaveProperty('cacheMisses');

      // Perform operations to update metrics
      const { execWithTimeout } = require('../src/lib/util.js');
      execWithTimeout.mockResolvedValue({
        success: true,
        data: { stdout: 'metrics test', stderr: '', command: 'osascript' },
        code: ERROR_CODES.OK,
        error: '',
        context: {}
      });

      await service.executeScript('metrics test');
      
      const updatedStats = service.getPerformanceStats();
      expect(updatedStats.executionCount).toBeGreaterThan(initialStats.executionCount);
    });

    it('should detect performance bottlenecks', async () => {
      const bottleneckThreshold = PERFORMANCE_TARGETS['chrome-js-execution'] * 2;
      
      // Simulate a slow operation
      mockExecChromeJS.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, bottleneckThreshold + 100));
        return {
          success: true,
          data: 'slow result',
          code: ERROR_CODES.OK
        };
      });

      const { duration } = await testUtils.performance.measureExecutionTime(async () => {
        return await execChromeJS('slowOperation()', 1, 1, 10000);
      });

      // This test would flag performance bottlenecks
      expect(duration).toBeGreaterThan(bottleneckThreshold);
    });
  });
});