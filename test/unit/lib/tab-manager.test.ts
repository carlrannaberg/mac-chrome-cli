/**
 * Unit tests for tab-manager library
 */

import {
  findMatchingTabs,
  generateTabEnumerationScript,
  generateTabFocusScript,
  getAllTabsEnhanced,
  focusTabByIndexEnhanced,
  getTabs,
  activateTab,
  createTab,
  closeTab,
  switchToTab,
  getActiveTab,
  type TabMatchOptions,
  type TabMatchResult
} from '../../../src/lib/tab-manager.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import { appleScriptService } from '../../../src/services/AppleScriptService.js';
import type { ChromeTab } from '../../../src/lib/apple.js';

// Mock the AppleScriptService
jest.mock('../../../src/services/AppleScriptService.js', () => ({
  appleScriptService: {
    executeScript: jest.fn()
  }
}));

const mockExecuteScript = appleScriptService.executeScript as jest.MockedFunction<typeof appleScriptService.executeScript>;

describe('Tab Manager Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTabs: ChromeTab[] = [
    { id: 1, title: 'Google Search', url: 'https://google.com/search?q=test', loading: false, windowId: 1 },
    { id: 2, title: 'GitHub Repository', url: 'https://github.com/user/repo', loading: false, windowId: 1 },
    { id: 3, title: 'Stack Overflow - JavaScript Question', url: 'https://stackoverflow.com/questions/123', loading: true, windowId: 1 },
    { id: 4, title: 'Local Development Server', url: 'http://localhost:3000', loading: false, windowId: 1 }
  ];

  describe('findMatchingTabs', () => {
    test('should find tabs by title substring match (case insensitive)', () => {
      const options: TabMatchOptions = {
        pattern: 'repository',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results).toHaveLength(1);
      expect(results[0].tab.title).toBe('GitHub Repository');
      expect(results[0].index).toBe(2);
      expect(results[0].matchedField).toBe('title');
    });

    test('should find tabs by URL substring match (case insensitive)', () => {
      const options: TabMatchOptions = {
        pattern: 'stackoverflow',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results).toHaveLength(1);
      expect(results[0].tab.url).toContain('stackoverflow.com');
      expect(results[0].index).toBe(3);
      expect(results[0].matchedField).toBe('url');
    });

    test('should find tabs matching both title and URL', () => {
      const options: TabMatchOptions = {
        pattern: 'google',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results).toHaveLength(1);
      expect(results[0].matchedField).toBe('both');
    });

    test('should support exact matching', () => {
      const options: TabMatchOptions = {
        pattern: 'Google Search',
        exactMatch: true,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results).toHaveLength(1);
      expect(results[0].tab.title).toBe('Google Search');
      expect(results[0].matchedField).toBe('title');
    });

    test('should support case sensitive matching', () => {
      const options: TabMatchOptions = {
        pattern: 'GITHUB',
        exactMatch: false,
        caseSensitive: true
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results).toHaveLength(0);
    });

    test('should find multiple matching tabs', () => {
      const options: TabMatchOptions = {
        pattern: 'http',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results.length).toBeGreaterThan(1);
    });

    test('should return empty array when no matches found', () => {
      const options: TabMatchOptions = {
        pattern: 'nonexistent',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results).toHaveLength(0);
    });

    test('should handle empty tabs array', () => {
      const options: TabMatchOptions = {
        pattern: 'test',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs([], options);

      expect(results).toHaveLength(0);
    });

    test('should handle tabs with null/undefined properties', () => {
      const tabsWithNulls: (ChromeTab | null)[] = [
        { id: 1, title: '', url: 'https://example.com', loading: false, windowId: 1 },
        null,
        { id: 3, title: 'Valid Tab', url: 'https://valid.com', loading: false, windowId: 1 }
      ];

      const options: TabMatchOptions = {
        pattern: 'valid',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(tabsWithNulls, options);

      expect(results).toHaveLength(1);
      expect(results[0].tab.title).toBe('Valid Tab');
      expect(results[0].index).toBe(3);
    });

    test('should use 1-based indexing for results', () => {
      const options: TabMatchOptions = {
        pattern: 'Google',
        exactMatch: false,
        caseSensitive: false
      };

      const results = findMatchingTabs(mockTabs, options);

      expect(results[0].index).toBe(1); // 1-based, not 0-based
    });
  });

  describe('generateTabEnumerationScript', () => {
    test('should generate correct AppleScript for tab enumeration', () => {
      const script = generateTabEnumerationScript(1);

      expect(script).toContain('window 1');
      expect(script).toContain('every tab of targetWindow');
      expect(script).toContain('escapeForJSON');
      expect(script).toContain('joinList');
      expect(script).toContain('ERROR: Chrome is not running');
    });

    test('should generate script with correct window index', () => {
      const script = generateTabEnumerationScript(3);

      expect(script).toContain('window 3');
      expect(script).toContain('"windowId": " & 3');
    });

    test('should include error handling', () => {
      const script = generateTabEnumerationScript(1);

      expect(script).toContain('on error errorMessage');
      expect(script).toContain('return "ERROR: " & errorMessage');
    });

    test('should include JSON escaping functions', () => {
      const script = generateTabEnumerationScript(1);

      expect(script).toContain('on escapeForJSON(textValue)');
      expect(script).toContain('replaceText(escapedText, "\\\\", "\\\\\\\\")');
      expect(script).toContain('replaceText(escapedText, "\\"", "\\\\\\"")');
    });
  });

  describe('generateTabFocusScript', () => {
    test('should generate correct AppleScript for tab focusing', () => {
      const script = generateTabFocusScript(2, 1);

      expect(script).toContain('window 1');
      expect(script).toContain('tab 2');
      expect(script).toContain('set active tab index of targetWindow to 2');
      expect(script).toContain('"id": " & 2');
    });

    test('should include tab index validation', () => {
      const script = generateTabFocusScript(3, 2);

      expect(script).toContain('if 3 > tabCount or 3 < 1 then');
      expect(script).toContain('Tab index 3 is out of range');
    });

    test('should include Chrome activation', () => {
      const script = generateTabFocusScript(1, 1);

      expect(script).toContain('activate');
    });

    test('should include error handling', () => {
      const script = generateTabFocusScript(1, 1);

      expect(script).toContain('on error errorMessage');
      expect(script).toContain('return "ERROR: " & errorMessage');
    });
  });

  describe('getAllTabsEnhanced', () => {
    test('should get all tabs successfully', async () => {
      const mockTabsJson = JSON.stringify(mockTabs);
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: mockTabsJson,
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getAllTabsEnhanced(1);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(4);
      expect(result.data?.[0].title).toBe('Google Search');
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 1'),
        15000
      );
    });

    test('should use default window index', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: '[]',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      await getAllTabsEnhanced();

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 1'),
        15000
      );
    });

    test('should handle AppleScript execution failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: false,
        error: 'Chrome is not running',
        code: ErrorCode.CHROME_NOT_RUNNING,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getAllTabsEnhanced(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Chrome is not running');
      expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
    });

    test('should handle JSON parsing failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: 'invalid json',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getAllTabsEnhanced(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse tab data');
    });

    test('should handle empty response data', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: null,
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getAllTabsEnhanced(1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('focusTabByIndexEnhanced', () => {
    test('should focus tab by index successfully', async () => {
      const mockTabData = JSON.stringify(mockTabs[1]);
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: mockTabData,
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await focusTabByIndexEnhanced(2, 1);

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('GitHub Repository');
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('tab 2'),
        10000
      );
    });

    test('should use default window index', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: '{}',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      await focusTabByIndexEnhanced(1);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 1'),
        10000
      );
    });

    test('should handle focus failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: false,
        error: 'Tab index out of range',
        code: ErrorCode.TARGET_NOT_FOUND,
        timestamp: Date.now(),
        context: {}
      });

      const result = await focusTabByIndexEnhanced(999, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab index out of range');
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    test('should handle JSON parsing failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: 'invalid json',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await focusTabByIndexEnhanced(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse tab data');
    });
  });

  describe('getTabs', () => {
    test('should be an alias for getAllTabsEnhanced', async () => {
      const mockTabsJson = JSON.stringify(mockTabs);
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: mockTabsJson,
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getTabs(2);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(4);
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 2'),
        15000
      );
    });
  });

  describe('activateTab', () => {
    test('should be an alias for focusTabByIndexEnhanced', async () => {
      const mockTabData = JSON.stringify(mockTabs[0]);
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: mockTabData,
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await activateTab(1, 2);

      expect(result.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('tab 1'),
        10000
      );
    });
  });

  describe('createTab', () => {
    test('should create new tab without URL', async () => {
      const newTabData = { id: 5, title: 'New Tab', url: 'chrome://newtab/', loading: false, active: true };
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: JSON.stringify(newTabData),
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await createTab();

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('New Tab');
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('make new tab at end of tabs'),
        10000
      );
    });

    test('should create new tab with URL', async () => {
      const newTabData = { id: 5, title: 'Example', url: 'https://example.com', loading: false, active: true };
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: JSON.stringify(newTabData),
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await createTab('https://example.com');

      expect(result.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('with properties {URL:"https://example.com"}'),
        10000
      );
    });

    test('should create tab without activating', async () => {
      const newTabData = { id: 5, title: 'Background Tab', url: 'https://example.com', loading: false, active: false };
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: JSON.stringify(newTabData),
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await createTab('https://example.com', 1, false);

      expect(result.success).toBe(true);
      expect(result.data?.active).toBe(false);
    });

    test('should use custom window index', async () => {
      const newTabData = { id: 1, title: 'New Tab', url: 'chrome://newtab/', loading: false, active: true };
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: JSON.stringify(newTabData),
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      await createTab(undefined, 3);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 3'),
        10000
      );
    });

    test('should handle creation failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: false,
        error: 'Failed to create tab',
        code: ErrorCode.CHROME_NOT_RUNNING,
        timestamp: Date.now(),
        context: {}
      });

      const result = await createTab();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create tab');
    });

    test('should handle JSON parsing failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: 'invalid json',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await createTab();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse tab data');
    });
  });

  describe('closeTab', () => {
    test('should close tab by index successfully', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: '{"closed": true}',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await closeTab(2, 1);

      expect(result.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('close tab 2'),
        10000
      );
    });

    test('should use default window index', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: '{"closed": true}',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      await closeTab(1);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 1'),
        10000
      );
    });

    test('should handle close failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: false,
        error: 'Tab not found',
        code: ErrorCode.TARGET_NOT_FOUND,
        timestamp: Date.now(),
        context: {}
      });

      const result = await closeTab(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab not found');
    });

    test('should include tab index validation in script', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: '{"closed": true}',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      await closeTab(5, 2);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('if 5 > tabCount or 5 < 1 then'),
        10000
      );
    });
  });

  describe('switchToTab', () => {
    test('should be an alias for activateTab', async () => {
      const mockTabData = JSON.stringify(mockTabs[2]);
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: mockTabData,
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await switchToTab(3, 1);

      expect(result.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('tab 3'),
        10000
      );
    });
  });

  describe('getActiveTab', () => {
    test('should get active tab successfully', async () => {
      const activeTabData = { ...mockTabs[1], active: true };
      
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: JSON.stringify(activeTabData),
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getActiveTab(1);

      expect(result.success).toBe(true);
      expect(result.data?.active).toBe(true);
      expect(result.data?.title).toBe('GitHub Repository');
      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('active tab index'),
        10000
      );
    });

    test('should use default window index', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: JSON.stringify({ ...mockTabs[0], active: true }),
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      await getActiveTab();

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.stringContaining('window 1'),
        10000
      );
    });

    test('should handle get active tab failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: false,
        error: 'No active tab found',
        code: ErrorCode.TARGET_NOT_FOUND,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getActiveTab(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    test('should handle JSON parsing failure', async () => {
      mockExecuteScript.mockResolvedValue({
        success: true,
        data: 'invalid json',
        code: ErrorCode.OK,
        timestamp: Date.now(),
        context: {}
      });

      const result = await getActiveTab(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse tab data');
    });
  });

  describe('AppleScript generation edge cases', () => {
    test('should handle various window indices in script generation', () => {
      const testCases = [1, 2, 5, 10];
      
      for (const windowIndex of testCases) {
        const enumScript = generateTabEnumerationScript(windowIndex);
        const focusScript = generateTabFocusScript(1, windowIndex);
        
        expect(enumScript).toContain(`window ${windowIndex}`);
        expect(focusScript).toContain(`window ${windowIndex}`);
      }
    });

    test('should handle various tab indices in focus script generation', () => {
      const testCases = [1, 3, 7, 15];
      
      for (const tabIndex of testCases) {
        const script = generateTabFocusScript(tabIndex, 1);
        
        expect(script).toContain(`tab ${tabIndex}`);
        expect(script).toContain(`if ${tabIndex} > tabCount`);
        expect(script).toContain(`set active tab index of targetWindow to ${tabIndex}`);
      }
    });
  });

  describe('Error propagation', () => {
    test('should propagate all error properties from AppleScript service', async () => {
      const mockError = {
        success: false,
        error: 'Test error',
        code: ErrorCode.APPLESCRIPT_ERROR,
        timestamp: 1234567890,
        context: { recoveryHint: 'retry' }
      };

      mockExecuteScript.mockResolvedValue(mockError);

      const functions = [
        () => getAllTabsEnhanced(1),
        () => focusTabByIndexEnhanced(1, 1),
        () => createTab(),
        () => closeTab(1),
        () => getActiveTab(1)
      ];

      for (const func of functions) {
        const result = await func();
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Test error');
        expect(result.code).toBe(ErrorCode.APPLESCRIPT_ERROR);
        expect(result.timestamp).toBe(1234567890);
        expect(result.context?.recoveryHint).toBe('retry');
      }
    });
  });
});