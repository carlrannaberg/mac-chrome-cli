/**
 * @fileoverview Tab command tests
 * 
 * Unit tests for tab management functionality including focus, listing,
 * and pattern matching operations.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { TabCommand } from '../tab.js';
import { ErrorCode } from '../../core/ErrorCodes.js';

// Mock the dependencies
jest.mock('../../lib/navigation.js', () => ({
  focusTabByPattern: jest.fn(),
  getCurrentPageInfo: jest.fn()
}));

jest.mock('../../lib/apple.js', () => ({
  getAllTabs: jest.fn(),
  focusTabByIndex: jest.fn()
}));

import { focusTabByPattern, getCurrentPageInfo } from '../../lib/navigation.js';
import { getAllTabs, focusTabByIndex } from '../../lib/apple.js';

const mockedFocusTabByPattern = focusTabByPattern as jest.MockedFunction<typeof focusTabByPattern>;
const mockedGetCurrentPageInfo = getCurrentPageInfo as jest.MockedFunction<typeof getCurrentPageInfo>;
const mockedGetAllTabs = getAllTabs as jest.MockedFunction<typeof getAllTabs>;
const mockedFocusTabByIndex = focusTabByIndex as jest.MockedFunction<typeof focusTabByIndex>;

describe('Tab Command', () => {
  let tabCommand: TabCommand;

  beforeEach(() => {
    tabCommand = new TabCommand();
    jest.clearAllMocks();
  });

  describe('focus', () => {
    it('should validate required pattern parameter', async () => {
      const result = await tabCommand.focus({ pattern: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern is required and must be a string');
      expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
    });

    it('should validate non-empty pattern parameter', async () => {
      const result = await tabCommand.focus({ pattern: '   ' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern cannot be empty');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should validate window index range', async () => {
      const result = await tabCommand.focus({ 
        pattern: 'test',
        windowIndex: 100 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid windowIndex');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should call focusTabByPattern with correct parameters', async () => {
      mockedFocusTabByPattern.mockResolvedValue({
        success: true,
        action: 'focus_tab',
        url: 'https://example.com',
        title: 'Example Page',
        loading: false,
        code: 0
      });

      const result = await tabCommand.focus({ 
        pattern: 'Example',
        exactMatch: true,
        windowIndex: 2
      });
      
      expect(mockedFocusTabByPattern).toHaveBeenCalledWith('Example', 2, true);
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('focus');
      expect(result.data?.pattern).toBe('Example');
      expect(result.data?.exactMatch).toBe(true);
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

      mockedGetAllTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: 0
      });

      const result = await tabCommand.list();
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('list');
      expect(result.data?.tabs).toEqual(mockTabs);
      expect(result.data?.metadata.totalTabs).toBe(2);
    });
  });

  describe('focusByIndex', () => {
    it('should validate tab index range', async () => {
      const result = await tabCommand.focusByIndex({ tabIndex: 0 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid tabIndex');
      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should focus tab by index', async () => {
      const mockTab = {
        id: 3,
        title: 'Focused Tab',
        url: 'https://focused.com',
        loading: false,
        windowId: 1
      };

      mockedFocusTabByIndex.mockResolvedValue({
        success: true,
        data: mockTab,
        code: 0
      });

      const result = await tabCommand.focusByIndex({ 
        tabIndex: 3,
        windowIndex: 1
      });
      
      expect(mockedFocusTabByIndex).toHaveBeenCalledWith(3, 1);
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('focus_index');
      expect(result.data?.tabIndex).toBe(3);
      expect(result.data?.tab?.title).toBe('Focused Tab');
    });
  });

  describe('getActive', () => {
    it('should get active tab information', async () => {
      mockedGetCurrentPageInfo.mockResolvedValue({
        success: true,
        action: 'get_page_info',
        url: 'https://active.com',
        title: 'Active Page',
        loading: false,
        code: 0
      });

      const result = await tabCommand.getActive();
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('get_active');
      expect(result.data?.tab?.title).toBe('Active Page');
      expect(result.data?.tab?.url).toBe('https://active.com');
    });
  });
});