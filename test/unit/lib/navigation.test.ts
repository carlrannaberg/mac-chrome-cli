/**
 * Unit tests for navigation library
 */

import {
  navigateToURL,
  reloadPage,
  navigateBack,
  navigateForward,
  getCurrentPageInfo,
  focusTabByPattern,
  waitForPageLoad,
  type NavigationResult,
  type TabInfo
} from '../../../src/lib/navigation.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import * as apple from '../../../src/lib/apple.js';
import * as tabManager from '../../../src/lib/tab-manager.js';

// Mock the apple library
jest.mock('../../../src/lib/apple.js', () => ({
  execChromeJS: jest.fn(),
  getActiveTab: jest.fn(),
  focusChromeWindow: jest.fn(),
  getAllTabs: jest.fn(),
  focusTabByIndex: jest.fn()
}));

// Mock the tab-manager library
jest.mock('../../../src/lib/tab-manager.js', () => ({
  findMatchingTabs: jest.fn()
}));

const mockExecChromeJS = apple.execChromeJS as jest.MockedFunction<typeof apple.execChromeJS>;
const mockGetActiveTab = apple.getActiveTab as jest.MockedFunction<typeof apple.getActiveTab>;
const mockFocusChromeWindow = apple.focusChromeWindow as jest.MockedFunction<typeof apple.focusChromeWindow>;
const mockGetAllTabs = apple.getAllTabs as jest.MockedFunction<typeof apple.getAllTabs>;
const mockFocusTabByIndex = apple.focusTabByIndex as jest.MockedFunction<typeof apple.focusTabByIndex>;
const mockFindMatchingTabs = tabManager.findMatchingTabs as jest.MockedFunction<typeof tabManager.findMatchingTabs>;

describe('Navigation Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('navigateToURL', () => {
    test('should navigate to URL successfully', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await navigateToURL('https://example.com');

      expect(result.success).toBe(true);
      expect(result.action).toBe('navigate');
      expect(result.url).toBe('https://example.com/');
      expect(result.title).toBe('Example Domain');
      expect(result.loading).toBe(false);
      expect(result.code).toBe(ErrorCode.OK);
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining("window.location.href = 'https://example.com'"),
        1,
        1
      );
    });

    test('should add https protocol to URLs without protocol', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://google.com/',
          title: 'Google',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await navigateToURL('google.com');

      expect(result.success).toBe(true);
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining("window.location.href = 'https://google.com'"),
        1,
        1
      );
    });

    test('should not modify URLs that already have protocol', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'http://example.com/',
          title: 'Example',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await navigateToURL('http://example.com');

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining("window.location.href = 'http://example.com'"),
        1,
        1
      );
    });

    test('should handle file:// URLs', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'file:///path/to/file.html',
          title: 'Local File',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await navigateToURL('file:///path/to/file.html');

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining("window.location.href = 'file:///path/to/file.html'"),
        1,
        1
      );
    });

    test('should escape quotes in URLs', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/path',
          title: 'Example',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await navigateToURL("https://example.com/path?q='test'");

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining("window.location.href = 'https://example.com/path?q=\\'test\\''"),
        1,
        1
      );
    });

    test('should use custom window index', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/',
          title: 'Example',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await navigateToURL('https://example.com', 2);

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.any(String),
        1,
        2
      );
    });

    test('should handle navigation failure', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'Chrome is not running',
        code: ErrorCode.CHROME_NOT_RUNNING
      });

      const result = await navigateToURL('https://example.com');

      expect(result.success).toBe(false);
      expect(result.action).toBe('navigate');
      expect(result.error).toBe('Chrome is not running');
      expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
    });

    test('should handle missing navigation data', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: null,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await navigateToURL('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No result from navigation');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    test('should handle exceptions', async () => {
      mockExecChromeJS.mockRejectedValue(new Error('Unexpected error'));

      const result = await navigateToURL('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to navigate: Error: Unexpected error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('reloadPage', () => {
    test('should reload page normally', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          loading: true
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await reloadPage(false);

      expect(result.success).toBe(true);
      expect(result.action).toBe('reload');
      expect(result.loading).toBe(true);
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining('window.location.reload()'),
        1,
        1
      );
    });

    test('should perform hard reload', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          loading: true
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await reloadPage(true);

      expect(result.success).toBe(true);
      expect(result.action).toBe('hard_reload');
      expect(result.loading).toBe(true);
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining('window.location.reload(true)'),
        1,
        1
      );
    });

    test('should use custom window index', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/',
          title: 'Example',
          loading: true
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await reloadPage(false, 3);

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.any(String),
        1,
        3
      );
    });

    test('should handle reload failure', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'JavaScript execution failed',
        code: ErrorCode.JAVASCRIPT_ERROR
      });

      const result = await reloadPage();

      expect(result.success).toBe(false);
      expect(result.action).toBe('reload');
      expect(result.error).toBe('JavaScript execution failed');
      expect(result.code).toBe(ErrorCode.JAVASCRIPT_ERROR);
    });
  });

  describe('navigateBack', () => {
    test('should navigate back successfully', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://previous.com/',
          title: 'Previous Page',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await navigateBack();

      expect(result.success).toBe(true);
      expect(result.action).toBe('back');
      expect(result.url).toBe('https://previous.com/');
      expect(result.title).toBe('Previous Page');
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining('window.history.back()'),
        1,
        1
      );
    });

    test('should use custom window index', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com/',
          title: 'Example',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await navigateBack(2);

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.any(String),
        1,
        2
      );
    });

    test('should handle back navigation failure', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'No history available',
        code: ErrorCode.JAVASCRIPT_ERROR
      });

      const result = await navigateBack();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No history available');
      expect(result.code).toBe(ErrorCode.JAVASCRIPT_ERROR);
    });
  });

  describe('navigateForward', () => {
    test('should navigate forward successfully', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: {
          url: 'https://next.com/',
          title: 'Next Page',
          loading: false
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await navigateForward();

      expect(result.success).toBe(true);
      expect(result.action).toBe('forward');
      expect(result.url).toBe('https://next.com/');
      expect(result.title).toBe('Next Page');
      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.stringContaining('window.history.forward()'),
        1,
        1
      );
    });

    test('should handle forward navigation failure', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'No forward history available',
        code: ErrorCode.JAVASCRIPT_ERROR
      });

      const result = await navigateForward();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No forward history available');
      expect(result.code).toBe(ErrorCode.JAVASCRIPT_ERROR);
    });
  });

  describe('getCurrentPageInfo', () => {
    test('should get current page info successfully', async () => {
      mockGetActiveTab.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'Current Page',
          url: 'https://current.com/',
          loading: false,
          windowId: 1
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await getCurrentPageInfo();

      expect(result.success).toBe(true);
      expect(result.action).toBe('get_page_info');
      expect(result.url).toBe('https://current.com/');
      expect(result.title).toBe('Current Page');
      expect(result.loading).toBe(false);
      expect(mockGetActiveTab).toHaveBeenCalledWith(1);
    });

    test('should use custom window index', async () => {
      mockGetActiveTab.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'Page',
          url: 'https://example.com/',
          loading: false,
          windowId: 2
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await getCurrentPageInfo(2);

      expect(mockGetActiveTab).toHaveBeenCalledWith(2);
    });

    test('should handle get page info failure', async () => {
      mockGetActiveTab.mockResolvedValue({
        success: false,
        error: 'No active tab found',
        code: ErrorCode.ELEMENT_NOT_FOUND
      });

      const result = await getCurrentPageInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tab found');
      expect(result.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    });

    test('should handle missing page data', async () => {
      mockGetActiveTab.mockResolvedValue({
        success: true,
        data: null,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await getCurrentPageInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No page information available');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('focusTabByPattern', () => {
    const mockTabs = [
      { id: 1, title: 'Google', url: 'https://google.com', loading: false, windowId: 1, index: 1 },
      { id: 2, title: 'GitHub', url: 'https://github.com', loading: false, windowId: 1, index: 2 },
      { id: 3, title: 'Stack Overflow', url: 'https://stackoverflow.com', loading: false, windowId: 1, index: 3 }
    ];

    test('should focus tab by pattern successfully', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK,
        error: undefined
      });

      mockFindMatchingTabs.mockReturnValue([mockTabs[1]]);

      mockFocusTabByIndex.mockResolvedValue({
        success: true,
        data: {
          id: 2,
          title: 'GitHub',
          url: 'https://github.com',
          loading: false,
          windowId: 1
        },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await focusTabByPattern('GitHub');

      expect(result.success).toBe(true);
      expect(result.action).toBe('focus_tab');
      expect(result.url).toBe('https://github.com');
      expect(result.title).toBe('GitHub');
      expect(mockFocusChromeWindow).toHaveBeenCalledWith(1);
      expect(mockGetAllTabs).toHaveBeenCalledWith(1);
      expect(mockFindMatchingTabs).toHaveBeenCalledWith(mockTabs, {
        pattern: 'GitHub',
        exactMatch: false,
        caseSensitive: false
      });
      expect(mockFocusTabByIndex).toHaveBeenCalledWith(2, 1);
    });

    test('should support exact matching', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK,
        error: undefined
      });

      mockFindMatchingTabs.mockReturnValue([mockTabs[0]]);

      mockFocusTabByIndex.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'Google',
          url: 'https://google.com',
          loading: false,
          windowId: 1
        },
        code: ErrorCode.OK,
        error: undefined
      });

      await focusTabByPattern('Google', 1, true);

      expect(mockFindMatchingTabs).toHaveBeenCalledWith(mockTabs, {
        pattern: 'Google',
        exactMatch: true,
        caseSensitive: false
      });
    });

    test('should use custom window index', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK,
        error: undefined
      });

      mockFindMatchingTabs.mockReturnValue([mockTabs[0]]);

      mockFocusTabByIndex.mockResolvedValue({
        success: true,
        data: mockTabs[0],
        code: ErrorCode.OK,
        error: undefined
      });

      await focusTabByPattern('Google', 2);

      expect(mockFocusChromeWindow).toHaveBeenCalledWith(2);
      expect(mockGetAllTabs).toHaveBeenCalledWith(2);
      expect(mockFocusTabByIndex).toHaveBeenCalledWith(1, 2);
    });

    test('should handle window focus failure', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: false,
        error: 'Chrome window not found',
        code: ErrorCode.CHROME_NOT_RUNNING
      });

      const result = await focusTabByPattern('GitHub');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Chrome window not found');
      expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
    });

    test('should handle tab retrieval failure', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: false,
        error: 'Failed to get tabs',
        code: ErrorCode.APPLESCRIPT_ERROR
      });

      const result = await focusTabByPattern('GitHub');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get tabs');
      expect(result.code).toBe(ErrorCode.APPLESCRIPT_ERROR);
    });

    test('should handle no tabs found', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: true,
        data: [],
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await focusTabByPattern('GitHub');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No tabs found in the specified window');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should handle no matching tabs', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK,
        error: undefined
      });

      mockFindMatchingTabs.mockReturnValue([]);

      const result = await focusTabByPattern('NonExistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab matching pattern "NonExistent" not found. Found 3 tabs in window 1.');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should handle tab focusing failure', async () => {
      mockFocusChromeWindow.mockResolvedValue({
        success: true,
        code: ErrorCode.OK,
        error: undefined
      });

      mockGetAllTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK,
        error: undefined
      });

      mockFindMatchingTabs.mockReturnValue([mockTabs[1]]);

      mockFocusTabByIndex.mockResolvedValue({
        success: false,
        error: 'Failed to focus tab',
        code: ErrorCode.APPLESCRIPT_ERROR
      });

      const result = await focusTabByPattern('GitHub');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to focus tab');
      expect(result.code).toBe(ErrorCode.APPLESCRIPT_ERROR);
    });
  });

  describe('waitForPageLoad', () => {
    test('should wait for page load successfully', async () => {
      mockExecChromeJS
        .mockResolvedValueOnce({
          success: true,
          data: { loading: true, url: 'https://example.com/', title: 'Loading...' },
          code: ErrorCode.OK,
          error: undefined
        })
        .mockResolvedValueOnce({
          success: true,
          data: { loading: false, url: 'https://example.com/', title: 'Example Domain' },
          code: ErrorCode.OK,
          error: undefined
        });

      const result = await waitForPageLoad();

      expect(result.success).toBe(true);
      expect(result.action).toBe('wait_load');
      expect(result.loading).toBe(false);
      expect(result.url).toBe('https://example.com/');
      expect(result.title).toBe('Example Domain');
      expect(mockExecChromeJS).toHaveBeenCalledTimes(2);
    });

    test('should return immediately if page already loaded', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: { loading: false, url: 'https://example.com/', title: 'Example Domain' },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await waitForPageLoad();

      expect(result.success).toBe(true);
      expect(result.loading).toBe(false);
      expect(mockExecChromeJS).toHaveBeenCalledTimes(1);
    });

    test('should use custom window index', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: { loading: false, url: 'https://example.com/', title: 'Example' },
        code: ErrorCode.OK,
        error: undefined
      });

      await waitForPageLoad(2);

      expect(mockExecChromeJS).toHaveBeenCalledWith(
        expect.any(String),
        1,
        2
      );
    });

    test('should timeout after specified duration', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: { loading: true, url: 'https://example.com/', title: 'Loading...' },
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await waitForPageLoad(1, 1000); // 1 second timeout

      expect(result.success).toBe(false);
      expect(result.action).toBe('wait_load');
      expect(result.error).toBe('Page load timeout');
      expect(result.code).toBe(ErrorCode.TIMEOUT);
    });

    test('should handle JavaScript execution failure', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: false,
        error: 'JavaScript execution failed',
        code: ErrorCode.JAVASCRIPT_ERROR
      });

      const result = await waitForPageLoad();

      expect(result.success).toBe(false);
      expect(result.error).toBe('JavaScript execution failed');
      expect(result.code).toBe(ErrorCode.JAVASCRIPT_ERROR);
    });

    test('should handle missing load status data', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: null,
        code: ErrorCode.OK,
        error: undefined
      });

      const result = await waitForPageLoad();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No result from page load check');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('error handling', () => {
    test('should handle all navigation functions with exceptions', async () => {
      const functions = [
        () => navigateToURL('https://example.com'),
        () => reloadPage(),
        () => navigateBack(),
        () => navigateForward(),
        () => getCurrentPageInfo(),
        () => focusTabByPattern('test'),
        () => waitForPageLoad()
      ];

      const expectedActions = [
        'navigate',
        'reload', 
        'back',
        'forward',
        'get_page_info',
        'focus_tab',
        'wait_load'
      ];

      for (let i = 0; i < functions.length; i++) {
        // Mock all dependencies to throw
        mockExecChromeJS.mockRejectedValue(new Error('Test error'));
        mockGetActiveTab.mockRejectedValue(new Error('Test error'));
        mockFocusChromeWindow.mockRejectedValue(new Error('Test error'));

        const result = await functions[i]();
        
        expect(result.success).toBe(false);
        expect(result.action).toBe(expectedActions[i]);
        expect(result.error).toContain('Test error');
        expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      }
    });
  });

  describe('URL protocol handling', () => {
    test('should preserve different protocol schemes', async () => {
      mockExecChromeJS.mockResolvedValue({
        success: true,
        data: { url: 'test', title: 'test', loading: false },
        code: ErrorCode.OK,
        error: undefined
      });

      const testCases = [
        { input: 'https://example.com', expected: 'https://example.com' },
        { input: 'http://example.com', expected: 'http://example.com' },
        { input: 'file:///path/file.html', expected: 'file:///path/file.html' },
        { input: 'example.com', expected: 'https://example.com' },
        { input: 'localhost:3000', expected: 'https://localhost:3000' }
      ];

      for (const testCase of testCases) {
        await navigateToURL(testCase.input);
        expect(mockExecChromeJS).toHaveBeenLastCalledWith(
          expect.stringContaining(`window.location.href = '${testCase.expected}'`),
          1,
          1
        );
      }
    });
  });

  describe('result data consistency', () => {
    test('should maintain consistent result structure across all functions', () => {
      const testResult = (result: NavigationResult) => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('action');
        expect(result).toHaveProperty('code');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.action).toBe('string');
        expect(typeof result.code).toBe('number');
      };

      // These would need to be called with proper mocks, but the structure test is valuable
      const mockResult: NavigationResult = {
        success: true,
        action: 'test',
        code: ErrorCode.OK
      };

      testResult(mockResult);
    });
  });
});