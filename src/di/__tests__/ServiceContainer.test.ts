/**
 * Service Container Tests
 * Comprehensive tests for dependency injection system
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ServiceContainer, ServiceLifetime, createServiceToken } from '../ServiceContainer.js';
import type { ServiceToken, IServiceContainer } from '../ServiceContainer.js';

// Test service interfaces and implementations
interface ITestService {
  getName(): string;
  getValue(): number;
}

interface IDependentService {
  getTestService(): ITestService;
  getDescription(): string;
}

class TestService implements ITestService {
  constructor(private name: string = 'TestService', private value: number = 42) {}
  
  getName(): string {
    return this.name;
  }
  
  getValue(): number {
    return this.value;
  }
}

class DependentService implements IDependentService {
  constructor(private testService: ITestService) {}
  
  getTestService(): ITestService {
    return this.testService;
  }
  
  getDescription(): string {
    return `DependentService with ${this.testService.getName()}`;
  }
}

// Service tokens
const TEST_SERVICE_TOKEN = createServiceToken<ITestService>('TestService');
const DEPENDENT_SERVICE_TOKEN = createServiceToken<IDependentService>('DependentService');
const MISSING_SERVICE_TOKEN = createServiceToken<ITestService>('MissingService');

describe('ServiceContainer', () => {
  let container: IServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  describe('Service Registration', () => {
    it('should register singleton services', () => {
      container.registerSingleton(
        TEST_SERVICE_TOKEN,
        () => new TestService('SingletonTest', 100)
      );

      expect(container.isRegistered(TEST_SERVICE_TOKEN)).toBe(true);
    });

    it('should register transient services', () => {
      container.registerTransient(
        TEST_SERVICE_TOKEN,
        () => new TestService('TransientTest', 200)
      );

      expect(container.isRegistered(TEST_SERVICE_TOKEN)).toBe(true);
    });

    it('should throw error when registering duplicate services', () => {
      container.registerSingleton(
        TEST_SERVICE_TOKEN,
        () => new TestService()
      );

      expect(() => {
        container.registerSingleton(
          TEST_SERVICE_TOKEN,
          () => new TestService()
        );
      }).toThrow("Service 'TestService' is already registered");
    });
  });

  describe('Service Resolution', () => {
    it('should resolve singleton services', async () => {
      container.registerSingleton(
        TEST_SERVICE_TOKEN,
        () => new TestService('SingletonTest', 100)
      );

      const result1 = await container.resolve(TEST_SERVICE_TOKEN);
      const result2 = await container.resolve(TEST_SERVICE_TOKEN);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data).toBe(result2.data); // Same instance
      expect(result1.data?.getName()).toBe('SingletonTest');
    });

    it('should resolve transient services', async () => {
      container.registerTransient(
        TEST_SERVICE_TOKEN,
        () => new TestService('TransientTest', 200)
      );

      const result1 = await container.resolve(TEST_SERVICE_TOKEN);
      const result2 = await container.resolve(TEST_SERVICE_TOKEN);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data).not.toBe(result2.data); // Different instances
      expect(result1.data?.getName()).toBe('TransientTest');
      expect(result2.data?.getName()).toBe('TransientTest');
    });

    it('should return error for unregistered services', async () => {
      const result = await container.resolve(MISSING_SERVICE_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Service 'MissingService' is not registered");
    });

    it('should resolve services with dependencies', async () => {
      // Register dependency first
      container.registerSingleton(
        TEST_SERVICE_TOKEN,
        () => new TestService('DependencyTest', 300)
      );

      // Register dependent service
      container.registerSingleton(
        DEPENDENT_SERVICE_TOKEN,
        async (serviceContainer) => {
          const testServiceResult = await serviceContainer.resolve(TEST_SERVICE_TOKEN);
          if (!testServiceResult.success) {
            throw new Error('Failed to resolve TestService dependency');
          }
          return new DependentService(testServiceResult.data);
        },
        [TEST_SERVICE_TOKEN]
      );

      const result = await container.resolve(DEPENDENT_SERVICE_TOKEN);

      expect(result.success).toBe(true);
      expect(result.data?.getDescription()).toBe('DependentService with DependencyTest');
      expect(result.data?.getTestService().getValue()).toBe(300);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies', async () => {
      const SERVICE_A = createServiceToken<object>('ServiceA');
      const SERVICE_B = createServiceToken<object>('ServiceB');

      container.registerSingleton(
        SERVICE_A,
        async (serviceContainer) => {
          await serviceContainer.resolve(SERVICE_B);
          return { name: 'ServiceA' };
        },
        [SERVICE_B]
      );

      container.registerSingleton(
        SERVICE_B,
        async (serviceContainer) => {
          await serviceContainer.resolve(SERVICE_A);
          return { name: 'ServiceB' };
        },
        [SERVICE_A]
      );

      const result = await container.resolve(SERVICE_A);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependency detected');
    });

    it('should handle complex dependency chains', async () => {
      const SERVICE_A = createServiceToken<{ name: string }>('ServiceA');
      const SERVICE_B = createServiceToken<{ name: string }>('ServiceB');
      const SERVICE_C = createServiceToken<{ name: string }>('ServiceC');

      container.registerSingleton(
        SERVICE_A,
        () => ({ name: 'ServiceA' })
      );

      container.registerSingleton(
        SERVICE_B,
        async (serviceContainer) => {
          const aResult = await serviceContainer.resolve(SERVICE_A);
          if (!aResult.success) throw new Error('Failed to resolve A');
          return { name: 'ServiceB' };
        },
        [SERVICE_A]
      );

      container.registerSingleton(
        SERVICE_C,
        async (serviceContainer) => {
          const [aResult, bResult] = await Promise.all([
            serviceContainer.resolve(SERVICE_A),
            serviceContainer.resolve(SERVICE_B)
          ]);
          if (!aResult.success || !bResult.success) {
            throw new Error('Failed to resolve dependencies');
          }
          return { name: 'ServiceC' };
        },
        [SERVICE_A, SERVICE_B]
      );

      const result = await container.resolve(SERVICE_C);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('ServiceC');
    });
  });

  describe('Container Management', () => {
    it('should provide accurate statistics', () => {
      container.registerSingleton(TEST_SERVICE_TOKEN, () => new TestService());
      container.registerTransient(DEPENDENT_SERVICE_TOKEN, () => new DependentService(new TestService()));

      const stats = container.getStats();

      expect(stats.registeredServices).toBe(2);
      expect(stats.singletonInstances).toBe(0); // Not resolved yet
      expect(stats.resolutionCount).toBe(0);
    });

    it('should update statistics after resolution', async () => {
      container.registerSingleton(TEST_SERVICE_TOKEN, () => new TestService());

      await container.resolve(TEST_SERVICE_TOKEN);
      
      const stats = container.getStats();

      expect(stats.singletonInstances).toBe(1);
      expect(stats.resolutionCount).toBe(1);
    });

    it('should clear all services and reset statistics', async () => {
      container.registerSingleton(TEST_SERVICE_TOKEN, () => new TestService());
      await container.resolve(TEST_SERVICE_TOKEN);

      container.clear();
      
      const stats = container.getStats();

      expect(stats.registeredServices).toBe(0);
      expect(stats.singletonInstances).toBe(0);
      expect(stats.resolutionCount).toBe(0);
      expect(container.isRegistered(TEST_SERVICE_TOKEN)).toBe(false);
    });
  });

  describe('Async Factory Support', () => {
    it('should support async factory functions', async () => {
      container.registerSingleton(
        TEST_SERVICE_TOKEN,
        async () => {
          // Simulate async initialization
          await new Promise(resolve => setTimeout(resolve, 1));
          return new TestService('AsyncTest', 500);
        }
      );

      const result = await container.resolve(TEST_SERVICE_TOKEN);

      expect(result.success).toBe(true);
      expect(result.data?.getName()).toBe('AsyncTest');
      expect(result.data?.getValue()).toBe(500);
    });

    it('should handle async factory errors', async () => {
      container.registerSingleton(
        TEST_SERVICE_TOKEN,
        async () => {
          throw new Error('Async factory error');
        }
      );

      const result = await container.resolve(TEST_SERVICE_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Async factory error');
    });
  });
});
