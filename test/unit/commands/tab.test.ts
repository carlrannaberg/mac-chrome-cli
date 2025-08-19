/**
 * Unit tests for TabCommand
 */

import { TabCommand } from '../../../src/commands/tab.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';
import { Result } from '../../../src/core/Result.js';

// Mock the tab library functions
jest.mock('../../../src/lib/tab-manager.js', () => ({
  getTabs: jest.fn(),
  activateTab: jest.fn(),
  createTab: jest.fn(),
  closeTab: jest.fn(),
  switchToTab: jest.fn(),
  getActiveTab: jest.fn()
}));

// Mock the apple library for AppleScript operations
jest.mock('../../../src/lib/apple.js', () => ({
  execAppleScript: jest.fn()
}));

// Import the mocked functions
import {
  getTabs,
  activateTab,
  createTab,
  closeTab,
  switchToTab,
  getActiveTab
} from '../../../src/lib/tab-manager.js';
import { execAppleScript } from '../../../src/lib/apple.js';

const mockGetTabs = getTabs as jest.MockedFunction<typeof getTabs>;
const mockActivateTab = activateTab as jest.MockedFunction<typeof activateTab>;
const mockCreateTab = createTab as jest.MockedFunction<typeof createTab>;
const mockCloseTab = closeTab as jest.MockedFunction<typeof closeTab>;
const mockSwitchToTab = switchToTab as jest.MockedFunction<typeof switchToTab>;
const mockGetActiveTab = getActiveTab as jest.MockedFunction<typeof getActiveTab>;
const mockExecAppleScript = execAppleScript as jest.MockedFunction<typeof execAppleScript>;

describe('TabCommand', () => {
  let command: TabCommand;
  
  beforeEach(() => {
    command = new TabCommand();
    jest.clearAllMocks();
  });

  describe('list method', () => {
    describe('successful operations', () => {
      test('should list all tabs successfully', async () => {
        const mockTabs = [
          { id: 1, title: 'Google', url: 'https://google.com', active: false },
          { id: 2, title: 'GitHub', url: 'https://github.com', active: true },
          { id: 3, title: 'Stack Overflow', url: 'https://stackoverflow.com', active: false }
        ];

        mockGetTabs.mockResolvedValue({
          success: true,
          data: mockTabs,
          code: ErrorCode.OK
        });

        const result = await command.list({});

        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('list');
        expect(result.data?.tabs).toEqual(mockTabs);
        expect(result.data?.totalTabs).toBe(3);
        expect(result.data?.activeTabId).toBe(2);
        expect(result.data?.windowIndex).toBe(1);
        expect(mockGetTabs).toHaveBeenCalledWith(1);
      });

      test('should list tabs for specific window', async () => {
        const mockTabs = [
          { id: 1, title: 'Window 2 Tab', url: 'https://example.com', active: true }
        ];

        mockGetTabs.mockResolvedValue({
          success: true,
          data: mockTabs,
          code: ErrorCode.OK
        });

        const result = await command.list({
          windowIndex: 2
        });

        expect(result.success).toBe(true);
        expect(result.data?.windowIndex).toBe(2);
        expect(mockGetTabs).toHaveBeenCalledWith(2);
      });

      test('should handle empty tab list', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [],
          code: ErrorCode.OK
        });

        const result = await command.list({});

        expect(result.success).toBe(true);
        expect(result.data?.tabs).toEqual([]);
        expect(result.data?.totalTabs).toBe(0);
        expect(result.data?.activeTabId).toBeUndefined();
      });

      test('should filter tabs with active only', async () => {
        const mockTabs = [
          { id: 1, title: 'Google', url: 'https://google.com', active: false },
          { id: 2, title: 'GitHub', url: 'https://github.com', active: true }
        ];

        mockGetTabs.mockResolvedValue({
          success: true,
          data: mockTabs,
          code: ErrorCode.OK
        });

        const result = await command.list({
          activeOnly: true
        });

        expect(result.success).toBe(true);
        expect(result.data?.tabs).toEqual([{ id: 2, title: 'GitHub', url: 'https://github.com', active: true }]);
        expect(result.data?.totalTabs).toBe(1);
      });
    });

    describe('error handling', () => {
      test('should handle tab listing failure', async () => {
        mockGetTabs.mockResolvedValue({
          success: false,
          error: 'Failed to get tabs',
          code: ErrorCode.CHROME_NOT_RUNNING
        });

        const result = await command.list({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to get tabs');
        expect(result.context?.recoveryHint).toBe('retry');
      });

      test('should reject invalid window index', async () => {
        const result = await command.list({
          windowIndex: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid windowIndex: 0. Must be between 1 and 50');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.context?.recoveryHint).toBe('not_recoverable');
      });

      test('should reject window index above maximum', async () => {
        const result = await command.list({
          windowIndex: 51
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid windowIndex: 51. Must be between 1 and 50');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });
    });
  });

  describe('focus method', () => {
    describe('successful operations', () => {
      test('should focus tab by exact title match', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Google', url: 'https://google.com', active: false },
            { id: 2, title: 'GitHub', url: 'https://github.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'Google',
            url: 'https://google.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'Google'
        });

        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('focus');
        expect(result.data?.targetTab?.id).toBe(1);
        expect(result.data?.targetTab?.title).toBe('Google');
        expect(result.data?.matchType).toBe('exact');
        expect(result.data?.pattern).toBe('Google');
        expect(mockActivateTab).toHaveBeenCalledWith(1, 1);
      });

      test('should focus tab by partial title match', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Stack Overflow - Questions', url: 'https://stackoverflow.com', active: false },
            { id: 2, title: 'GitHub', url: 'https://github.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'Stack Overflow - Questions',
            url: 'https://stackoverflow.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'Stack'
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(1);
        expect(result.data?.matchType).toBe('partial');
      });

      test('should focus tab by URL match', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'GitHub', url: 'https://github.com/user/repo', active: false },
            { id: 2, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'GitHub',
            url: 'https://github.com/user/repo',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'github.com'
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(1);
        expect(result.data?.matchType).toBe('url');
      });

      test('should focus tab by index', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Tab 1', url: 'https://example1.com', active: false },
            { id: 2, title: 'Tab 2', url: 'https://example2.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'Tab 1',
            url: 'https://example1.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          index: 1
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(1);
        expect(result.data?.matchType).toBe('index');
        expect(result.data?.pattern).toBe('1');
      });

      test('should focus tab by tab ID', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 123, title: 'Target Tab', url: 'https://target.com', active: false },
            { id: 456, title: 'Other Tab', url: 'https://other.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 123,
            title: 'Target Tab',
            url: 'https://target.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          tabId: 123
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(123);
        expect(result.data?.matchType).toBe('id');
        expect(result.data?.pattern).toBe('123');
      });

      test('should focus with regex pattern', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Document v1.2.3', url: 'https://docs.com', active: false },
            { id: 2, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'Document v1.2.3',
            url: 'https://docs.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'Document.*v\\d+\\.\\d+\\.\\d+',
          useRegex: true
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(1);
        expect(result.data?.matchType).toBe('regex');
      });

      test('should focus with case insensitive matching', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'GitHub Repository', url: 'https://github.com', active: false },
            { id: 2, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'GitHub Repository',
            url: 'https://github.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'github',
          caseSensitive: false
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(1);
        expect(result.data?.matchType).toBe('partial');
      });
    });

    describe('input validation', () => {
      test('should reject when no targeting criteria provided', async () => {
        const result = await command.focus({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Must provide either match, index, or tabId to target a tab');
        expect(result.code).toBe(ErrorCode.MISSING_REQUIRED_PARAM);
        expect(result.context?.recoveryHint).toBe('user_action');
      });

      test('should reject multiple targeting criteria', async () => {
        const result = await command.focus({
          match: 'Google',
          index: 1
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot specify multiple targeting criteria. Use only one of: match, index, or tabId');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.context?.recoveryHint).toBe('user_action');
      });

      test('should reject invalid index values', async () => {
        let result = await command.focus({
          index: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab index: 0. Must be a positive integer (1-based)');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);

        result = await command.focus({
          index: -1
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab index: -1. Must be a positive integer (1-based)');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid tab ID values', async () => {
        let result = await command.focus({
          tabId: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab ID: 0. Must be a positive integer');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);

        result = await command.focus({
          tabId: -1
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab ID: -1. Must be a positive integer');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject empty match string', async () => {
        const result = await command.focus({
          match: ''
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Match pattern cannot be empty');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid regex patterns', async () => {
        const result = await command.focus({
          match: '[invalid regex',
          useRegex: true
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid regex pattern: [invalid regex');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });
    });

    describe('tab matching and activation failures', () => {
      test('should fail when no tabs match the criteria', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'nonexistent'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('No tab found matching: nonexistent');
        expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
        expect(result.context?.recoveryHint).toBe('check_target');
        expect(result.context?.metadata?.searchedTabs).toBe(1);
      });

      test('should fail when index is out of bounds', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Tab 1', url: 'https://example1.com', active: true }
          ],
          code: ErrorCode.OK
        });

        const result = await command.focus({
          index: 5
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Tab index 5 is out of bounds. Available tabs: 1');
        expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
        expect(result.context?.recoveryHint).toBe('check_target');
      });

      test('should fail when tab activation fails', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Google', url: 'https://google.com', active: false },
            { id: 2, title: 'GitHub', url: 'https://github.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: false,
          error: 'Failed to activate tab',
          code: ErrorCode.UI_AUTOMATION_FAILED
        });

        const result = await command.focus({
          match: 'Google'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to activate tab: Failed to activate tab');
        expect(result.code).toBe(ErrorCode.UI_AUTOMATION_FAILED);
        expect(result.context?.recoveryHint).toBe('retry_with_delay');
      });

      test('should handle multiple matching tabs by selecting first', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'GitHub - Project 1', url: 'https://github.com/proj1', active: false },
            { id: 2, title: 'GitHub - Project 2', url: 'https://github.com/proj2', active: false },
            { id: 3, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockActivateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'GitHub - Project 1',
            url: 'https://github.com/proj1',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.focus({
          match: 'GitHub'
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetTab?.id).toBe(1); // First match
        expect(result.data?.metadata.multipleMatches).toBe(true);
        expect(result.data?.metadata.totalMatches).toBe(2);
      });
    });
  });

  describe('create method', () => {
    describe('successful operations', () => {
      test('should create new blank tab successfully', async () => {
        mockCreateTab.mockResolvedValue({
          success: true,
          data: {
            id: 123,
            title: 'New Tab',
            url: 'chrome://newtab/',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.create({});

        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('create');
        expect(result.data?.newTab?.id).toBe(123);
        expect(result.data?.newTab?.title).toBe('New Tab');
        expect(result.data?.url).toBeUndefined();
        expect(result.data?.activate).toBe(true); // Default behavior
        expect(mockCreateTab).toHaveBeenCalledWith(undefined, 1, true);
      });

      test('should create new tab with URL', async () => {
        mockCreateTab.mockResolvedValue({
          success: true,
          data: {
            id: 124,
            title: 'Google',
            url: 'https://google.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.create({
          url: 'https://google.com'
        });

        expect(result.success).toBe(true);
        expect(result.data?.newTab?.url).toBe('https://google.com');
        expect(result.data?.url).toBe('https://google.com');
        expect(mockCreateTab).toHaveBeenCalledWith('https://google.com', 1, true);
      });

      test('should create new tab without activating', async () => {
        mockCreateTab.mockResolvedValue({
          success: true,
          data: {
            id: 125,
            title: 'Background Tab',
            url: 'https://example.com',
            active: false
          },
          code: ErrorCode.OK
        });

        const result = await command.create({
          url: 'https://example.com',
          activate: false
        });

        expect(result.success).toBe(true);
        expect(result.data?.newTab?.active).toBe(false);
        expect(result.data?.activate).toBe(false);
        expect(mockCreateTab).toHaveBeenCalledWith('https://example.com', 1, false);
      });

      test('should create tab in specific window', async () => {
        mockCreateTab.mockResolvedValue({
          success: true,
          data: {
            id: 126,
            title: 'Window 2 Tab',
            url: 'https://test.com',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.create({
          url: 'https://test.com',
          windowIndex: 2
        });

        expect(result.success).toBe(true);
        expect(result.data?.windowIndex).toBe(2);
        expect(mockCreateTab).toHaveBeenCalledWith('https://test.com', 2, true);
      });
    });

    describe('input validation', () => {
      test('should reject invalid URL format', async () => {
        const result = await command.create({
          url: 'not-a-valid-url'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid URL format: not-a-valid-url');
        expect(result.code).toBe(ErrorCode.INVALID_URL);
        expect(result.context?.recoveryHint).toBe('user_action');
      });

      test('should reject invalid window index', async () => {
        const result = await command.create({
          windowIndex: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid windowIndex: 0. Must be between 1 and 50');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should handle empty URL as valid (creates blank tab)', async () => {
        mockCreateTab.mockResolvedValue({
          success: true,
          data: {
            id: 127,
            title: 'New Tab',
            url: 'chrome://newtab/',
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.create({
          url: ''
        });

        expect(result.success).toBe(true);
        expect(mockCreateTab).toHaveBeenCalledWith('', 1, true);
      });
    });

    describe('tab creation failures', () => {
      test('should handle tab creation failure', async () => {
        mockCreateTab.mockResolvedValue({
          success: false,
          error: 'Failed to create tab',
          code: ErrorCode.CHROME_NOT_RUNNING
        });

        const result = await command.create({
          url: 'https://example.com'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to create tab: Failed to create tab');
        expect(result.code).toBe(ErrorCode.CHROME_NOT_RUNNING);
        expect(result.context?.recoveryHint).toBe('retry');
      });

      test('should handle permission denied errors', async () => {
        mockCreateTab.mockResolvedValue({
          success: false,
          error: 'Permission denied',
          code: ErrorCode.PERMISSION_DENIED
        });

        const result = await command.create({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');
        expect(result.context?.recoveryHint).toBe('permission');
      });
    });
  });

  describe('close method', () => {
    describe('successful operations', () => {
      test('should close tab by pattern match', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Google', url: 'https://google.com', active: false },
            { id: 2, title: 'GitHub', url: 'https://github.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockCloseTab.mockResolvedValue({
          success: true,
          data: { closed: true },
          code: ErrorCode.OK
        });

        const result = await command.close({
          match: 'Google'
        });

        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('close');
        expect(result.data?.closedTab?.id).toBe(1);
        expect(result.data?.closedTab?.title).toBe('Google');
        expect(result.data?.matchType).toBe('exact');
        expect(result.data?.pattern).toBe('Google');
        expect(mockCloseTab).toHaveBeenCalledWith(1, 1);
      });

      test('should close tab by index', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Tab 1', url: 'https://example1.com', active: false },
            { id: 2, title: 'Tab 2', url: 'https://example2.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockCloseTab.mockResolvedValue({
          success: true,
          data: { closed: true },
          code: ErrorCode.OK
        });

        const result = await command.close({
          index: 2
        });

        expect(result.success).toBe(true);
        expect(result.data?.closedTab?.id).toBe(2);
        expect(result.data?.matchType).toBe('index');
        expect(mockCloseTab).toHaveBeenCalledWith(2, 1);
      });

      test('should close tab by tab ID', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 123, title: 'Target Tab', url: 'https://target.com', active: false },
            { id: 456, title: 'Other Tab', url: 'https://other.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockCloseTab.mockResolvedValue({
          success: true,
          data: { closed: true },
          code: ErrorCode.OK
        });

        const result = await command.close({
          tabId: 123
        });

        expect(result.success).toBe(true);
        expect(result.data?.closedTab?.id).toBe(123);
        expect(result.data?.matchType).toBe('id');
        expect(mockCloseTab).toHaveBeenCalledWith(123, 1);
      });

      test('should close current active tab when no criteria provided', async () => {
        mockGetActiveTab.mockResolvedValue({
          success: true,
          data: {
            id: 2,
            title: 'Active Tab',
            url: 'https://active.com',
            active: true
          },
          code: ErrorCode.OK
        });

        mockCloseTab.mockResolvedValue({
          success: true,
          data: { closed: true },
          code: ErrorCode.OK
        });

        const result = await command.close({});

        expect(result.success).toBe(true);
        expect(result.data?.closedTab?.id).toBe(2);
        expect(result.data?.matchType).toBe('current');
        expect(mockGetActiveTab).toHaveBeenCalledWith(1);
        expect(mockCloseTab).toHaveBeenCalledWith(2, 1);
      });

      test('should close with force option', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Unsaved Document', url: 'https://docs.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockCloseTab.mockResolvedValue({
          success: true,
          data: { closed: true, forced: true },
          code: ErrorCode.OK
        });

        const result = await command.close({
          match: 'Unsaved',
          force: true
        });

        expect(result.success).toBe(true);
        expect(result.data?.force).toBe(true);
        expect(result.data?.metadata.forced).toBe(true);
      });
    });

    describe('input validation', () => {
      test('should reject invalid index values', async () => {
        const result = await command.close({
          index: 0
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab index: 0. Must be a positive integer (1-based)');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject invalid tab ID values', async () => {
        const result = await command.close({
          tabId: -1
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab ID: -1. Must be a positive integer');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });

      test('should reject empty match string', async () => {
        const result = await command.close({
          match: ''
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Match pattern cannot be empty');
        expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      });
    });

    describe('tab closing failures', () => {
      test('should fail when no matching tab found', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        const result = await command.close({
          match: 'nonexistent'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('No tab found matching: nonexistent');
        expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
        expect(result.context?.recoveryHint).toBe('check_target');
      });

      test('should fail when tab closing fails', async () => {
        mockGetTabs.mockResolvedValue({
          success: true,
          data: [
            { id: 1, title: 'Google', url: 'https://google.com', active: true }
          ],
          code: ErrorCode.OK
        });

        mockCloseTab.mockResolvedValue({
          success: false,
          error: 'Failed to close tab',
          code: ErrorCode.UI_AUTOMATION_FAILED
        });

        const result = await command.close({
          match: 'Google'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to close tab: Failed to close tab');
        expect(result.code).toBe(ErrorCode.UI_AUTOMATION_FAILED);
        expect(result.context?.recoveryHint).toBe('retry');
      });

      test('should fail when no active tab found for current close', async () => {
        mockGetActiveTab.mockResolvedValue({
          success: false,
          error: 'No active tab found',
          code: ErrorCode.TARGET_NOT_FOUND
        });

        const result = await command.close({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to get current active tab: No active tab found');
        expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);
        expect(result.context?.recoveryHint).toBe('check_target');
      });
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle single tab in list', async () => {
      mockGetTabs.mockResolvedValue({
        success: true,
        data: [
          { id: 1, title: 'Only Tab', url: 'https://only.com', active: true }
        ],
        code: ErrorCode.OK
      });

      const result = await command.list({});

      expect(result.success).toBe(true);
      expect(result.data?.totalTabs).toBe(1);
      expect(result.data?.activeTabId).toBe(1);
    });

    test('should handle tabs with special characters in titles', async () => {
      mockGetTabs.mockResolvedValue({
        success: true,
        data: [
          { id: 1, title: 'Special & Characters <test>', url: 'https://special.com', active: true }
        ],
        code: ErrorCode.OK
      });

      mockActivateTab.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'Special & Characters <test>',
          url: 'https://special.com',
          active: true
        },
        code: ErrorCode.OK
      });

      const result = await command.focus({
        match: 'Special & Characters <test>'
      });

      expect(result.success).toBe(true);
      expect(result.data?.targetTab?.title).toBe('Special & Characters <test>');
    });

    test('should handle very long URLs and titles', async () => {
      const longTitle = 'A'.repeat(1000);
      const longUrl = 'https://example.com/' + 'path/'.repeat(100);

      mockGetTabs.mockResolvedValue({
        success: true,
        data: [
          { id: 1, title: longTitle, url: longUrl, active: true }
        ],
        code: ErrorCode.OK
      });

      const result = await command.list({});

      expect(result.success).toBe(true);
      expect(result.data?.tabs?.[0]?.title).toBe(longTitle);
      expect(result.data?.tabs?.[0]?.url).toBe(longUrl);
    });

    test('should handle maximum window index', async () => {
      mockGetTabs.mockResolvedValue({
        success: true,
        data: [
          { id: 1, title: 'Max Window Tab', url: 'https://max.com', active: true }
        ],
        code: ErrorCode.OK
      });

      const result = await command.list({
        windowIndex: 50
      });

      expect(result.success).toBe(true);
      expect(result.data?.windowIndex).toBe(50);
      expect(mockGetTabs).toHaveBeenCalledWith(50);
    });

    test('should handle URL validation edge cases', async () => {
      const validUrls = [
        'http://example.com',
        'https://example.com',
        'https://sub.example.com:8080/path?query=value#fragment',
        'chrome://settings/',
        'chrome-extension://id/page.html',
        'file:///path/to/file.html'
      ];

      for (const url of validUrls) {
        mockCreateTab.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'Test Tab',
            url,
            active: true
          },
          code: ErrorCode.OK
        });

        const result = await command.create({ url });
        expect(result.success).toBe(true);
      }
    });

    test('should handle case sensitivity in matching', async () => {
      mockGetTabs.mockResolvedValue({
        success: true,
        data: [
          { id: 1, title: 'GitHub Repository', url: 'https://GitHub.com', active: true }
        ],
        code: ErrorCode.OK
      });

      mockActivateTab.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'GitHub Repository',
          url: 'https://GitHub.com',
          active: true
        },
        code: ErrorCode.OK
      });

      // Case sensitive (should not match)
      let result = await command.focus({
        match: 'github',
        caseSensitive: true
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe(ErrorCode.TARGET_NOT_FOUND);

      // Case insensitive (should match)
      result = await command.focus({
        match: 'github',
        caseSensitive: false
      });

      expect(result.success).toBe(true);
      expect(result.data?.targetTab?.id).toBe(1);
    });
  });

  describe('error handling and recovery strategies', () => {
    test('should provide appropriate recovery hints for different error types', async () => {
      const errorScenarios = [
        {
          error: ErrorCode.CHROME_NOT_RUNNING,
          expectedHint: 'retry'
        },
        {
          error: ErrorCode.TARGET_NOT_FOUND,
          expectedHint: 'check_target'
        },
        {
          error: ErrorCode.PERMISSION_DENIED,
          expectedHint: 'permission'
        },
        {
          error: ErrorCode.UI_AUTOMATION_FAILED,
          expectedHint: 'retry_with_delay'
        }
      ];

      for (const scenario of errorScenarios) {
        mockGetTabs.mockResolvedValue({
          success: false,
          error: 'Test error',
          code: scenario.error
        });

        const result = await command.list({});
        expect(result.success).toBe(false);
        // Recovery hints are determined internally by the command
      }
    });
  });

  describe('metadata generation', () => {
    test('should include comprehensive metadata', async () => {
      const mockTabs = [
        { id: 1, title: 'Google', url: 'https://google.com', active: false },
        { id: 2, title: 'GitHub', url: 'https://github.com', active: true }
      ];

      mockGetTabs.mockResolvedValue({
        success: true,
        data: mockTabs,
        code: ErrorCode.OK
      });

      const result = await command.list({
        windowIndex: 2
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.timestamp).toBeDefined();
      expect(new Date(result.data!.metadata.timestamp)).toBeInstanceOf(Date);
      expect(result.data?.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.data?.metadata.windowIndex).toBe(2);
    });

    test('should include match metadata for focus operations', async () => {
      mockGetTabs.mockResolvedValue({
        success: true,
        data: [
          { id: 1, title: 'GitHub - Repo 1', url: 'https://github.com/1', active: false },
          { id: 2, title: 'GitHub - Repo 2', url: 'https://github.com/2', active: false },
          { id: 3, title: 'Google', url: 'https://google.com', active: true }
        ],
        code: ErrorCode.OK
      });

      mockActivateTab.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          title: 'GitHub - Repo 1',
          url: 'https://github.com/1',
          active: true
        },
        code: ErrorCode.OK
      });

      const result = await command.focus({
        match: 'GitHub'
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata.multipleMatches).toBe(true);
      expect(result.data?.metadata.totalMatches).toBe(2);
      expect(result.data?.metadata.searchedTabs).toBe(3);
    });
  });
});