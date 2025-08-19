/**
 * @fileoverview Rate limiter service tests
 * 
 * Tests for the comprehensive rate limiting service implementation
 * covering all algorithms and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RateLimiterService } from '../services/RateLimiterService.js';

describe('RateLimiterService', () => {
  let rateLimiter: RateLimiterService;
  
  beforeEach(() => {
    rateLimiter = new RateLimiterService();
  });
  
  afterEach(() => {
    rateLimiter.destroy();
  });
  
  describe('Basic Rate Limiting', () => {
    it('should allow operations within limits', async () => {
      await rateLimiter.configureLimit('test.operation', {
        maxOperations: 5,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      const result = await rateLimiter.checkLimit('test.operation');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
    
    it('should deny operations when limit exceeded', async () => {
      await rateLimiter.configureLimit('test.operation', {
        maxOperations: 2,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // Use up the limit
      await rateLimiter.checkAndRecord('test.operation');
      await rateLimiter.checkAndRecord('test.operation');
      
      // Should be denied now
      const result = await rateLimiter.checkLimit('test.operation');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
    
    it('should reset limits after window expires', async () => {
      await rateLimiter.configureLimit('test.operation', {
        maxOperations: 1,
        windowMs: 100, // Short window
        algorithm: 'sliding_window'
      });
      
      // Use up the limit
      await rateLimiter.checkAndRecord('test.operation');
      
      // Should be denied
      const deniedResult = await rateLimiter.checkLimit('test.operation');
      expect(deniedResult.allowed).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be allowed again
      const allowedResult = await rateLimiter.checkLimit('test.operation');
      expect(allowedResult.allowed).toBe(true);
    });
  });
  
  describe('Token Bucket Algorithm', () => {
    it('should allow burst operations with token bucket', async () => {
      await rateLimiter.configureLimit('test.burst', {
        maxOperations: 5,
        windowMs: 1000,
        algorithm: 'token_bucket',
        burstSize: 10
      });
      
      // Should allow burst up to burstSize
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkAndRecord('test.burst');
        expect(result.allowed).toBe(true);
      }
      
      // 11th should be denied
      const result = await rateLimiter.checkLimit('test.burst');
      expect(result.allowed).toBe(false);
    });
    
    it('should refill tokens over time', async () => {
      await rateLimiter.configureLimit('test.refill', {
        maxOperations: 5,
        windowMs: 100, // 5 operations per 100ms = 0.05 operations per ms
        algorithm: 'token_bucket',
        burstSize: 5
      });
      
      // Use up initial tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkAndRecord('test.refill');
      }
      
      // Should be denied
      let result = await rateLimiter.checkLimit('test.refill');
      expect(result.allowed).toBe(false);
      
      // Wait for some refill
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should have some tokens back
      result = await rateLimiter.checkLimit('test.refill');
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('Fixed Window Algorithm', () => {
    it('should reset at fixed intervals', async () => {
      await rateLimiter.configureLimit('test.fixed', {
        maxOperations: 2,
        windowMs: 100,
        algorithm: 'fixed_window'
      });
      
      // Use up limit
      await rateLimiter.checkAndRecord('test.fixed');
      await rateLimiter.checkAndRecord('test.fixed');
      
      // Should be denied
      let result = await rateLimiter.checkLimit('test.fixed');
      expect(result.allowed).toBe(false);
      
      // Wait for next window
      await new Promise(resolve => setTimeout(resolve, 120));
      
      // Should be allowed in new window
      result = await rateLimiter.checkAndRecord('test.fixed');
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('Pattern Matching', () => {
    it('should match wildcard patterns', async () => {
      await rateLimiter.configureLimit('screenshot.*', {
        maxOperations: 3,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // Both should use the same limit
      const result1 = await rateLimiter.checkLimit('screenshot.viewport');
      const result2 = await rateLimiter.checkLimit('screenshot.element');
      
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
    
    it('should prefer more specific patterns', async () => {
      // More specific rule
      await rateLimiter.configureLimit('screenshot.viewport', {
        maxOperations: 5,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // General rule
      await rateLimiter.configureLimit('screenshot.*', {
        maxOperations: 2,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      const result = await rateLimiter.checkLimit('screenshot.viewport');
      
      // Should use the more specific rule (5 operations)
      expect(result.remaining).toBe(5);
    });
  });
  
  describe('Statistics and Monitoring', () => {
    it('should track operation statistics', async () => {
      await rateLimiter.configureLimit('test.stats', {
        maxOperations: 10,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // Perform some operations
      await rateLimiter.checkAndRecord('test.stats');
      await rateLimiter.checkAndRecord('test.stats');
      await rateLimiter.checkLimit('test.stats'); // Just check, don't record
      
      const stats = await rateLimiter.getStats();
      
      expect(stats.totalChecked).toBe(3);
      expect(stats.allowed).toBe(3);
      expect(stats.denied).toBe(0);
      expect(stats.allowRate).toBe(1.0);
    });
    
    it('should track memory usage', async () => {
      const stats = await rateLimiter.getStats();
      
      expect(stats.memoryUsageKB).toBeGreaterThan(0);
    });
  });
  
  describe('Weight Support', () => {
    it('should handle weighted operations', async () => {
      await rateLimiter.configureLimit('test.weighted', {
        maxOperations: 10,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // Heavy operation worth 5 units
      const result1 = await rateLimiter.checkAndRecord('test.weighted', 5);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(5);
      
      // Another heavy operation should leave 0 remaining
      const result2 = await rateLimiter.checkAndRecord('test.weighted', 5);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(0);
      
      // Any more should be denied
      const result3 = await rateLimiter.checkLimit('test.weighted', 1);
      expect(result3.allowed).toBe(false);
    });
  });
  
  describe('Configuration Management', () => {
    it('should allow runtime limit configuration', async () => {
      await rateLimiter.configureLimit('test.config', {
        maxOperations: 5,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      const limit = await rateLimiter.getLimit('test.config');
      
      expect(limit).toBeDefined();
      expect(limit!.maxOperations).toBe(5);
      expect(limit!.algorithm).toBe('sliding_window');
    });
    
    it('should allow limit removal', async () => {
      await rateLimiter.configureLimit('test.remove', {
        maxOperations: 5,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      const removed = await rateLimiter.removeLimit('test.remove');
      expect(removed).toBe(true);
      
      const limit = await rateLimiter.getLimit('test.remove');
      expect(limit).toBeUndefined();
    });
    
    it('should support limit adjustment', async () => {
      await rateLimiter.configureLimit('test.adjust', {
        maxOperations: 10,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // Halve the limits for 100ms
      await rateLimiter.adjustLimit('test.adjust', 0.5, 100);
      
      const limit = await rateLimiter.getLimit('test.adjust');
      expect(limit!.maxOperations).toBe(5);
      
      // Wait for adjustment to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be back to original
      const restoredLimit = await rateLimiter.getLimit('test.adjust');
      expect(restoredLimit!.maxOperations).toBe(10);
    });
  });
  
  describe('Cleanup and Maintenance', () => {
    it('should clean up expired data', async () => {
      await rateLimiter.configureLimit('test.cleanup', {
        maxOperations: 5,
        windowMs: 50, // Very short window
        algorithm: 'sliding_window'
      });
      
      // Add some operations
      await rateLimiter.checkAndRecord('test.cleanup');
      await rateLimiter.checkAndRecord('test.cleanup');
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cleanedCount = await rateLimiter.cleanup();
      expect(cleanedCount).toBeGreaterThan(0);
    });
    
    it('should reset specific operations', async () => {
      await rateLimiter.configureLimit('test.reset', {
        maxOperations: 1,
        windowMs: 1000,
        algorithm: 'sliding_window'
      });
      
      // Use up the limit
      await rateLimiter.checkAndRecord('test.reset');
      
      let result = await rateLimiter.checkLimit('test.reset');
      expect(result.allowed).toBe(false);
      
      // Reset the operation
      await rateLimiter.reset('test.reset');
      
      // Should be allowed again
      result = await rateLimiter.checkLimit('test.reset');
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid rule configuration', async () => {
      await expect(rateLimiter.configureLimit('test.invalid', {
        maxOperations: 0, // Invalid
        windowMs: 1000,
        algorithm: 'sliding_window'
      })).rejects.toThrow('maxOperations must be positive');
    });
    
    it('should handle operations without limits gracefully', async () => {
      // Remove global default rule to test true unlimited behavior
      await rateLimiter.removeLimit('*');
      
      const result = await rateLimiter.checkLimit('unlimited.operation');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });
});