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
        result: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureOutline();
      
      expect(result.success).toBe(true);
      expect(result.result?.ok).toBe(true);
      expect(result.result?.nodes).toHaveLength(1);
      expect(result.result?.nodes[0].role).toBe('button');
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
        result: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureOutline({ visibleOnly: true });
      
      expect(result.success).toBe(true);
      expect(result.result?.meta?.visibleOnly).toBe(true);
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
        result: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureDomLite();
      
      expect(result.success).toBe(true);
      expect(result.result?.cmd).toBe('snapshot.dom-lite');
      expect(result.result?.meta?.maxDepth).toBe(10);
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
        result: mockSnapshot,
        code: ERROR_CODES.OK
      });

      const result = await captureDomLite({ maxDepth: 5, visibleOnly: false });
      
      expect(result.success).toBe(true);
      expect(result.result?.meta?.maxDepth).toBe(5);
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
        result: mockSnapshot,
        code: ERROR_CODES.OK
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
        code: ERROR_CODES.UNKNOWN_ERROR
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
        result: null,
        code: ERROR_CODES.OK
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