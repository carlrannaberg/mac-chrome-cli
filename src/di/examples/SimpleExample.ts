/**
 * Simple Service Container Example
 * Basic demonstration without complex dependencies
 */

import { ServiceContainer, createServiceToken } from '../ServiceContainer.js';
import { CacheService } from '../services/CacheService.js';
import { ConfigurationService } from '../services/ConfigurationService.js';
import type { ICacheService } from '../ICacheService.js';
import type { IConfigurationService } from '../IConfigurationService.js';

const CONFIG_TOKEN = createServiceToken<IConfigurationService>('ConfigurationService');
const CACHE_TOKEN = createServiceToken<ICacheService>('CacheService');

export async function runSimpleExample(): Promise<void> {
  console.log('🚀 Starting Simple Service Container Example\n');
  
  // Create container
  const container = new ServiceContainer();
  
  // Register configuration service (no dependencies)
  container.registerSingleton(
    CONFIG_TOKEN,
    () => new ConfigurationService()
  );
  
  // Register cache service (depends on configuration)
  container.registerSingleton(
    CACHE_TOKEN,
    async (serviceContainer) => {
      const configResult = await serviceContainer.resolve(CONFIG_TOKEN);
      if (!configResult.success) {
        throw new Error('Failed to resolve configuration service');
      }
      
      const config = configResult.data;
      return new CacheService({
        maxSize: config.get('maxCacheSize') ?? 50,
        ttl: config.get('cacheTTL') ?? 300000
      });
    },
    [CONFIG_TOKEN]
  );
  
  // Resolve and use services
  console.log('📊 Initial container stats:', container.getStats());
  
  // Get configuration service
  const configResult = await container.resolve(CONFIG_TOKEN);
  if (configResult.success) {
    console.log('✅ Configuration service resolved successfully');
    const config = configResult.data;
    console.log('  Timeout setting:', config.get('timeout'));
  } else {
    console.error('❌ Failed to resolve configuration service:', configResult.error);
    return;
  }
  
  // Get cache service (this will also resolve the configuration dependency)
  const cacheResult = await container.resolve(CACHE_TOKEN);
  if (cacheResult.success) {
    console.log('✅ Cache service resolved successfully');
    const cache = cacheResult.data;
    
    // Use the cache
    cache.set('test-key', { message: 'Hello from DI system!' });
    const cachedValue = cache.get('test-key');
    console.log('  Cached value:', cachedValue);
    console.log('  Cache stats:', cache.getStats());
  } else {
    console.error('❌ Failed to resolve cache service:', cacheResult.error);
    return;
  }
  
  // Final stats
  console.log('\n📈 Final container stats:', container.getStats());
  console.log('✨ Service container example completed successfully!');
}

// Run if this file is executed directly
if (require.main === module) {
  runSimpleExample().catch(error => {
    console.error('🔴 Error running example:', error);
    process.exit(1);
  });
}
