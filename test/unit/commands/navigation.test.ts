/**
 * Unit tests for NavigationCommand
 */

import { NavigationCommand } from '../../../src/commands/navigation.js';
import { ErrorCode } from '../../../src/core/ErrorCodes.js';

// Mock the navigation library functions
jest.mock('../../../src/lib/navigation.js', () => ({
  navigateToURL: jest.fn(),
  reloadPage: jest.fn(),
  navigateBack: jest.fn(),
  navigateForward: jest.fn(),
  waitForPageLoad: jest.fn()
}));

// Import the mocked functions
import {
  navigateToURL,
  reloadPage,
  navigateBack,
  navigateForward,
  waitForPageLoad
} from '../../../src/lib/navigation.js';

const mockNavigateToURL = navigateToURL as jest.MockedFunction<typeof navigateToURL>;
const mockReloadPage = reloadPage as jest.MockedFunction<typeof reloadPage>;
const mockNavigateBack = navigateBack as jest.MockedFunction<typeof navigateBack>;
const mockNavigateForward = navigateForward as jest.MockedFunction<typeof navigateForward>;
const mockWaitForPageLoad = waitForPageLoad as jest.MockedFunction<typeof waitForPageLoad>;

describe('NavigationCommand', () => {
  let command: NavigationCommand;
  
  beforeEach(() => {
    command = new NavigationCommand();
    jest.clearAllMocks();
  });

  describe('URL validation and normalization', () => {
    test('should normalize protocol-less URLs to HTTPS', async () => {
      mockNavigateToURL.mockResolvedValue({
        success: true,
        action: 'navigate',
        url: 'https://example.com',
        title: 'Example Site',
        loading: false,
        code: 0
      });

      const result = await command.go('example.com');

      expect(result.success).toBe(true);
      expect(mockNavigateToURL).toHaveBeenCalledWith('https://example.com', 1);
    });

    test('should preserve existing protocol', async () => {
      mockNavigateToURL.mockResolvedValue({
        success: true,
        action: 'navigate',
        url: 'http://example.com',
        title: 'Example Site',
        loading: false,
        code: 0
      });

      const result = await command.go('http://example.com');

      expect(result.success).toBe(true);
      expect(mockNavigateToURL).toHaveBeenCalledWith('http://example.com', 1);
    });

    test('should handle file:// URLs', async () => {
      mockNavigateToURL.mockResolvedValue({
        success: true,
        action: 'navigate',
        url: 'file:///path/to/file.html',
        title: 'Local File',
        loading: false,
        code: 0
      });

      const result = await command.go('file:///path/to/file.html');

      expect(result.success).toBe(true);
      expect(mockNavigateToURL).toHaveBeenCalledWith('file:///path/to/file.html', 1);
    });

    test('should convert paths to file:// URLs', async () => {
      mockNavigateToURL.mockResolvedValue({
        success: true,
        action: 'navigate',
        url: 'file:///path/to/file.html',
        title: 'Local File',
        loading: false,
        code: 0
      });

      const result = await command.go('/path/to/file.html');

      expect(result.success).toBe(true);
      expect(mockNavigateToURL).toHaveBeenCalledWith('file:///path/to/file.html', 1);
    });

    test('should reject empty URLs', async () => {
      const result = await command.go('');

      expect(result.success).toBe(false);
      expect(result.code).toBe(ErrorCode.INVALID_URL);
      expect(result.error).toContain('URL is required');
    });

    test('should reject unsupported protocols', async () => {
      const result = await command.go('ftp://example.com');

      expect(result.success).toBe(false);
      expect(result.code).toBe(ErrorCode.INVALID_URL);
      expect(result.error).toContain('Unsupported protocol');
    });
  });

  describe('go method', () => {
    test('should navigate to URL successfully', async () => {
      const mockNavigationResult = {
        success: true,
        action: 'navigate',
        url: 'https://example.com',
        title: 'Example Site',
        loading: false,
        code: 0
      };

      mockNavigateToURL.mockResolvedValue(mockNavigationResult);

      const result = await command.go('https://example.com');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        url: 'https://example.com',
        title: 'Example Site',
        loading: false,
        canGoBack: true,
        canGoForward: false
      });
      expect(result.data?.timestamp).toBeDefined();
    });

    test('should handle navigation failure', async () => {
      mockNavigateToURL.mockResolvedValue({
        success: false,
        action: 'navigate',
        error: 'Navigation failed',
        code: 40 // TIMEOUT
      });

      const result = await command.go('https://slow-site.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation failed');
    });

    test('should wait for page load when option is set', async () => {
      mockNavigateToURL.mockResolvedValue({
        success: true,
        action: 'navigate',
        url: 'https://example.com',
        title: 'Example Site',
        loading: true,
        code: 0
      });

      mockWaitForPageLoad.mockResolvedValue({
        success: true,
        action: 'wait_load',
        url: 'https://example.com',
        title: 'Example Site',
        loading: false,
        code: 0
      });

      const result = await command.go('https://example.com', {
        waitForLoad: true,
        timeoutMs: 10000
      });

      expect(result.success).toBe(true);
      expect(mockWaitForPageLoad).toHaveBeenCalledWith(1, 10000);
    });

    test('should validate window index', async () => {
      const result = await command.go('https://example.com', {
        windowIndex: -1
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('reload method', () => {
    test('should reload page successfully', async () => {
      mockReloadPage.mockResolvedValue({
        success: true,
        action: 'reload',
        url: 'https://example.com',
        title: 'Example Site',
        loading: true,
        code: 0
      });

      const result = await command.reload();

      expect(result.success).toBe(true);
      expect(mockReloadPage).toHaveBeenCalledWith(false, 1);
      expect(result.data?.loading).toBe(true);
    });

    test('should support hard reload', async () => {
      mockReloadPage.mockResolvedValue({
        success: true,
        action: 'hard_reload',
        url: 'https://example.com',
        title: 'Example Site',
        loading: true,
        code: 0
      });

      const result = await command.reload({
        hardReload: true
      });

      expect(result.success).toBe(true);
      expect(mockReloadPage).toHaveBeenCalledWith(true, 1);
    });

    test('should handle reload failure', async () => {
      mockReloadPage.mockResolvedValue({
        success: false,
        action: 'reload',
        error: 'Reload operation failed',
        code: 40 // TIMEOUT
      });

      const result = await command.reload();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reload operation failed');
    });
  });

  describe('back method', () => {
    test('should navigate back in history', async () => {
      mockNavigateBack.mockResolvedValue({
        success: true,
        action: 'back',
        url: 'https://previous.com',
        title: 'Previous Page',
        loading: false,
        code: 0
      });

      const result = await command.back();

      expect(result.success).toBe(true);
      expect(mockNavigateBack).toHaveBeenCalledWith(1);
      expect(result.data?.url).toBe('https://previous.com');
    });

    test('should handle back navigation failure', async () => {
      mockNavigateBack.mockResolvedValue({
        success: false,
        action: 'back',
        error: 'No history to navigate back',
        code: 20 // TARGET_NOT_FOUND
      });

      const result = await command.back();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No history to navigate back');
    });
  });

  describe('forward method', () => {
    test('should navigate forward in history', async () => {
      mockNavigateForward.mockResolvedValue({
        success: true,
        action: 'forward',
        url: 'https://next.com',
        title: 'Next Page',
        loading: false,
        code: 0
      });

      const result = await command.forward();

      expect(result.success).toBe(true);
      expect(mockNavigateForward).toHaveBeenCalledWith(1);
      expect(result.data?.url).toBe('https://next.com');
    });

    test('should handle forward navigation failure', async () => {
      mockNavigateForward.mockResolvedValue({
        success: false,
        action: 'forward',
        error: 'Cannot go forward in history',
        code: 20 // TARGET_NOT_FOUND
      });

      const result = await command.forward();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot go forward in history');
    });
  });

  describe('options validation', () => {
    test('should validate window index range', async () => {
      const result1 = await command.go('https://example.com', {
        windowIndex: 0
      });
      expect(result1.success).toBe(false);
      expect(result1.code).toBe(ErrorCode.VALIDATION_FAILED);

      const result2 = await command.go('https://example.com', {
        windowIndex: 101 // Assuming max is 100
      });
      expect(result2.success).toBe(false);
      expect(result2.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    test('should validate timeout range', async () => {
      const result1 = await command.go('https://example.com', {
        timeoutMs: 500 // Too low
      });
      expect(result1.success).toBe(false);
      expect(result1.code).toBe(ErrorCode.VALIDATION_FAILED);

      const result2 = await command.go('https://example.com', {
        timeoutMs: 400000 // Too high
      });
      expect(result2.success).toBe(false);
      expect(result2.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('error handling patterns', () => {
    test('should handle various navigation error scenarios', async () => {
      // Test different error types
      const errorScenarios = [
        {
          mockResult: {
            success: false,
            action: 'navigate',
            error: 'timeout',
            code: 40
          },
          expectedError: 'timed out'
        },
        {
          mockResult: {
            success: false,
            action: 'navigate',
            error: 'network',
            code: 60
          },
          expectedError: 'Network error'
        },
        {
          mockResult: {
            success: false,
            action: 'navigate',
            error: 'Basic navigation failure',
            code: 99
          },
          expectedError: 'Basic navigation failure'
        }
      ];

      for (const scenario of errorScenarios) {
        mockNavigateToURL.mockResolvedValue(scenario.mockResult);
        const result = await command.go('https://example.com');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain(scenario.expectedError);
      }
    });

    test('should include recovery context in error results', async () => {
      mockNavigateBack.mockResolvedValue({
        success: false,
        action: 'back',
        error: 'No history to go back to',
        code: 20
      });

      const result = await command.back();

      expect(result.success).toBe(false);
      expect(result.context).toBeDefined();
      // Recovery hints are added by the implementation
    });
  });
});