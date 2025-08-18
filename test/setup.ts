/**
 * Global test setup for mac-chrome-cli
 */

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Mock process.exit to prevent tests from actually exiting
const originalProcessExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn() as never;
});

afterAll(() => {
  process.exit = originalProcessExit;
});

// Set test environment variables
process.env.NODE_ENV = 'test';

// Increase test timeout for system-level tests
jest.setTimeout(10000);

// Custom matchers for better test assertions
expect.extend({
  toBeValidCoordinates(received: { x: number; y: number }) {
    const pass = typeof received === 'object' && 
                 typeof received.x === 'number' && 
                 typeof received.y === 'number' &&
                 !isNaN(received.x) && !isNaN(received.y) &&
                 received.x >= 0 && received.y >= 0;
    
    return {
      message: () => `expected ${JSON.stringify(received)} to be valid coordinates`,
      pass
    };
  },
  
  toBeValidRect(received: { x: number; y: number; width?: number; height?: number; w?: number; h?: number }) {
    const width = received.width ?? received.w ?? 0;
    const height = received.height ?? received.h ?? 0;
    const pass = typeof received === 'object' && 
                 typeof received.x === 'number' && 
                 typeof received.y === 'number' &&
                 typeof width === 'number' &&
                 typeof height === 'number' &&
                 !isNaN(received.x) && !isNaN(received.y) &&
                 !isNaN(width) && !isNaN(height) &&
                 width >= 0 && height >= 0;
    
    return {
      message: () => `expected ${JSON.stringify(received)} to be valid rectangle`,
      pass
    };
  },
  
  toBeErrorCode(received: number, expected: number) {
    const pass = received === expected;
    
    return {
      message: () => `expected error code ${received} to be ${expected}`,
      pass
    };
  }
});

// Define proper types for test utilities
interface TestUtils {
  createMockElement: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
  createMockViewport: (width?: number, height?: number, scrollX?: number, scrollY?: number) => {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  createMockWindowBounds: (x?: number, y?: number, width?: number, height?: number) => {
    x: number;
    y: number;
    width: number;
    height: number;
    titleBarHeight: number;
    contentAreaX: number;
    contentAreaY: number;
  };
}

// Global test utilities
(global as { testUtils: TestUtils }).testUtils = {
  createMockElement: (rect: { x: number; y: number; width: number; height: number }) => ({
    ...rect,
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2
  }),
  
  createMockViewport: (width = 1920, height = 1080, scrollX = 0, scrollY = 0) => ({
    width,
    height,
    scrollX,
    scrollY
  }),
  
  createMockWindowBounds: (x = 100, y = 100, width = 1920, height = 1080) => ({
    x,
    y,
    width,
    height,
    titleBarHeight: 24,
    contentAreaX: x,
    contentAreaY: y + 24
  })
};

// Type definitions for service methods
interface AppleScriptResult {
  success: boolean;
  data?: string | object;
  error?: string;
  code: number;
}

interface FileSystemResult {
  success: boolean;
  path?: string;
  error?: string;
}

interface NetworkResult {
  success: boolean;
  data?: object;
  error?: string;
}

interface PerformanceStats {
  cacheHits: number;
  cacheMisses: number;
  activeConnections: number;
  executionCount: number;
}

// Enhanced test utilities for comprehensive testing
interface MockServiceUtils {
  createMockAppleScriptService: () => {
    executeScript: jest.MockedFunction<(script: string) => Promise<AppleScriptResult>>;
    executeJavaScript: jest.MockedFunction<(script: string, windowId?: number, tabId?: number) => Promise<AppleScriptResult>>;
    isChromeRunning: jest.MockedFunction<() => Promise<boolean>>;
    focusChromeWindow: jest.MockedFunction<(windowId: number) => Promise<AppleScriptResult>>;
    getPerformanceStats: jest.MockedFunction<() => PerformanceStats>;
    clearCaches: jest.MockedFunction<() => void>;
  };
  createMockFileSystemService: () => {
    validatePath: jest.MockedFunction<(path: string) => FileSystemResult>;
    ensureDirectory: jest.MockedFunction<(path: string) => Promise<FileSystemResult>>;
    writeFile: jest.MockedFunction<(path: string, data: string | Buffer) => Promise<FileSystemResult>>;
    readFile: jest.MockedFunction<(path: string) => Promise<FileSystemResult>>;
  };
  createMockNetworkService: () => {
    sanitizeData: jest.MockedFunction<(data: object) => NetworkResult>;
    validateUrl: jest.MockedFunction<(url: string) => boolean>;
  };
}

// Error types with proper code properties
interface ErrorWithCode extends Error {
  code: string | number;
}

interface FailureScenarioUtils {
  createPermissionDeniedError: (resource: string) => ErrorWithCode;
  createTimeoutError: (operation: string) => ErrorWithCode;
  createNetworkError: (url: string) => ErrorWithCode;
  createMalformedResponseError: (data: string) => ErrorWithCode;
  createSystemError: (code: number, message: string) => ErrorWithCode;
}

interface PerformanceTestUtils {
  measureExecutionTime: <T>(fn: () => Promise<T>) => Promise<{ result: T; duration: number }>;
  createPerformanceBaseline: (operation: string) => { start: () => void; end: () => number };
  verifyPerformanceTarget: (duration: number, target: number, tolerance?: number) => boolean;
}

// Extended test utilities
(global as { testUtils: TestUtils & { mockServices: MockServiceUtils; failureScenarios: FailureScenarioUtils; performance: PerformanceTestUtils } }).testUtils = {
  ...global.testUtils,
  
  mockServices: {
    createMockAppleScriptService: () => ({
      executeScript: jest.fn(),
      executeJavaScript: jest.fn(), 
      isChromeRunning: jest.fn(),
      focusChromeWindow: jest.fn(),
      getPerformanceStats: jest.fn(() => ({
        cacheHits: 0,
        cacheMisses: 0,
        activeConnections: 0,
        executionCount: 0
      })),
      clearCaches: jest.fn()
    }),
    
    createMockFileSystemService: () => ({
      validatePath: jest.fn(),
      ensureDirectory: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn()
    }),
    
    createMockNetworkService: () => ({
      sanitizeData: jest.fn(),
      validateUrl: jest.fn()
    })
  },
  
  failureScenarios: {
    createPermissionDeniedError: (resource: string): ErrorWithCode => {
      const error = new Error(`Permission denied: ${resource}`) as ErrorWithCode;
      error.code = 'EPERM';
      return error;
    },
    
    createTimeoutError: (operation: string): ErrorWithCode => {
      const error = new Error(`Operation timeout: ${operation}`) as ErrorWithCode;
      error.code = 'ETIMEDOUT';
      return error;
    },
    
    createNetworkError: (url: string): ErrorWithCode => {
      const error = new Error(`Network error: Failed to connect to ${url}`) as ErrorWithCode;
      error.code = 'ECONNREFUSED';
      return error;
    },
    
    createMalformedResponseError: (data: string): ErrorWithCode => {
      const error = new Error(`Malformed response: ${data.substring(0, 50)}...`) as ErrorWithCode;
      error.code = 'EMALFORMED';
      return error;
    },
    
    createSystemError: (code: number, message: string): ErrorWithCode => {
      const error = new Error(message) as ErrorWithCode;
      error.code = code;
      return error;
    }
  },
  
  performance: {
    measureExecutionTime: async <T>(fn: () => Promise<T>) => {
      const start = process.hrtime.bigint();
      const result = await fn();
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      return { result, duration };
    },
    
    createPerformanceBaseline: (operation: string) => {
      let startTime: bigint;
      return {
        start: () => { startTime = process.hrtime.bigint(); },
        end: () => Number(process.hrtime.bigint() - startTime) / 1000000
      };
    },
    
    verifyPerformanceTarget: (duration: number, target: number, tolerance = 0.1) => {
      const maxAllowed = target * (1 + tolerance);
      return duration <= maxAllowed;
    }
  }
};

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCoordinates(): R;
      toBeValidRect(): R;
      toBeErrorCode(expected: number): R;
      toMeetPerformanceTarget(target: number, tolerance?: number): R;
      toBePermissionError(): R;
      toBeTimeoutError(): R;
    }
  }
  
  var testUtils: TestUtils & { 
    mockServices: MockServiceUtils; 
    failureScenarios: FailureScenarioUtils;
    performance: PerformanceTestUtils;
  };
}

// Add performance and error matchers
expect.extend({
  toMeetPerformanceTarget(received: number, target: number, tolerance = 0.1) {
    const maxAllowed = target * (1 + tolerance);
    const pass = received <= maxAllowed;
    
    return {
      message: () => `expected ${received}ms to ${pass ? 'not ' : ''}meet performance target of ${target}ms (±${tolerance * 100}%, max: ${maxAllowed}ms)`,
      pass
    };
  },
  
  toBePermissionError(received: unknown) {
    const isString = typeof received === 'string';
    const hasPermissionContent = isString && (
      received.includes('Permission denied') || 
      received.includes('not authorized') ||
      received.includes('permission denied')
    );
    
    return {
      message: () => `expected "${received}" to be a permission error`,
      pass: hasPermissionContent
    };
  },
  
  toBeTimeoutError(received: unknown) {
    const isString = typeof received === 'string';
    const hasTimeoutContent = isString && (
      received.includes('timeout') || 
      received.includes('timed out') ||
      received.includes('Operation timeout')
    );
    
    return {
      message: () => `expected "${received}" to be a timeout error`,
      pass: hasTimeoutContent
    };
  }
});