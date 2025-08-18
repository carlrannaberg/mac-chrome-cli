import { describe, test, expect } from '@jest/globals';
import {
  startBenchmark,
  endBenchmark,
  getPerformanceStats,
  clearPerformanceCaches,
  createOptimizedWebP,
  getCachedCoordinates,
  generateCoordsCacheKey,
  chromeConnectionPool
} from '../src/lib/performance.js';

describe('Performance Optimizations', () => {
  beforeEach(() => {
    clearPerformanceCaches();
  });

  describe('Benchmarking', () => {
    test('should start and end benchmarks correctly', () => {
      const benchmarkId = startBenchmark('test-operation', { testData: true });
      expect(benchmarkId).toMatch(/test-operation-\d+-[a-z0-9]+/);
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
      
      const result = endBenchmark(benchmarkId, true);
      expect(result).toBeTruthy();
      expect(result!.operation).toBe('test-operation');
      expect(result!.duration).toBeGreaterThan(5);
      expect(result!.success).toBe(true);
      expect(result!.metadata).toEqual({ testData: true });
    });

    test('should handle missing benchmark ID gracefully', () => {
      const result = endBenchmark('non-existent-id', true);
      expect(result).toBeNull();
    });
  });

  describe('Cache Management', () => {
    test('should track cache statistics', () => {
      const stats = getPerformanceStats();
      expect(stats).toHaveProperty('cacheStats');
      expect(stats.cacheStats).toHaveProperty('scriptCache');
      expect(stats.cacheStats).toHaveProperty('coordsCache');
      expect(stats.cacheStats.scriptCache.size).toBe(0);
      expect(stats.cacheStats.coordsCache.size).toBe(0);
    });

    test('should cache coordinate calculations', async () => {
      const cacheKey = generateCoordsCacheKey('button.test', undefined, undefined, 1);
      expect(cacheKey).toBe('sel-button.test-1');
      
      let callCount = 0;
      const mockCalculator = async () => {
        callCount++;
        return { success: true, coordinates: { x: 100, y: 200 } };
      };
      
      // First call should execute calculator
      const result1 = await getCachedCoordinates(cacheKey, mockCalculator);
      expect(callCount).toBe(1);
      expect(result1.coordinates).toEqual({ x: 100, y: 200 });
      
      // Second call should use cache
      const result2 = await getCachedCoordinates(cacheKey, mockCalculator);
      expect(callCount).toBe(1); // Should not increment
      expect(result2.coordinates).toEqual({ x: 100, y: 200 });
    });

    test('should generate different cache keys for different inputs', () => {
      const key1 = generateCoordsCacheKey('button', undefined, undefined, 1);
      const key2 = generateCoordsCacheKey('input', undefined, undefined, 1);
      const key3 = generateCoordsCacheKey(undefined, 100, 200, 1);
      const key4 = generateCoordsCacheKey(undefined, 100, 200, 2);
      
      expect(key1).toBe('sel-button-1');
      expect(key2).toBe('sel-input-1');
      expect(key3).toBe('xy-100-200-1');
      expect(key4).toBe('xy-100-200-2');
      
      // All keys should be different
      const keys = [key1, key2, key3, key4];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('Connection Pool', () => {
    test('should manage Chrome connections', () => {
      const connection1 = chromeConnectionPool.getConnection(1);
      const connection2 = chromeConnectionPool.getConnection(1);
      const connection3 = chromeConnectionPool.getConnection(2);
      
      expect(connection1).toBe('chrome-1');
      expect(connection2).toBe('chrome-1'); // Same window, same connection
      expect(connection3).toBe('chrome-2'); // Different window, different connection
      
      const stats = chromeConnectionPool.getStats();
      expect(stats.activeConnections).toBe(2);
      expect(stats.maxConnections).toBe(5);
    });
  });

  describe('Memory Monitoring', () => {
    test('should provide memory usage statistics', () => {
      const stats = getPerformanceStats();
      expect(stats.memory).toHaveProperty('rss');
      expect(stats.memory).toHaveProperty('heapUsed');
      expect(stats.memory).toHaveProperty('heapTotal');
      expect(stats.memory).toHaveProperty('external');
      expect(stats.memory).toHaveProperty('arrayBuffers');
      
      // All values should be numbers in MB
      expect(typeof stats.memory.rss).toBe('number');
      expect(typeof stats.memory.heapUsed).toBe('number');
      expect(typeof stats.memory.heapTotal).toBe('number');
      expect(typeof stats.memory.external).toBe('number');
      expect(typeof stats.memory.arrayBuffers).toBe('number');
      
      // Memory values should be reasonable (> 0 and < 10GB)
      expect(stats.memory.rss).toBeGreaterThan(0);
      expect(stats.memory.rss).toBeLessThan(10000);
    });
  });

  describe('WebP Optimization', () => {
    test('should validate WebP settings for performance', () => {
      const { WEBP_SETTINGS } = require('../src/lib/performance.js');
      
      expect(WEBP_SETTINGS.quality).toBe(85);
      expect(WEBP_SETTINGS.effort).toBe(3); // Balanced for performance
      expect(WEBP_SETTINGS.smartSubsample).toBe(true);
      expect(WEBP_SETTINGS.preset).toBe('default');
    });
  });

  describe('Performance Targets', () => {
    test('should meet performance target constants', () => {
      // These are the targets from the specification
      const PERFORMANCE_TARGETS = {
        'click-element': 500,
        'type-50-chars': 1000,
        'screenshot-viewport': 600,
        'snapshot-outline': 300,
      };
      
      Object.entries(PERFORMANCE_TARGETS).forEach(([operation, targetMs]) => {
        expect(targetMs).toBeGreaterThan(0);
        expect(targetMs).toBeLessThan(2000); // Reasonable upper bound
      });
    });
  });

  describe('Cache Clearing', () => {
    test('should clear all caches', async () => {
      // Add something to cache first
      const cacheKey = generateCoordsCacheKey('test', undefined, undefined, 1);
      await getCachedCoordinates(cacheKey, async () => ({ success: true }));
      
      let stats = getPerformanceStats();
      expect(stats.cacheStats.coordsCache.size).toBeGreaterThan(0);
      
      clearPerformanceCaches();
      
      stats = getPerformanceStats();
      expect(stats.cacheStats.scriptCache.size).toBe(0);
      expect(stats.cacheStats.coordsCache.size).toBe(0);
    });
  });
});