/**
 * Service Container Example
 * Demonstrates how to use the dependency injection system
 */

import { createServiceContainer } from '../ServiceRegistry.js';
import { SERVICE_TOKENS } from '../ServiceTokens.js';

/**
 * Example of how to use the service container
 */
export async function serviceContainerExample(): Promise<void> {
  // Create and configure the service container
  const container = await createServiceContainer();

  console.log('🏗️  Service Container Initialized');
  console.log('📊 Container Stats:', container.getStats());

  // Resolve configuration service
  const configResult = await container.resolve(SERVICE_TOKENS.ConfigurationService);
  if (configResult.success) {
    const config = configResult.data;
    console.log('⚙️  Configuration Service resolved');
    console.log('   Timeout:', config.get('timeout'));
    console.log('   Cache Enabled:', config.get('cacheEnabled'));
  }

  // Resolve cache service (depends on configuration)
  const cacheResult = await container.resolve(SERVICE_TOKENS.CacheService);
  if (cacheResult.success) {
    const cache = cacheResult.data;
    console.log('💾 Cache Service resolved');
    
    // Use the cache
    cache.set('example-key', { message: 'Hello from DI!' });
    const cached = cache.get('example-key');
    console.log('   Cached data:', cached);
    console.log('   Cache stats:', cache.getStats());
  }

  // Resolve path validator
  const pathValidatorResult = await container.resolve(SERVICE_TOKENS.PathValidator);
  if (pathValidatorResult.success) {
    const pathValidator = pathValidatorResult.data;
    console.log('🔒 Path Validator resolved');
    
    // Test path validation
    const testPath = process.cwd() + '/package.json';
    const validation = pathValidator.validateFilePath(testPath);
    console.log(`   Path validation for ${testPath}:`, validation.success);
  }

  // Resolve AppleScript service
  const appleScriptResult = await container.resolve(SERVICE_TOKENS.AppleScriptService);
  if (appleScriptResult.success) {
    const appleScript = appleScriptResult.data;
    console.log('🍎 AppleScript Service resolved');
    console.log('   Performance stats:', appleScript.getPerformanceStats());
  }

  // Final container stats
  console.log('\n📈 Final Container Stats:', container.getStats());
}

// Run the example if this file is executed directly
if (require.main === module) {
  serviceContainerExample().catch(console.error);
}
