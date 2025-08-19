#!/usr/bin/env node

/**
 * Simple test script to verify rate limiting works
 */

async function testBasicRateLimiting() {
  console.log('🚀 Testing Rate Limiting System...\n');
  
  try {
    // Import the rate limiter service
    const { RateLimiterService } = await import('./dist/di/services/RateLimiterService.js');
    
    console.log('✅ Successfully imported RateLimiterService');
    
    // Create rate limiter instance
    const rateLimiter = new RateLimiterService();
    console.log('✅ Successfully created RateLimiterService instance');
    
    // Configure a test limit
    await rateLimiter.configureLimit('test.operation', {
      maxOperations: 3,
      windowMs: 1000,
      algorithm: 'sliding_window'
    });
    console.log('✅ Successfully configured rate limit');
    
    // Test rate limiting
    console.log('\n📊 Testing rate limit enforcement:');
    
    for (let i = 1; i <= 5; i++) {
      const result = await rateLimiter.checkAndRecord('test.operation');
      console.log(`  Request ${i}: ${result.allowed ? '✅ Allowed' : '🚫 Denied'} (${result.remaining} remaining)`);
    }
    
    // Get statistics
    const stats = await rateLimiter.getStats();
    console.log('\n📈 Statistics:');
    console.log(`  Total checked: ${stats.totalChecked}`);
    console.log(`  Allowed: ${stats.allowed}`);
    console.log(`  Denied: ${stats.denied}`);
    console.log(`  Success rate: ${(stats.allowRate * 100).toFixed(1)}%`);
    
    // Cleanup
    rateLimiter.destroy();
    console.log('\n✨ Rate limiting test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testBasicRateLimiting();