/**
 * @fileoverview Tab command tests
 * 
 * Unit tests for tab management functionality including focus, listing,
 * and pattern matching operations.
 * 
 * @author mac-chrome-cli
 * @version 2.0.0
 */

import { TabCommand } from '../tab.js';
import { ErrorCode } from '../../core/ErrorCodes.js';

// Mock the dependencies
jest.mock('../../lib/tab-manager.js', () => ({
  getTabs: jest.fn(),
  activateTab: jest.fn(),
  createTab: jest.fn(),
  closeTab: jest.fn(),
  switchToTab: jest.fn(),
  getActiveTab: jest.fn()
}));

import {
  getTabs,
  activateTab,
  createTab,
  closeTab,
  switchToTab,
  getActiveTab
} from '../../lib/tab-manager.js';

const mockedGetTabs = getTabs as jest.MockedFunction<typeof getTabs>;
const mockedActivateTab = activateTab as jest.MockedFunction<typeof activateTab>;
const mockedCreateTab = createTab as jest.MockedFunction<typeof createTab>;
const mockedCloseTab = closeTab as jest.MockedFunction<typeof closeTab>;
const mockedSwitchToTab = switchToTab as jest.MockedFunction<typeof switchToTab>;
const mockedGetActiveTab = getActiveTab as jest.MockedFunction<typeof getActiveTab>;

describe('Tab Command', () => {
  let tabCommand: TabCommand;

  beforeEach(() => {
    tabCommand = new TabCommand();
    jest.clearAllMocks();
  });

  describe('focus', () => {
    it('should validate required match parameter', async () => {
      const result = await tabCommand.focus({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Must provide either match, index, or tabId to target a tab');
      expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
    });

    it('should validate non-empty match parameter', async () => {
      const result = await tabCommand.focus({ match: '   ' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern cannot be empty');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should validate window index range', async () => {
      const result = await tabCommand.focus({ 
        match: 'test',
        windowIndex: 100 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid windowIndex');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should focus tab by pattern match', async () => {
      const mockTabs = [
        { id: 1, title: 'Example Page', url: 'https://example.com', active: false, windowId: 1 },
        { id: 2, title: 'Google', url: 'https://google.com', active: true, windowId: 1 }
      ];

      mockedGetTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK
      });

      mockedActivateTab.mockResolvedValue({
        success: true,
        data: { id: 1, title: 'Example Page', url: 'https://example.com', active: true, windowId: 2 },
        code: ErrorCode.OK
      });

      const result = await tabCommand.focus({ 
        match: 'Example',
        exactMatch: true,
        windowIndex: 1
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('focus');
      expect(result.data?.pattern).toBe('Example');
      expect(result.data?.targetTab?.title).toBe('Example Page');
    });
  });

  describe('list', () => {
    it('should validate window index range', async () => {
      const result = await tabCommand.list({ windowIndex: 0 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid windowIndex');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should return list of tabs', async () => {
      const mockTabs = [
        { id: 1, title: 'Tab 1', url: 'https://example.com', loading: false, windowId: 1 },
        { id: 2, title: 'Tab 2', url: 'https://google.com', loading: true, windowId: 1 }
      ];

      mockedGetTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK
      });

      const result = await tabCommand.list();
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('list');
      expect(result.data?.tabs).toEqual(mockTabs);
      expect(result.data?.metadata?.totalTabs).toBe(2);
    });
  });

  describe('focusByIndex', () => {
    it('should focus tab by index', async () => {
      const mockTabs = [
        { id: 1, title: 'First Tab', url: 'https://first.com', active: false, windowId: 1 },
        { id: 2, title: 'Second Tab', url: 'https://second.com', active: false, windowId: 1 },
        { id: 3, title: 'Third Tab', url: 'https://third.com', active: true, windowId: 1 }
      ];

      mockedGetTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK
      });

      mockedActivateTab.mockResolvedValue({
        success: true,
        data: { id: 3, title: 'Third Tab', url: 'https://third.com', active: true, windowId: 1 },
        code: ErrorCode.OK
      });

      const result = await tabCommand.focusByIndex({ tabIndex: 3, windowIndex: 1 });
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('focus_index');
      expect(result.data?.targetTab?.title).toBe('Third Tab');
    });
  });
});