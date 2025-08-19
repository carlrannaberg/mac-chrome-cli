/**
 * Performance regression tests for snapshot optimization
 * 
 * These tests ensure that the O(n) complexity improvements are maintained
 * over time and detect any performance regressions in the DOM traversal algorithms.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { runSnapshotBenchmark, analyzeBenchmarkResults, type BenchmarkResult } from '../src/performance/SnapshotBenchmark.js';

describe('Snapshot Performance Regression Tests', () => {
  // Define performance baselines
  const PERFORMANCE_BASELINES = {
    // Time per node should remain under these thresholds (microseconds)
    maxTimePerNodeUs: {
      small: 50,   // For 100-500 nodes
      medium: 75,  // For 500-2000 nodes  
      large: 100   // For 2000+ nodes
    },
    // Memory per node should remain under these thresholds (KB)
    maxMemoryPerNodeKB: {
      small: 2,    // For 100-500 nodes
      medium: 5,   // For 500-2000 nodes
      large: 8     // For 2000+ nodes
    },
    // Maximum acceptable duration for operations (ms)
    maxDurationMs: {
      outline100: 50,
      outline1000: 200,
      outline3000: 400,
      domLite100: 75,
      domLite1000: 300,
      domLite3000: 600
    }
  };

  let testResults: BenchmarkResult[] = [];

  beforeAll(async () => {
    // Skip performance tests unless explicitly enabled
    if (!process.env.RUN_PERFORMANCE_TESTS) {
      console.log('Skipping performance tests - set RUN_PERFORMANCE_TESTS=true to enable');
      return;
    }
    
    // Skip in CI if Chrome is not available or if we detect resource constraints
    if (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin')) {
      console.log('Skipping performance tests due to environment constraints');
      return;
    }
  });

  afterAll(() => {
    // Log summary of all regression tests
    if (testResults.length > 0) {
      const analysis = analyzeBenchmarkResults(testResults);
      console.log('\\n📊 Performance Regression Test Summary:');
      console.log(`  Overall Complexity: ${analysis.overallComplexity}`);
      console.log(`  Pass Rate: ${(analysis.passRate * 100).toFixed(1)}%`);
      console.log(`  Linearity Score: ${analysis.detailedAnalysis.linearityScore.toFixed(1)}/100`);
      
      if (analysis.overallComplexity !== 'linear') {
        console.warn('⚠️ Performance regression detected - algorithm not maintaining linear complexity');
      }
    }
  });

  describe('Outline Mode Performance', () => {
    test('should maintain O(n) complexity for small DOM (100 nodes)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log('Skipping performance test due to environment constraints');
        return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Small Outline',
        100,
        'outline'
      );
      
      testResults.push(result);

      expect(result.complexityIndicator).toBe('linear');
      expect(result.timePerNodeUs).toBeLessThan(PERFORMANCE_BASELINES.maxTimePerNodeUs.small);
      expect(result.memoryPerNodeKB).toBeLessThan(PERFORMANCE_BASELINES.maxMemoryPerNodeKB.small);
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.outline100);
    }, 30000);

    test('should scale linearly for medium DOM (1000 nodes)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log('Skipping performance test due to environment constraints');
        return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Medium Outline',
        1000,
        'outline'
      );
      
      testResults.push(result);

      expect(result.complexityIndicator).toBe('linear');
      expect(result.timePerNodeUs).toBeLessThan(PERFORMANCE_BASELINES.maxTimePerNodeUs.medium);
      expect(result.memoryPerNodeKB).toBeLessThan(PERFORMANCE_BASELINES.maxMemoryPerNodeKB.medium);
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.outline1000);
    }, 45000);

    test('should handle large DOM efficiently (3000 nodes)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Large Outline',
        3000,
        'outline'
      );
      
      testResults.push(result);

      // Large DOM may show some performance degradation but should still be reasonable
      expect(result.timePerNodeUs).toBeLessThan(PERFORMANCE_BASELINES.maxTimePerNodeUs.large);
      expect(result.memoryPerNodeKB).toBeLessThan(PERFORMANCE_BASELINES.maxMemoryPerNodeKB.large);
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.outline3000);
    }, 60000);
  });

  describe('DOM-Lite Mode Performance', () => {
    test('should maintain O(n) complexity for hierarchical traversal (100 nodes)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Small DOM-lite',
        100,
        'dom-lite',
        { maxDepth: 10 }
      );
      
      testResults.push(result);

      expect(result.complexityIndicator).toBe('linear');
      expect(result.timePerNodeUs).toBeLessThan(PERFORMANCE_BASELINES.maxTimePerNodeUs.small);
      expect(result.memoryPerNodeKB).toBeLessThan(PERFORMANCE_BASELINES.maxMemoryPerNodeKB.small);
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.domLite100);
    }, 30000);

    test('should scale linearly with hierarchy depth (1000 nodes)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Medium DOM-lite',
        1000,
        'dom-lite',
        { maxDepth: 15 }
      );
      
      testResults.push(result);

      expect(result.complexityIndicator).toBe('linear');
      expect(result.timePerNodeUs).toBeLessThan(PERFORMANCE_BASELINES.maxTimePerNodeUs.medium);
      expect(result.memoryPerNodeKB).toBeLessThan(PERFORMANCE_BASELINES.maxMemoryPerNodeKB.medium);
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.domLite1000);
    }, 45000);

    test('should prevent stack overflow on deep hierarchies (3000 nodes)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Large DOM-lite',
        3000,
        'dom-lite',
        { maxDepth: 20 }
      );
      
      testResults.push(result);

      // Should complete without stack overflow
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.domLite3000);
      expect(result.metadata?.error).toBeUndefined();
      
      // Verify iterative traversal is being used
      const algorithms = result.metadata?.snapshotMetadata?.performance?.algorithmsUsed || [];
      expect(algorithms).toContain('Iterative traversal to prevent stack overflow');
    }, 60000);
  });

  describe('Optimization Technique Validation', () => {
    test('should use TreeWalker for optimal DOM traversal', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: TreeWalker usage',
        500,
        'outline'
      );
      
      testResults.push(result);

      const algorithms = result.metadata?.snapshotMetadata?.performance?.algorithmsUsed || [];
      expect(algorithms).toContain('TreeWalker for interactive elements');
    }, 30000);

    test('should use WeakMap for O(1) child lookups in DOM-lite mode', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: WeakMap usage',
        500,
        'dom-lite'
      );
      
      testResults.push(result);

      const algorithms = result.metadata?.snapshotMetadata?.performance?.algorithmsUsed || [];
      expect(algorithms).toContain('WeakMap for O(1) child lookups');
    }, 30000);

    test('should use pre-computed selector caches', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      const result = await runSnapshotBenchmark(
        'Regression: Selector caching',
        500,
        'outline'
      );
      
      testResults.push(result);

      const algorithms = result.metadata?.snapshotMetadata?.performance?.algorithmsUsed || [];
      expect(algorithms).toContain('Pre-computed selector caches');
    }, 30000);
  });

  describe('Memory Efficiency Regression', () => {
    test('should maintain stable memory usage across different DOM sizes', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      // Test multiple sizes to validate memory scaling
      const sizes = [200, 500, 1000];
      const memoryResults: BenchmarkResult[] = [];

      for (const size of sizes) {
        const result = await runSnapshotBenchmark(
          `Memory test ${size}`,
          size,
          'outline'
        );
        memoryResults.push(result);
        testResults.push(result);
      }

      // Memory usage should scale sub-linearly due to optimizations
      const memoryPerNodeValues = memoryResults.map(r => r.memoryPerNodeKB);
      
      // Larger DOMs should not have proportionally higher memory per node
      expect(memoryPerNodeValues[2]).toBeLessThanOrEqual(memoryPerNodeValues[0] * 2);
      
      // All should be under efficiency thresholds
      memoryResults.forEach((result, index) => {
        const threshold = index === 0 ? PERFORMANCE_BASELINES.maxMemoryPerNodeKB.small :
                         index === 1 ? PERFORMANCE_BASELINES.maxMemoryPerNodeKB.medium :
                         PERFORMANCE_BASELINES.maxMemoryPerNodeKB.large;
        expect(result.memoryPerNodeKB).toBeLessThan(threshold);
      });
    }, 90000);
  });

  describe('Comparative Performance Analysis', () => {
    test('should validate complexity is truly O(n) not O(n²)', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      // Test two significantly different sizes
      const smallResult = await runSnapshotBenchmark(
        'Complexity: Small',
        300,
        'outline'
      );
      
      const largeResult = await runSnapshotBenchmark(
        'Complexity: Large',
        1200, // 4x larger
        'outline'
      );
      
      testResults.push(smallResult, largeResult);

      // For O(n) algorithm, 4x nodes should result in roughly 4x time
      // For O(n²) algorithm, 4x nodes would result in roughly 16x time
      const sizeRatio = largeResult.nodeCount / smallResult.nodeCount;
      const timeRatio = largeResult.durationMs / smallResult.durationMs;
      
      // Time ratio should be close to size ratio (within 2x) for linear algorithm
      expect(timeRatio).toBeLessThan(sizeRatio * 2);
      expect(timeRatio).toBeGreaterThan(sizeRatio * 0.5);
      
      // Both should maintain linear characteristics
      expect(smallResult.complexityIndicator).toBe('linear');
      expect(largeResult.complexityIndicator).toBe('linear');
    }, 60000);
  });

  describe('Error Handling Performance', () => {
    test('should handle edge cases without performance degradation', async () => {
      if (!process.env.RUN_PERFORMANCE_TESTS || (process.env.CI && (!process.env.CHROME_AVAILABLE || process.platform === 'darwin'))) {
        console.log("Skipping performance test due to environment constraints"); return;
      }

      // Test with visible-only filtering which can be more complex
      const result = await runSnapshotBenchmark(
        'Regression: Visible-only filtering',
        1000,
        'outline',
        { visibleOnly: true }
      );
      
      testResults.push(result);

      // Should still meet performance targets even with additional filtering
      expect(result.timePerNodeUs).toBeLessThan(PERFORMANCE_BASELINES.maxTimePerNodeUs.medium * 1.5);
      expect(result.durationMs).toBeLessThan(PERFORMANCE_BASELINES.maxDurationMs.outline1000 * 1.3);
    }, 45000);
  });
});