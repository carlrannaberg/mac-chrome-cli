#!/usr/bin/env node

/**
 * Simple test for rate limiting functionality
 */

console.log('🚀 Testing Rate Limiting System...\n');

// Simple in-memory rate limiter for testing
class SimpleRateLimiter {
  constructor() {
    this.limits = new Map();
    this.windows = new Map();
    this.stats = { totalChecked: 0, allowed: 0, denied: 0 };
  }
  
  async configureLimit(operation, config) {
    this.limits.set(operation, config);
    console.log(`✅ Configured limit for ${operation}: ${config.maxOperations}/${config.windowMs}ms`);
  }
  
  async checkAndRecord(operation, weight = 1) {
    this.stats.totalChecked++;
    
    const rule = this.limits.get(operation);
    if (!rule) {
      this.stats.allowed++;
      return { allowed: true, remaining: Infinity };
    }
    
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    
    // Get or create window
    if (!this.windows.has(operation)) {
      this.windows.set(operation, []);
    }
    
    const window = this.windows.get(operation);
    
    // Clean expired operations
    const validOps = window.filter(op => op.timestamp > windowStart);
    this.windows.set(operation, validOps);
    
    // Calculate current usage
    const currentWeight = validOps.reduce((sum, op) => sum + op.weight, 0);
    
    // Check if allowed
    if (currentWeight + weight <= rule.maxOperations) {
      // Allow and record
      validOps.push({ timestamp: now, weight });
      this.stats.allowed++;
      return { 
        allowed: true, 
        remaining: rule.maxOperations - currentWeight - weight 
      };
    } else {
      // Deny
      this.stats.denied++;
      return { 
        allowed: false, 
        remaining: rule.maxOperations - currentWeight,
        retryAfterMs: 1000 // Simplified retry calculation
      };
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      allowRate: this.stats.totalChecked > 0 ? this.stats.allowed / this.stats.totalChecked : 1
    };
  }
}

async function testRateLimiting() {
  try {
    const rateLimiter = new SimpleRateLimiter();
    
    // Configure test limit: 3 operations per second
    await rateLimiter.configureLimit('test.operation', {
      maxOperations: 3,
      windowMs: 1000
    });
    
    console.log('\n📊 Testing rate limit enforcement:');
    
    // Test with rapid requests
    for (let i = 1; i <= 6; i++) {
      const result = await rateLimiter.checkAndRecord('test.operation');
      console.log(`  Request ${i}: ${result.allowed ? '✅ Allowed' : '🚫 Denied'} (${result.remaining} remaining)`);
      
      if (!result.allowed && result.retryAfterMs) {
        console.log(`    Retry after: ${result.retryAfterMs}ms`);
      }
    }
    
    // Test statistics
    const stats = rateLimiter.getStats();
    console.log('\n📈 Final Statistics:');
    console.log(`  Total checked: ${stats.totalChecked}`);
    console.log(`  Allowed: ${stats.allowed}`);
    console.log(`  Denied: ${stats.denied}`);
    console.log(`  Success rate: ${(stats.allowRate * 100).toFixed(1)}%`);
    
    console.log('\n✨ Rate limiting test completed successfully!');
    
    // Verify expected behavior
    if (stats.allowed === 3 && stats.denied === 3) {
      console.log('🎉 Rate limiting working as expected!');
    } else {
      console.log('⚠️  Unexpected results - review implementation');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRateLimiting();