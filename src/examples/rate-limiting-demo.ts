/**
 * @fileoverview Rate limiting demonstration
 * 
 * This example demonstrates how the rate limiting system protects against
 * resource exhaustion while providing clear feedback and recovery options.
 * 
 * @example
 * ```bash
 * # Run the rate limiting demo
 * npx tsx src/examples/rate-limiting-demo.ts
 * ```
 */

import { createServiceContainer } from '../di/ServiceRegistry.js';
import { ScreenshotCommand } from '../commands/screenshot.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import { RateLimitUtils } from '../core/RateLimitedCommandBase.js';

/**
 * Demonstrate rate limiting for screenshot operations
 */
async function demonstrateScreenshotRateLimiting() {
  console.log('🚀 Starting Rate Limiting Demonstration\n');
  
  try {
    // Create service container with all services
    const container = await createServiceContainer();
    
    // Create screenshot command with rate limiting
    const screenshotCmd = new ScreenshotCommand(container);
    
    console.log('📸 Testing screenshot rate limiting...');
    console.log('   Default limit: 10 screenshots per minute with burst of 3\n');
    
    // Simulate rapid screenshot requests
    const results = [];
    
    for (let i = 1; i <= 15; i++) {
      console.log(`Attempt ${i}: Taking screenshot...`);
      
      const result = await screenshotCmd.viewport({
        format: 'png',
        preview: true,
        outputPath: `/tmp/test-screenshot-${i}.png`
      });
      
      if (result.success) {
        console.log(`✅ Success: Screenshot saved to ${result.data.path}`);
        console.log(`   Image: ${result.data.metadata.width}x${result.data.metadata.height}`);
        
        if (result.data.preview) {
          console.log(`   Preview: ${result.data.preview.size} bytes`);
        }
      } else if (result.code === ErrorCode.RATE_LIMITED) {
        console.log(`🚫 Rate Limited: ${result.error}`);
        console.log(`   Retry after: ${result.context?.metadata?.retryAfterMs || result.context?.metadata?.resetTimeMs}ms`);
        console.log(`   Remaining: ${result.context?.metadata?.remaining || 0} operations`);
        
        // Extract retry information
        const retryInfo = RateLimitUtils.extractRetryInfo(result);
        if (retryInfo?.retryAfterMs) {
          console.log(`   Suggested retry delay: ${retryInfo.retryAfterMs}ms`);
        }
      } else {
        console.log(`❌ Error: ${result.error} (Code: ${result.code})`);
        
        if (result.context?.recoveryHint) {
          console.log(`   Recovery: ${result.context.recoveryHint}`);
        }
      }
      
      results.push(result);
      console.log(''); // Empty line for readability
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Display summary statistics
    console.log('\n📊 Summary Statistics:');
    const successful = results.filter(r => r.success).length;
    const rateLimited = results.filter(r => r.code === ErrorCode.RATE_LIMITED).length;
    const otherErrors = results.filter(r => !r.success && r.code !== ErrorCode.RATE_LIMITED).length;
    
    console.log(`   Total requests: ${results.length}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Rate limited: ${rateLimited}`);
    console.log(`   Other errors: ${otherErrors}`);
    console.log(`   Success rate: ${((successful / results.length) * 100).toFixed(1)}%`);
    
    // Get rate limiting statistics
    console.log('\n📈 Rate Limiting Statistics:');
    const stats = await screenshotCmd.getRateLimitStats();
    console.log(`   Total checked: ${stats.totalChecked}`);
    console.log(`   Allowed: ${stats.allowed}`);
    console.log(`   Denied: ${stats.denied}`);
    console.log(`   Allow rate: ${(stats.allowRate * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('💥 Demo failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

/**
 * Demonstrate different rate limiting algorithms
 */
async function demonstrateRateLimitingAlgorithms() {
  console.log('\n🔧 Testing Different Rate Limiting Algorithms\n');
  
  const container = await createServiceContainer();
  const screenshotCmd = new ScreenshotCommand(container);
  
  // Test token bucket with burst
  console.log('🪣 Token Bucket Algorithm (with burst):');
  await screenshotCmd.configureRateLimit('screenshot.viewport', 2, 1000, 'token_bucket');
  
  for (let i = 1; i <= 5; i++) {
    const result = await screenshotCmd.viewport({
      format: 'png',
      outputPath: `/tmp/token-bucket-${i}.png`
    });
    
    console.log(`  Request ${i}: ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
    
    if (!result.success && result.code === ErrorCode.RATE_LIMITED) {
      const retryInfo = RateLimitUtils.extractRetryInfo(result);
      console.log(`    Retry after: ${retryInfo?.retryAfterMs || 'N/A'}ms`);
    }
  }
  
  // Reset and test sliding window
  console.log('\n📊 Sliding Window Algorithm:');
  await screenshotCmd.configureRateLimit('screenshot.viewport', 3, 2000, 'sliding_window');
  
  for (let i = 1; i <= 5; i++) {
    const result = await screenshotCmd.viewport({
      format: 'png',
      outputPath: `/tmp/sliding-window-${i}.png`
    });
    
    console.log(`  Request ${i}: ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
    
    // Wait a bit to show sliding behavior
    if (i === 3) {
      console.log('    Waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Demonstrate adaptive rate limiting under load
 */
async function demonstrateAdaptiveRateLimiting() {
  console.log('\n🎛️  Adaptive Rate Limiting Demonstration\n');
  
  const container = await createServiceContainer();
  const screenshotCmd = new ScreenshotCommand(container);
  
  // Set normal limits
  await screenshotCmd.configureRateLimit('screenshot.viewport', 5, 1000, 'sliding_window');
  
  console.log('🔄 Normal load (5 per second):');
  for (let i = 1; i <= 3; i++) {
    const result = await screenshotCmd.viewport({
      format: 'png',
      outputPath: `/tmp/normal-load-${i}.png`
    });
    console.log(`  Request ${i}: ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
  }
  
  // Simulate high load - reduce limits
  console.log('\n⚠️  High load detected - reducing limits by 50%:');
  await screenshotCmd.adjustRateLimit('screenshot.viewport', 0.5, 3000);
  
  for (let i = 1; i <= 5; i++) {
    const result = await screenshotCmd.viewport({
      format: 'png',
      outputPath: `/tmp/high-load-${i}.png`
    });
    console.log(`  Request ${i}: ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
  }
  
  console.log('\n⏳ Waiting for limits to restore...');
  await new Promise(resolve => setTimeout(resolve, 3500));
  
  console.log('🔄 Limits restored - testing normal operation:');
  const result = await screenshotCmd.viewport({
    format: 'png',
    outputPath: '/tmp/restored-limits.png'
  });
  console.log(`  Request: ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
}

/**
 * Demonstrate rate limiting with different operation weights
 */
async function demonstrateWeightedRateLimiting() {
  console.log('\n⚖️  Weighted Rate Limiting Demonstration\n');
  
  const container = await createServiceContainer();
  const screenshotCmd = new ScreenshotCommand(container);
  
  // Set limit based on "cost units"
  await screenshotCmd.configureRateLimit('screenshot.*', 10, 1000, 'sliding_window');
  
  console.log('📐 Operations with different weights:');
  console.log('   Light operations (weight 1): viewport screenshots');
  console.log('   Heavy operations (weight 3): element screenshots');
  console.log('   Budget: 10 units per second\n');
  
  // Light operations
  console.log('💡 Light operations:');
  for (let i = 1; i <= 5; i++) {
    const result = await screenshotCmd.viewport({
      format: 'png',
      outputPath: `/tmp/light-${i}.png`,
      operationWeight: 1
    });
    console.log(`  Viewport ${i} (weight 1): ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
  }
  
  // Heavy operations
  console.log('\n🏋️  Heavy operations:');
  for (let i = 1; i <= 3; i++) {
    const result = await screenshotCmd.element('body', {
      format: 'png',
      outputPath: `/tmp/heavy-${i}.png`,
      operationWeight: 3
    });
    console.log(`  Element ${i} (weight 3): ${result.success ? '✅ Allowed' : '🚫 Denied'}`);
  }
}

/**
 * Main demonstration function
 */
async function main() {
  console.log('🚦 Mac Chrome CLI - Rate Limiting System Demo');
  console.log('============================================\n');
  
  try {
    await demonstrateScreenshotRateLimiting();
    await demonstrateRateLimitingAlgorithms();
    await demonstrateAdaptiveRateLimiting();
    await demonstrateWeightedRateLimiting();
    
    console.log('\n✨ Rate limiting demonstration completed successfully!');
    console.log('\nKey Benefits Demonstrated:');
    console.log('• 🛡️  Resource protection against abuse');
    console.log('• 📊 Multiple rate limiting algorithms');
    console.log('• 🎛️  Adaptive limits based on system load');
    console.log('• ⚖️  Weighted operations for fair resource allocation');
    console.log('• 🔄 Graceful error handling with retry guidance');
    console.log('• 📈 Comprehensive monitoring and statistics');
    
  } catch (error) {
    console.error('\n💥 Demonstration failed:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  demonstrateScreenshotRateLimiting,
  demonstrateRateLimitingAlgorithms,
  demonstrateAdaptiveRateLimiting,
  demonstrateWeightedRateLimiting
};