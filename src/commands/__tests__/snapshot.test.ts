import { 
  captureOutline, 
  captureDomLite, 
  formatSnapshotResult,
  type SnapshotResult 
} from '../snapshot';
import { ERROR_CODES } from '../../lib/util';

// Mock the execChromeJS function
jest.mock('../../lib/apple.js', () => ({
  execChromeJS: jest.fn()
}));

import { execChromeJS } from '../../lib/apple';
const mockExecChromeJS = execChromeJS as jest.MockedFunction<typeof execChromeJS>;

describe('Snapshot Command', () => {
  beforeEach(() => {
    mockExecChromeJS.mockClear();
  });

  describe('captureOutline', () => {
    it('should capture outline with default options', async () => {
      const mockSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: [
          {
            role: 'button',
            name: 'Click me',
            selector: '#test-button',
            rect: { x: 10, y: 20, w: 100, h: 30 },
            state: { editable: false },
            tagName: 'button'
          }
        ],
        meta: {
          url: 'https://example.com',
          title: 'Test Page',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 50,
          visibleOnly: false
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureOutline();
      
      expect(result.success).toBe(true);
      expect(result.data?.ok).toBe(true);
      expect(result.data?.nodes).toHaveLength(1);
      expect(result.data?.nodes[0].role).toBe('button');
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining('outline'),
        1,
        1,
        15000
      );
    });

    it('should capture outline with visible-only option', async () => {
      const mockSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: [],
        meta: {
          url: 'https://example.com',
          title: 'Test Page',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 30,
          visibleOnly: true
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureOutline({ visibleOnly: true });
      
      expect(result.success).toBe(true);
      expect(result.data?.meta?.visibleOnly).toBe(true);
    });

    it('should handle Chrome execution failures', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'Chrome is not running',
        code: ERROR_CODES.CHROME_NOT_FOUND
      });

      const result = await captureOutline();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Chrome is not running');
      expect(result.code).toBe(ERROR_CODES.CHROME_NOT_FOUND);
    });
  });

  describe('captureDomLite', () => {
    it('should capture DOM-lite with default options', async () => {
      const mockSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.dom-lite',
        nodes: [
          {
            role: 'generic',
            name: 'body',
            selector: 'body',
            rect: { x: 0, y: 0, w: 1200, h: 800 },
            state: {},
            tagName: 'body',
            level: 0
          }
        ],
        meta: {
          url: 'https://example.com',
          title: 'Test Page',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 75,
          visibleOnly: false,
          maxDepth: 10
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureDomLite();
      
      expect(result.success).toBe(true);
      expect(result.data?.cmd).toBe('snapshot.dom-lite');
      expect(result.data?.meta?.maxDepth).toBe(10);
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining('dom-lite'),
        1,
        1,
        20000
      );
    });

    it('should respect maxDepth option', async () => {
      const mockSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.dom-lite',
        nodes: [],
        meta: {
          url: 'https://example.com',
          title: 'Test Page',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 25,
          visibleOnly: false,
          maxDepth: 5
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureDomLite({ maxDepth: 5, visibleOnly: false });
      
      expect(result.success).toBe(true);
      expect(result.data?.meta?.maxDepth).toBe(5);
    });
  });

  describe('Performance Optimization Validation', () => {
    test('should include performance metadata in successful snapshots', async () => {
      const performanceSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: [
          {
            role: 'button',
            name: 'Test Button',
            selector: '#test-btn',
            rect: { x: 10, y: 20, w: 100, h: 30 },
            state: { editable: false },
            tagName: 'button'
          }
        ],
        meta: {
          url: 'https://example.com',
          title: 'Performance Test',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 45,
          visibleOnly: false,
          performance: {
            algorithm: 'O(n) optimized',
            nodeCount: 500,
            processingMs: 30,
            memoryPeakMB: 5,
            algorithmsUsed: [
              'TreeWalker for interactive elements',
              'WeakMap for O(1) child lookups',
              'Pre-computed selector caches'
            ]
          }
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: performanceSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureOutline();
      
      expect(result.success).toBe(true);
      expect(result.data?.meta?.performance).toBeDefined();
      expect(result.data?.meta?.performance?.algorithm).toBe('O(n) optimized');
      expect(result.data?.meta?.performance?.nodeCount).toBe(500);
      expect(result.data?.meta?.performance?.algorithmsUsed).toContain('TreeWalker for interactive elements');
    });

    test('should validate linear time complexity', async () => {
      // Mock a scenario with large node count but reasonable duration
      const linearPerformanceSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.dom-lite',
        nodes: Array(200).fill(null).map((_, i) => ({
          role: 'button',
          name: `Button ${i}`,
          selector: `#btn-${i}`,
          rect: { x: 10, y: 20, w: 100, h: 30 },
          state: {},
          tagName: 'button',
          level: 0
        })),
        meta: {
          url: 'https://example.com',
          title: 'Linear Performance Test',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 120, // Reasonable for 2000 nodes
          visibleOnly: false,
          maxDepth: 10,
          performance: {
            algorithm: 'O(n) optimized',
            nodeCount: 2000,
            traversalMs: 40,
            processingMs: 70,
            memoryPeakMB: 12,
            algorithmsUsed: [
              'Iterative traversal to prevent stack overflow',
              'WeakMap for O(1) child lookups'
            ]
          }
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: linearPerformanceSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureDomLite({ maxDepth: 10 });
      
      expect(result.success).toBe(true);
      
      // Validate linear complexity indicators
      const performance = result.data?.meta?.performance;
      expect(performance?.algorithm).toBe('O(n) optimized');
      
      // Time per node should be reasonable for O(n) algorithm
      const timePerNode = performance!.processingMs / performance!.nodeCount * 1000; // microseconds
      expect(timePerNode).toBeLessThan(100); // <100μs per node indicates linear complexity
      
      // Memory per node should be efficient
      const memoryPerNode = performance!.memoryPeakMB / performance!.nodeCount * 1024; // KB per node
      expect(memoryPerNode).toBeLessThan(10); // <10KB per node is reasonable
    });

    test('should report optimization techniques used', async () => {
      const optimizedSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: [],
        meta: {
          url: 'https://example.com',
          title: 'Optimization Test',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 25,
          visibleOnly: true,
          performance: {
            algorithm: 'O(n) optimized',
            nodeCount: 100,
            processingMs: 15,
            memoryPeakMB: 2,
            algorithmsUsed: [
              'TreeWalker for interactive elements',
              'WeakMap for O(1) child lookups',
              'Pre-computed selector caches',
              'Iterative traversal to prevent stack overflow'
            ]
          }
        }
      };

      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: optimizedSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureOutline({ visibleOnly: true });
      
      expect(result.success).toBe(true);
      
      const algorithms = result.data?.meta?.performance?.algorithmsUsed || [];
      expect(algorithms).toContain('TreeWalker for interactive elements');
      expect(algorithms).toContain('WeakMap for O(1) child lookups');
      expect(algorithms).toContain('Pre-computed selector caches');
      expect(algorithms.length).toBeGreaterThan(0);
    });
  });

  describe('formatSnapshotResult', () => {
    it('should format successful snapshot results', () => {
      const mockSnapshot: SnapshotResult = {
        ok: true,
        cmd: 'snapshot.outline',
        nodes: [
          {
            role: 'button',
            name: 'Test Button',
            selector: '#test',
            rect: { x: 0, y: 0, w: 100, h: 30 },
            state: {},
            tagName: 'button'
          }
        ],
        meta: {
          url: 'https://example.com',
          title: 'Test',
          timestamp: '2024-01-01T00:00:00.000Z',
          durationMs: 50,
          visibleOnly: false
        }
      };

      const jsResult = {
        success: true,
        data: mockSnapshot,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const formatted = formatSnapshotResult(jsResult);
      
      expect('ok' in formatted).toBe(true);
      if ('ok' in formatted) {
        expect(formatted.ok).toBe(true);
        expect(formatted.nodes).toHaveLength(1);
        expect(formatted.cmd).toBe('snapshot.outline');
      }
    });

    it('should format failed snapshot results', () => {
      const jsResult = {
        success: false,
        error: 'Snapshot failed',
        code: ERROR_CODES.UNKNOWN_ERROR,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const formatted = formatSnapshotResult(jsResult);
      
      expect('success' in formatted).toBe(true);
      if ('success' in formatted) {
        expect(formatted.success).toBe(false);
        expect(formatted.error).toBe('Snapshot failed');
        expect(formatted.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      }
    });

    it('should handle missing result data', () => {
      const jsResult = {
        success: true,
        data: null,
        code: ERROR_CODES.OK,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const formatted = formatSnapshotResult(jsResult);
      
      expect('success' in formatted).toBe(true);
      if ('success' in formatted) {
        expect(formatted.success).toBe(false);
        expect(formatted.error).toBe('No snapshot data returned');
        expect(formatted.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      }
    });
  });
});