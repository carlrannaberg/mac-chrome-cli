/**
 * LRU Cache Memory Leak Prevention Demo
 * 
 * This script demonstrates how the new LRU cache prevents memory leaks
 * that were present in the original unbounded cache implementation.
 */

import { ServiceContainer, createServiceToken, type CacheConfig, type ServiceToken } from './ServiceContainer.js';

interface DemoService {
  id: string;
  data: string[];
}

// Create a demo service that allocates some memory
const createDemoService = (id: string): DemoService => ({
  id,
  data: new Array(1000).fill(`data-${id}`) // Simulate memory usage
});

async function demonstrateMemoryLeakPrevention() {
  console.log('🧪 LRU Cache Memory Leak Prevention Demo\n');

  // 1. Demonstrate unbounded growth prevention
  console.log('1. Testing cache size limits...');
  const limitedContainer = new ServiceContainer({ 
    maxSize: 5, // Small cache size for demo
    ttlMs: 0,   // Disable TTL for this test
    enabled: true 
  });

  // Register many services
  const services: Array<{ token: ServiceToken<DemoService>, name: string }> = [];
  for (let i = 0; i < 10; i++) {
    const token = createServiceToken<DemoService>(`DemoService${i}`);
    const serviceName = `DemoService${i}`;
    services.push({ token, name: serviceName });
    
    limitedContainer.registerSingleton(
      token,
      () => createDemoService(serviceName)
    );
  }

  // Resolve all services
  for (const { token, name } of services) {
    await limitedContainer.resolve(token);
    const stats = limitedContainer.getCacheStats();
    console.log(`  Resolved ${name}: cache size=${stats.size}, evictions=${stats.evictions}`);
  }

  const finalStats = limitedContainer.getCacheStats();
  console.log(`✅ Final cache size: ${finalStats.size} (limited to 5), evictions: ${finalStats.evictions}\n`);

  // 2. Demonstrate TTL-based expiration
  console.log('2. Testing TTL-based cache expiration...');
  const ttlContainer = new ServiceContainer({
    maxSize: 100,
    ttlMs: 50,    // 50ms TTL
    enabled: true
  });

  const ttlToken = createServiceToken<DemoService>('TTLService');
  ttlContainer.registerSingleton(ttlToken, () => createDemoService('TTL'));

  // Initial resolution
  await ttlContainer.resolve(ttlToken);
  console.log(`  After resolution: cache size=${ttlContainer.getCacheStats().size}`);

  // Wait for TTL expiration
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Access service after TTL - should trigger eviction
  await ttlContainer.resolve(ttlToken);
  const ttlStats = ttlContainer.getCacheStats();
  console.log(`✅ After TTL expiration: ttl evictions=${ttlStats.ttlEvictions}\n`);

  // 3. Demonstrate cache hit efficiency
  console.log('3. Testing cache hit/miss efficiency...');
  const efficiencyContainer = new ServiceContainer();
  const effToken = createServiceToken<DemoService>('EfficiencyService');
  
  efficiencyContainer.registerSingleton(effToken, () => {
    console.log('  🏗️  Factory called (expensive operation)');
    return createDemoService('Efficiency');
  });

  // First resolution (cache miss)
  console.log('  First resolution (should call factory):');
  await efficiencyContainer.resolve(effToken);
  
  // Second resolution (cache hit)
  console.log('  Second resolution (should use cache):');
  await efficiencyContainer.resolve(effToken);
  
  const effStats = efficiencyContainer.getCacheStats();
  console.log(`✅ Cache efficiency: ${effStats.hits} hits, ${effStats.misses} misses\n`);

  // 4. Demonstrate memory usage comparison
  console.log('4. Memory usage simulation...');
  
  // Simulate old unbounded cache behavior
  console.log('  Simulating old unbounded cache:');
  const unboundedCache = new Map<string, any>();
  for (let i = 0; i < 1000; i++) {
    unboundedCache.set(`service-${i}`, createDemoService(`unbounded-${i}`));
  }
  console.log(`  Unbounded cache size: ${unboundedCache.size} entries (grows indefinitely)`);
  
  // Compare with new LRU cache
  console.log('  Using new LRU cache:');
  const lruContainer = new ServiceContainer({ maxSize: 100 });
  const lruServices = [];
  
  for (let i = 0; i < 1000; i++) {
    const token = createServiceToken<DemoService>(`LRUService${i}`);
    lruServices.push(token);
    lruContainer.registerSingleton(token, () => createDemoService(`lru-${i}`));
  }
  
  // Resolve all services
  for (const token of lruServices) {
    await lruContainer.resolve(token);
  }
  
  const lruFinalStats = lruContainer.getCacheStats();
  console.log(`✅ LRU cache size: ${lruFinalStats.size} entries (bounded), evictions: ${lruFinalStats.evictions}\n`);

  // Cleanup
  limitedContainer.dispose();
  ttlContainer.dispose();
  efficiencyContainer.dispose();
  lruContainer.dispose();
  
  console.log('🎉 Demo completed successfully!');
  console.log('\n📋 Summary of improvements:');
  console.log('  ✅ Cache size is bounded (prevents unbounded memory growth)');
  console.log('  ✅ TTL expiration removes stale entries automatically');
  console.log('  ✅ LRU eviction maintains most recently used entries');
  console.log('  ✅ Comprehensive statistics for monitoring and debugging');
  console.log('  ✅ Configurable cache settings for different use cases');
  console.log('  ✅ Proper resource cleanup with dispose() method');
}

// Run the demo if this file is executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('cache-demo.ts')) {
  demonstrateMemoryLeakPrevention().catch(console.error);
}

export { demonstrateMemoryLeakPrevention };