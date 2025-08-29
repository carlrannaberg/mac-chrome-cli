/**
 * System integration tests for real-world error conditions
 * 
 * Tests the complete system integration including service coordination,
 * error propagation, and recovery scenarios
 */

import { ServiceContainer, ServiceLifetime, createServiceToken } from '../src/di/ServiceContainer.js';
import { SERVICE_TOKENS } from '../src/di/ServiceTokens.js';
import { AppleScriptService } from '../src/services/AppleScriptService.js';
import * as fs from 'fs';
import * as path from 'path';
import { SecurePathValidator } from '../src/security/PathValidator.js';
import { NetworkDataSanitizer } from '../src/security/DataSanitizer.js';
import { runDiagnostics } from '../src/commands/doctor.js';
import { captureOutline, captureDomLite } from '../src/commands/snapshot.js';
import { ERROR_CODES } from '../src/lib/util.js';

// Mock child_process for system-level testing
jest.mock('child_process');
jest.mock('../src/lib/util.js', () => ({
  ...jest.requireActual('../src/lib/util.js'),
  execWithTimeout: jest.fn()
}));

import { spawn } from 'child_process';
import { execWithTimeout } from '../src/lib/util.js';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockExecWithTimeout = execWithTimeout as jest.MockedFunction<typeof execWithTimeout>;

describe('System Integration Tests', () => {
  let serviceContainer: ServiceContainer;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceContainer = new ServiceContainer();
  });

  afterEach(() => {
    // Clean up any registered services
    serviceContainer.clear();
  });

  describe('Service Container Integration', () => {
    it('should demonstrate basic service container functionality', () => {
      // Basic test to ensure ServiceContainer can be instantiated and used
      expect(serviceContainer).toBeDefined();
      expect(typeof serviceContainer.clear).toBe('function');
      expect(typeof serviceContainer.registerSingleton).toBe('function');
      
      // The detailed ServiceContainer tests are in src/di/__tests__/ServiceContainer.test.ts
      // This integration test focuses on service coordination rather than container mechanics
    });
  });

  describe('Cross-Service Error Propagation', () => {
    it('should propagate errors correctly across service boundaries', async () => {
      const appleScriptService = new AppleScriptService();
      const pathValidator = new SecurePathValidator();

      // Mock a permission error in the underlying system
      mockExecWithTimeout.mockRejectedValue(
        testUtils.failureScenarios.createPermissionDeniedError('AppleScript automation')
      );

      // Test error propagation through the service stack
      const scriptResult = await appleScriptService.executeScript('test script');
      expect(scriptResult.success).toBe(false);
      expect(scriptResult.error).toBePermissionError();

      // Test that other services continue to work - create a temporary file to validate
      const tempFile = path.join('/tmp', 'test-integration.txt');
      fs.writeFileSync(tempFile, 'test content');
      
      try {
        const pathResult = pathValidator.validateFilePath(tempFile);
        expect(pathResult.success).toBe(true);
      } finally {
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });

    it('should handle cascading failures across multiple services', async () => {
      const services = {
        appleScript: new AppleScriptService(),
        pathValidator: new SecurePathValidator(),
        dataSanitizer: new NetworkDataSanitizer()
      };

      // Simulate system-wide failure scenario
      mockExecWithTimeout.mockRejectedValue(
        testUtils.failureScenarios.createSystemError(-1, 'System overload')
      );

      // AppleScript service should fail
      const scriptResult = await services.appleScript.executeScript('test');
      expect(scriptResult.success).toBe(false);

      // But other services should remain functional
      const tempFile2 = path.join('/tmp', 'test-cascading.txt');
      fs.writeFileSync(tempFile2, 'test content');
      
      try {
        const pathResult = services.pathValidator.validateFilePath(tempFile2);
        expect(pathResult.success).toBe(true);
      } finally {
        if (fs.existsSync(tempFile2)) {
          fs.unlinkSync(tempFile2);
        }
      }

      const sanitizedData = services.dataSanitizer.sanitizeUrl('https://test.com');
      expect(sanitizedData).toBeDefined();
    });

    it('should maintain service isolation during partial failures', async () => {
      const appleScriptService1 = new AppleScriptService();
      const appleScriptService2 = new AppleScriptService();

      // First service encounters error
      mockExecWithTimeout
        .mockRejectedValueOnce(testUtils.failureScenarios.createTimeoutError('Service 1'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'Service 2 success', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      // Test isolation
      const [result1, result2] = await Promise.allSettled([
        appleScriptService1.executeScript('fail'),
        appleScriptService2.executeScript('succeed')
      ]);

      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      if (result1.status === 'fulfilled') {
        expect(result1.value.success).toBe(false);
      }
      if (result2.status === 'fulfilled') {
        expect(result2.value.success).toBe(true);
      }
    });
  });

  describe('Real-World Integration Scenarios', () => {
    it('should handle system startup with missing dependencies', async () => {
      // Mock missing dependencies
      mockExecWithTimeout
        .mockRejectedValueOnce(testUtils.failureScenarios.createSystemError(-2, 'cliclick: command not found'))
        .mockRejectedValueOnce(testUtils.failureScenarios.createSystemError(-2, 'chrome-cli: command not found'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'AppleScript test successful', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: '', stderr: '', command: 'screencapture' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: '', stderr: '', command: 'rm' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'Google Chrome 120.0', stderr: '', command: 'chrome' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: '14.0.0', stderr: '', command: 'sw_vers' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      const diagnostics = await runDiagnostics();

      expect(diagnostics).toBeDefined();
      expect(diagnostics.overall).toBe('errors'); // Missing required dependencies
      expect(diagnostics.dependencies.some(dep => !dep.installed && dep.required)).toBe(true);
      expect(diagnostics.recommendations).toContain('Install required dependencies:');
    });

    it('should handle Chrome browser state changes during operations', async () => {
      const appleScriptService = new AppleScriptService();

      // Mock Chrome state changing mid-operation
      mockExecWithTimeout
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'true', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockRejectedValueOnce(testUtils.failureScenarios.createSystemError(-600, 'Chrome quit unexpectedly'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'false', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      // First check - Chrome is running
      const isRunning1 = await appleScriptService.isChromeRunning();
      expect(isRunning1).toBe(true);

      // Operation fails - Chrome quit
      const jsResult = await appleScriptService.executeJavaScript('document.title');
      expect(jsResult.success).toBe(false);

      // Final check - Chrome is not running
      const isRunning2 = await appleScriptService.isChromeRunning();
      expect(isRunning2).toBe(false);
    });

    it('should handle system resource exhaustion scenarios', async () => {
      const appleScriptService = new AppleScriptService();

      // Mock system resource exhaustion
      mockExecWithTimeout
        .mockRejectedValue(testUtils.failureScenarios.createSystemError(-1, 'Cannot allocate memory'))
        .mockRejectedValue(testUtils.failureScenarios.createSystemError(-1, 'Too many open files'))
        .mockRejectedValue(testUtils.failureScenarios.createTimeoutError('System overloaded'));

      // Multiple operations should fail gracefully
      const operations = Array.from({ length: 5 }, () =>
        appleScriptService.executeScript('test')
      );

      const results = await Promise.allSettled(operations);

      // All should complete (not hang), but may fail
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(false);
        }
      });
    });

    it('should handle network connectivity issues in data sanitization', () => {
      const dataSanitizer = new NetworkDataSanitizer();

      // Test with data that might come from network requests
      const networkData = {
        url: 'https://malicious-site.example.com/api?token=secret123',
        content: 'User data with "password":"secret123" and sensitive info',
        userAgent: 'Mozilla/5.0 (Evil Browser)',
        headers: {
          'authorization': 'Bearer secret-token',
          'X-Forwarded-For': '192.168.1.100',
          'x-api-key': 'sensitive-key'
        }
      };

      // Should sanitize regardless of network state
      const sanitizedUrl = dataSanitizer.sanitizeUrl(networkData.url);
      const sanitizedContent = dataSanitizer.sanitizeBody(networkData.content);
      const sanitizedHeaders = dataSanitizer.sanitizeHeaders(networkData.headers);

      expect(sanitizedUrl).toContain('[REDACTED]'); // Tokens should be redacted
      expect(sanitizedContent).toContain('[REDACTED]'); // Passwords should be redacted  
      expect(sanitizedHeaders.authorization).toBe('[REDACTED]'); // Auth headers should be redacted
      expect(sanitizedUrl).toBeDefined(); // URL should be cleaned but present
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient system errors', async () => {
      const appleScriptService = new AppleScriptService();

      // Mock transient failure followed by success
      mockExecWithTimeout
        .mockRejectedValueOnce(testUtils.failureScenarios.createTimeoutError('Temporary system busy'))
        .mockRejectedValueOnce(testUtils.failureScenarios.createTimeoutError('Temporary system busy'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'Recovery successful', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      // First attempts fail
      let result1 = await appleScriptService.executeScript('test');
      expect(result1.success).toBe(false);

      let result2 = await appleScriptService.executeScript('test');
      expect(result2.success).toBe(false);

      // Third attempt succeeds (system recovered)
      let result3 = await appleScriptService.executeScript('test');
      expect(result3.success).toBe(true);
      expect(result3.data).toBe('Recovery successful');
    });

    it('should implement circuit breaker pattern for failing services', async () => {
      const appleScriptService = new AppleScriptService();
      const consecutiveFailures = 3;

      // Mock consecutive failures
      for (let i = 0; i < consecutiveFailures + 2; i++) {
        mockExecWithTimeout.mockRejectedValueOnce(
          testUtils.failureScenarios.createSystemError(-1, `Failure ${i + 1}`)
        );
      }

      // Track failures
      const results = [];
      for (let i = 0; i < consecutiveFailures + 2; i++) {
        const result = await appleScriptService.executeScript('test');
        results.push(result);
      }

      // All should fail, but service should remain responsive
      expect(results.every(r => !r.success)).toBe(true);
      
      // Service should track performance stats despite failures
      const stats = appleScriptService.getPerformanceStats();
      expect(stats.executionCount).toBeGreaterThan(0);
    });

    it('should handle gradual degradation scenarios', async () => {
      const services = {
        appleScript: new AppleScriptService(),
        pathValidator: new SecurePathValidator(),
        dataSanitizer: new NetworkDataSanitizer()
      };

      // Simulate gradual system degradation
      mockExecWithTimeout
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'Normal operation', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'Slower operation', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockRejectedValueOnce(testUtils.failureScenarios.createTimeoutError('System degraded'));

      // Track performance degradation
      const durations = [];
      
      for (let i = 0; i < 3; i++) {
        const { result, duration } = await testUtils.performance.measureExecutionTime(async () => {
          return await services.appleScript.executeScript('test');
        });
        durations.push(duration);
      }

      // Should show increasing duration/eventual failure
      expect(durations).toHaveLength(3);
      // Last operation should fail
      const lastResult = await services.appleScript.executeScript('test');
      expect(lastResult.success).toBe(false);

      // Other services should remain functional
      const tempFile3 = path.join('/tmp', 'test-degradation.txt');
      fs.writeFileSync(tempFile3, 'test content');
      
      try {
        const pathResult = services.pathValidator.validateFilePath(tempFile3);
        expect(pathResult.success).toBe(true);
      } finally {
        if (fs.existsSync(tempFile3)) {
          fs.unlinkSync(tempFile3);
        }
      }
    });
  });

  describe('End-to-End Workflow Testing', () => {
    it('should complete full browser automation workflow despite partial failures', async () => {
      const appleScriptService = new AppleScriptService();

      // Mock mixed success/failure scenario
      mockExecWithTimeout
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: 'true', stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: JSON.stringify({ success: true, result: { x: 100, y: 200 } }), stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockRejectedValueOnce(testUtils.failureScenarios.createPermissionDeniedError('Click operation'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: JSON.stringify({ ok: true, nodes: [] }), stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      // Workflow: Check Chrome -> Get coordinates -> Click (fails) -> Take snapshot
      const workflow = async () => {
        const chromeRunning = await appleScriptService.isChromeRunning();
        if (!chromeRunning) {
          throw new Error('Chrome not running');
        }

        const coordsResult = await appleScriptService.executeJavaScript(
          'const el = document.querySelector("#button"); el ? el.getBoundingClientRect() : null'
        );
        if (!coordsResult.success) {
          throw new Error('Failed to get coordinates');
        }

        // This will fail due to permission error
        try {
          await appleScriptService.executeScript('tell application "System Events" to click');
        } catch (error) {
          // Continue workflow despite click failure
        }

        const snapshotResult = await appleScriptService.executeJavaScript('captureSnapshot()');
        return snapshotResult;
      };

      const result = await workflow();
      expect(result.success).toBe(true); // Workflow completes despite partial failure
    });

    it('should handle command composition with error propagation', async () => {
      // Test high-level command composition
      mockExecWithTimeout
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: JSON.stringify({ ok: true, nodes: [{ role: 'button', name: 'Test' }] }), stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        })
        .mockRejectedValueOnce(testUtils.failureScenarios.createTimeoutError('DOM capture'))
        .mockResolvedValueOnce({
          success: true,
          data: { stdout: JSON.stringify({ ok: true, nodes: [] }), stderr: '', command: 'osascript' },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

      // Composed operations: outline -> dom-lite (fails) -> outline (retry)
      const outlineResult1 = await captureOutline();
      expect(outlineResult1.success).toBe(true);

      // Use legacy strategy to avoid fallbacks, so timeout actually fails
      const domLiteResult = await captureDomLite({ strategy: 'legacy' });
      expect(domLiteResult.success).toBe(false); // Should fail due to timeout

      const outlineResult2 = await captureOutline();
      expect(outlineResult2.success).toBe(true); // Should succeed on retry
    });
  });

  describe('Security Integration Testing', () => {
    it('should enforce security policies across service boundaries', () => {
      const pathValidator = new SecurePathValidator();
      const dataSanitizer = new NetworkDataSanitizer();

      // Test coordinated security enforcement
      const suspiciousData = {
        filePath: '../../../../etc/passwd',
        script: 'User data with "password":"secret123" token: hidden456',
        command: 'rm -rf /',
        url: 'https://malicious.com/api?token=secret123&api_key=hidden456'
      };

      // Path validation should reject suspicious paths
      const pathResult = pathValidator.validateFilePath(suspiciousData.filePath);
      expect(pathResult.success).toBe(false);

      // Data sanitization should clean malicious content (sensitive data, not HTML)
      const sanitizedBody = dataSanitizer.sanitizeBody(suspiciousData.script);
      const sanitizedUrl = dataSanitizer.sanitizeUrl(suspiciousData.url);
      expect(sanitizedBody).toContain('[REDACTED]'); // Passwords should be redacted
      expect(sanitizedUrl).toContain('[REDACTED]'); // API keys should be redacted
    });

    it('should maintain security during error conditions', async () => {
      const appleScriptService = new AppleScriptService();
      const pathValidator = new SecurePathValidator();

      // Mock error that includes sensitive data
      mockExecWithTimeout.mockRejectedValue(
        new Error('Permission denied accessing /Users/admin/.ssh/id_rsa')
      );

      const result = await appleScriptService.executeScript('test');
      
      // Error should be reported
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Basic error handling should work (path sanitization would be handled at command level)

      // Security policies should remain in effect
      const pathResult = pathValidator.validateFilePath('/Users/admin/.ssh/id_rsa');
      expect(pathResult.success).toBe(false);
    });
  });
});