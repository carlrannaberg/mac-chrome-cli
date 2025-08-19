# Rate Limiting System

The mac-chrome-cli includes a comprehensive rate limiting system to protect against resource exhaustion and ensure system stability. The system provides multiple algorithms, per-operation limits, and detailed monitoring.

## Overview

Rate limiting prevents system overload by controlling the frequency of expensive operations such as:

- Screenshot capture (viewport, element, window, fullscreen)
- DOM snapshot operations (outline, dom-lite)
- AppleScript execution with long timeouts
- File upload operations
- Network log capture

## Features

- **Multiple Algorithms**: Sliding window, token bucket, fixed window, leaky bucket
- **Per-Operation Limits**: Different limits for different operation types
- **Pattern Matching**: Wildcard patterns for operation groups
- **Burst Handling**: Token bucket algorithm supports burst operations
- **Adaptive Limits**: Runtime adjustment based on system load
- **Weighted Operations**: Different operations have different "costs"
- **Comprehensive Monitoring**: Detailed statistics and metrics
- **Graceful Degradation**: Clear error messages with retry guidance

## Default Limits

The system comes pre-configured with sensible defaults:

| Operation Pattern | Max Operations | Window (ms) | Algorithm | Notes |
|------------------|----------------|-------------|-----------|-------|
| `screenshot.*` | 10 | 60000 | token_bucket | Burst of 3 allowed |
| `snapshot.*` | 20 | 60000 | sliding_window | DOM operations |
| `applescript.*` | 30 | 60000 | leaky_bucket | High latency operations |
| `files.*` | 5 | 60000 | fixed_window | File operations |
| `*` (global) | 100 | 60000 | sliding_window | Fallback limit |

## Usage Examples

### Basic Rate Limiting

Rate limiting is automatic and transparent:

```typescript
import { ScreenshotCommand } from './commands/screenshot.js';
import { createServiceContainer } from './di/ServiceRegistry.js';

const container = await createServiceContainer();
const screenshot = new ScreenshotCommand(container);

// Automatically rate limited
const result = await screenshot.viewport({ format: 'png' });

if (result.success) {
  console.log('Screenshot captured:', result.data.path);
} else if (result.code === ErrorCode.RATE_LIMITED) {
  console.log('Rate limited:', result.error);
  const retryAfter = result.context?.metadata?.retryAfterMs;
  console.log(`Try again in ${retryAfter}ms`);
}
```

### Error Handling

Rate limit errors provide detailed context:

```typescript
const result = await screenshot.viewport();

if (!result.success && result.code === ErrorCode.RATE_LIMITED) {
  const { retryAfterMs, resetTimeMs, remaining } = result.context?.metadata || {};
  
  console.log(`Rate limit exceeded`);
  console.log(`Remaining operations: ${remaining}`);
  console.log(`Retry after: ${retryAfterMs}ms`);
  console.log(`Window resets in: ${resetTimeMs}ms`);
  
  // Wait and retry
  setTimeout(() => {
    screenshot.viewport(); // Retry the operation
  }, retryAfterMs);
}
```

### Custom Rate Limits

Configure operation-specific limits:

```typescript
// Strict limits for heavy operations
await screenshot.configureRateLimit('screenshot.element', 5, 60000, 'sliding_window');

// Burst-friendly limits for quick operations
await screenshot.configureRateLimit('screenshot.viewport', 15, 60000, 'token_bucket');

// Pattern-based limits
await screenshot.configureRateLimit('screenshot.*', 20, 60000, 'sliding_window');
```

### Weighted Operations

Different operations can have different costs:

```typescript
// Light operation (weight: 1)
await screenshot.viewport({
  operationWeight: 1,
  format: 'png'
});

// Heavy operation (weight: 3)
await screenshot.element('body', {
  operationWeight: 3,
  format: 'png'
});
```

### Monitoring and Statistics

Track rate limiting effectiveness:

```typescript
const stats = await screenshot.getRateLimitStats();

console.log(`Total requests: ${stats.totalChecked}`);
console.log(`Success rate: ${(stats.allowRate * 100).toFixed(1)}%`);
console.log(`Operations/sec: ${stats.operationsPerSecond.toFixed(2)}`);
```

### Adaptive Rate Limiting

Adjust limits based on system conditions:

```typescript
// Reduce limits during high load
await screenshot.adjustRateLimit('screenshot.*', 0.5, 300000); // 50% for 5 minutes

// Increase limits during low load
await screenshot.adjustRateLimit('screenshot.*', 2.0, 120000); // 200% for 2 minutes
```

## Rate Limiting Algorithms

### Sliding Window

Maintains a rolling window of operations. Most accurate but uses more memory.

```typescript
{
  maxOperations: 10,
  windowMs: 60000,
  algorithm: 'sliding_window'
}
```

**Best for**: Operations where precise rate control is important.

### Token Bucket

Allows burst operations up to bucket size, then refills at steady rate.

```typescript
{
  maxOperations: 10,     // Refill rate
  windowMs: 60000,       // Refill period
  algorithm: 'token_bucket',
  burstSize: 20          // Burst capacity
}
```

**Best for**: Operations that benefit from burst capability.

### Fixed Window

Resets counter at fixed intervals. Simple but can have boundary effects.

```typescript
{
  maxOperations: 10,
  windowMs: 60000,
  algorithm: 'fixed_window'
}
```

**Best for**: Simple use cases where boundary effects are acceptable.

### Leaky Bucket

Smooths out traffic by "leaking" operations at a steady rate.

```typescript
{
  maxOperations: 10,
  windowMs: 60000,
  algorithm: 'leaky_bucket'
}
```

**Best for**: Operations that need steady, smooth rate limiting.

## Configuration

### Environment Variables

Configure rate limiting via environment variables:

```bash
# Global rate limit multiplier (0.5 = half speed, 2.0 = double speed)
export RATE_LIMIT_MULTIPLIER=1.0

# Disable rate limiting for development (use with caution)
export DISABLE_RATE_LIMITING=false

# Memory limit for rate limiting data (KB)
export RATE_LIMIT_MEMORY_LIMIT=1024
```

### Runtime Configuration

```typescript
// Get rate limiter service directly
const container = await createServiceContainer();
const rateLimiter = await container.resolve(SERVICE_TOKENS.RateLimiterService);

// Configure custom limits
await rateLimiter.configureLimit('custom.operation', {
  maxOperations: 50,
  windowMs: 30000,
  algorithm: 'sliding_window',
  ruleId: 'custom_rule_v1'
});

// Monitor statistics
const stats = await rateLimiter.getStats();
console.log('Rate limiting statistics:', stats);
```

## Integration with CLI

Rate limiting is automatically integrated into CLI commands:

```bash
# Screenshot operations are automatically rate limited
mac-chrome-cli shot viewport --out screenshot.png

# Error output includes rate limit information
# Rate limit exceeded for screenshot.viewport. Try again in 1500ms
# Hint: Reduce operation frequency or wait for limit reset
```

### CLI Options

Some commands support rate limiting options:

```bash
# Skip rate limiting (use with caution)
mac-chrome-cli shot viewport --skip-rate-limit --out emergency.png

# Custom operation weight
mac-chrome-cli shot element "#heavy-element" --operation-weight 5
```

## Best Practices

### 1. Respect Rate Limits

Always handle rate limit errors gracefully:

```typescript
async function captureScreenshotWithRetry(options: ScreenshotOptions, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await screenshot.viewport(options);
    
    if (result.success) {
      return result;
    }
    
    if (result.code === ErrorCode.RATE_LIMITED) {
      const retryInfo = RateLimitUtils.extractRetryInfo(result);
      if (retryInfo?.retryAfterMs && attempt < maxRetries) {
        console.log(`Rate limited, waiting ${retryInfo.retryAfterMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryInfo.retryAfterMs));
        continue;
      }
    }
    
    // Non-rate-limit error or max retries reached
    return result;
  }
  
  throw new Error('Max retries exceeded');
}
```

### 2. Use Appropriate Weights

Set operation weights based on actual resource usage:

```typescript
// Light operations
const quickScreenshot = await screenshot.viewport({
  operationWeight: 1,
  preview: false,
  format: 'jpg',
  quality: 50
});

// Heavy operations
const detailedSnapshot = await snapshot.outline({
  operationWeight: 3,
  visibleOnly: false,
  includeMetadata: true
});
```

### 3. Monitor Performance

Regularly check rate limiting statistics:

```typescript
// Log statistics periodically
setInterval(async () => {
  const stats = await screenshot.getRateLimitStats();
  
  if (stats.allowRate < 0.8) { // Less than 80% success rate
    console.warn('High rate limiting detected:', stats);
    
    // Consider adjusting application behavior
    await screenshot.adjustRateLimit('screenshot.*', 1.5, 60000);
  }
}, 60000); // Check every minute
```

### 4. Design for Limits

Build applications that work within rate limits:

```typescript
// Batch operations when possible
const screenshots = [];
for (const element of elements) {
  try {
    const result = await screenshot.element(element.selector);
    if (result.success) {
      screenshots.push(result.data);
    }
  } catch (error) {
    if (error.code === ErrorCode.RATE_LIMITED) {
      // Skip this element or queue for later
      console.log(`Skipping ${element.selector} due to rate limit`);
      continue;
    }
    throw error;
  }
}
```

## Troubleshooting

### High Rate Limit Rejections

If you're seeing many rate limit errors:

1. **Check operation frequency**: Reduce the rate of operations
2. **Increase limits**: Adjust limits for your specific use case
3. **Use weights**: Set appropriate weights for operations
4. **Batch operations**: Combine multiple operations when possible

```typescript
// Check current statistics
const stats = await rateLimiter.getStats();
console.log('Current allow rate:', stats.allowRate);

// Temporarily increase limits
await rateLimiter.adjustLimit('screenshot.*', 2.0, 300000);
```

### Memory Usage Issues

Rate limiting data is kept in memory. If memory usage is high:

1. **Increase cleanup frequency**: More frequent cleanup of expired data
2. **Reduce window sizes**: Shorter time windows use less memory
3. **Limit operation history**: Reduce the number of tracked operations

```typescript
// Manual cleanup
const cleanedEntries = await rateLimiter.cleanup();
console.log(`Cleaned up ${cleanedEntries} expired entries`);

// Check memory usage
const stats = await rateLimiter.getStats();
console.log(`Memory usage: ${stats.memoryUsageKB} KB`);
```

### Configuration Issues

If rate limiting isn't working as expected:

1. **Verify service registration**: Ensure RateLimiterService is registered
2. **Check pattern matching**: Verify operation patterns match correctly
3. **Review algorithm choice**: Different algorithms have different behaviors

```typescript
// List all configured limits
const limits = await rateLimiter.getAllLimits();
for (const [pattern, rule] of limits) {
  console.log(`${pattern}: ${rule.maxOperations}/${rule.windowMs}ms (${rule.algorithm})`);
}

// Test pattern matching
const rule = await rateLimiter.getLimit('screenshot.viewport');
console.log('Matched rule:', rule);
```

## Security Considerations

- **DoS Protection**: Rate limiting helps prevent denial-of-service attacks
- **Resource Conservation**: Prevents system resource exhaustion
- **Fair Usage**: Ensures fair resource allocation across operations
- **Monitoring**: Tracks usage patterns for security analysis

## Performance Impact

The rate limiting system is designed for minimal performance impact:

- **Memory Efficient**: Automatic cleanup of expired data
- **Fast Lookups**: O(1) operation for rate limit checks
- **Asynchronous**: Non-blocking rate limit operations
- **Configurable**: Adjustable cleanup intervals and memory limits

## Future Enhancements

Planned improvements to the rate limiting system:

- **Distributed Rate Limiting**: Support for multi-instance deployments
- **Machine Learning**: AI-powered adaptive rate limiting
- **External Storage**: Redis/database backends for persistence
- **Advanced Algorithms**: More sophisticated rate limiting algorithms
- **Real-time Monitoring**: WebSocket-based real-time monitoring dashboard