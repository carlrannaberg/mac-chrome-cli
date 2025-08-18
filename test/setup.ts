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

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCoordinates(): R;
      toBeValidRect(): R;
      toBeErrorCode(expected: number): R;
    }
  }
  
  var testUtils: TestUtils;
}