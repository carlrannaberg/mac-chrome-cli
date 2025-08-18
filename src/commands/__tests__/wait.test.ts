import { waitIdle } from '../wait';
import { ERROR_CODES } from '../../lib/util';

describe('Wait Command', () => {
  describe('waitIdle', () => {
    it('should wait for the default duration when no options provided', async () => {
      const startTime = Date.now();
      const result = await waitIdle();
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.code).toBe(ERROR_CODES.OK);
      expect(result.data?.success).toBe(true);
      expect(result.data?.cmd).toBe('wait idle');
      expect(result.data?.durationMs).toBe(800); // default
      expect(result.data?.actualMs).toBeGreaterThanOrEqual(800);
      expect(result.data?.actualMs).toBeLessThan(900); // allow more variance for CI environments
      expect(actualDuration).toBeGreaterThanOrEqual(800);
      expect(result.data?.timestamp).toBeDefined();
    });

    it('should wait for the specified duration', async () => {
      const requestedMs = 100;
      const startTime = Date.now();
      const result = await waitIdle({ milliseconds: requestedMs });
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.code).toBe(ERROR_CODES.OK);
      expect(result.data?.success).toBe(true);
      expect(result.data?.cmd).toBe('wait idle');
      expect(result.data?.durationMs).toBe(requestedMs);
      expect(result.data?.actualMs).toBeGreaterThanOrEqual(requestedMs);
      expect(result.data?.actualMs).toBeLessThan(requestedMs + 100); // allow more variance for CI environments
      // System timing can be imprecise, allow small variance
      expect(actualDuration).toBeGreaterThanOrEqual(requestedMs - 5);
    });

    it('should reject invalid milliseconds input', async () => {
      const invalidInputs = [
        { milliseconds: NaN, expectedError: 'Invalid milliseconds value' },
        { milliseconds: Infinity, expectedError: 'Wait duration too long' },
        { milliseconds: -Infinity, expectedError: 'Invalid milliseconds value' }
      ];

      for (const input of invalidInputs) {
        const result = await waitIdle({ milliseconds: input.milliseconds });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain(input.expectedError);
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      }
    });

    it('should reject durations that are too short', async () => {
      const result = await waitIdle({ milliseconds: 0 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Wait duration too short');
      expect(result.error).toContain('Minimum is 1ms');
      expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
    });

    it('should reject durations that are too long', async () => {
      const maxMs = 10 * 60 * 1000; // 10 minutes
      const result = await waitIdle({ milliseconds: maxMs + 1 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Wait duration too long');
      expect(result.error).toContain('Maximum is 600000ms');
      expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
    });

    it('should accept valid boundary values', async () => {
      // Test minimum valid value
      const minResult = await waitIdle({ milliseconds: 1 });
      expect(minResult.success).toBe(true);
      expect(minResult.data?.durationMs).toBe(1);
      
      const testResult = await waitIdle({ milliseconds: 50 });
      expect(testResult.success).toBe(true);
      expect(testResult.data?.durationMs).toBe(50);
    });

    it('should handle the minimum wait time accurately', async () => {
      const startTime = Date.now();
      const result = await waitIdle({ milliseconds: 1 });
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.data?.durationMs).toBe(1);
      expect(result.data?.actualMs).toBeGreaterThanOrEqual(1);
      // System timing precision may cause very short waits to complete in 0ms
      expect(actualDuration).toBeGreaterThanOrEqual(0);
      // Even 1ms waits might take slightly longer due to system scheduling
      expect(actualDuration).toBeLessThan(100); // more lenient for CI environments
    });

    it('should include proper timestamp in result', async () => {
      const beforeTest = Date.now();
      const result = await waitIdle({ milliseconds: 10 });
      const afterTest = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.data?.timestamp).toBeDefined();
      
      // Check that timestamp is within the test execution window
      const resultTimestamp = new Date(result.data?.timestamp!).getTime();
      expect(resultTimestamp).toBeGreaterThanOrEqual(beforeTest);
      expect(resultTimestamp).toBeLessThanOrEqual(afterTest);
    });

    it('should report accurate timing measurements', async () => {
      const requestedMs = 50;
      const result = await waitIdle({ milliseconds: requestedMs });
      
      expect(result.success).toBe(true);
      expect(result.data?.actualMs).toBeGreaterThanOrEqual(requestedMs);
      expect(result.data?.actualMs).toBeLessThan(requestedMs + 100); // Allow more variance for CI environments
      
      // Actual time should be close to requested time
      const variance = Math.abs(result.data!.actualMs - result.data!.durationMs);
      expect(variance).toBeLessThan(100); // Less than 100ms variance expected for CI environments
    });
  });
});