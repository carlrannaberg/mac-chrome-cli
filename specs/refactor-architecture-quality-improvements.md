# Refactoring Specification: Architecture and Quality Improvements

**Status**: Draft  
**Authors**: Claude (AI Assistant), 2025-08-18  
**Version**: 1.0.0

## Overview

This specification outlines a comprehensive refactoring plan for the mac-chrome-cli project to address critical architectural issues, security vulnerabilities, and code quality concerns identified in the code review. The refactoring will improve maintainability, security, and testability while preserving all existing functionality and performance optimizations.

## Background/Problem Statement

The mac-chrome-cli project has successfully implemented 23 of 44 planned commands with sophisticated performance optimizations and comprehensive documentation. However, a thorough code review has identified several critical issues that impact maintainability, security, and long-term scalability:

### Critical Issues Identified

1. **Monolithic Architecture**: The main CLI entry point (`src/index.ts`) contains 887 lines mixing command registration, output formatting, error handling, and business logic, violating the Single Responsibility Principle.

2. **Security Vulnerabilities**: 
   - Network monitoring captures sensitive data (passwords, tokens) without sanitization
   - File upload paths vulnerable to directory traversal attacks
   - JavaScript execution lacks comprehensive validation

3. **Inconsistent Error Handling**: 15+ different result interface patterns (`ExecResult`, `JSONResult`, `KeyboardResult`, etc.) create API inconsistency and maintenance burden.

4. **Code Duplication**: Three separate AppleScript execution implementations with different error handling strategies.

5. **Testing Gaps**: Integration tests focus on happy paths, missing critical failure scenarios and real-world error conditions.

6. **Documentation Gaps**: 30-60% JSDoc coverage limits IDE support and developer experience.

## Goals

- **Decompose monolithic architecture** into maintainable, testable modules
- **Eliminate security vulnerabilities** in network monitoring and file handling
- **Unify error handling patterns** across all commands
- **Remove code duplication** through service consolidation
- **Enhance test coverage** with comprehensive failure scenarios
- **Improve documentation** to 90%+ JSDoc coverage
- **Preserve performance optimizations** (LRU caching, WebP optimization)
- **Maintain backward compatibility** for all public APIs

## Non-Goals

- **Complete remaining 21 unimplemented commands** (separate feature work)
- **Change CLI interface or command structure** (preserve user experience)
- **Modify JSON output formats** (maintain API compatibility)
- **Rewrite working functionality** (refactor only where necessary)
- **Change build system or module format** (keep ESM/TypeScript setup)
- **Add new dependencies** unless absolutely necessary

## Technical Dependencies

### Existing Dependencies (Preserve)
```json
{
  "commander": "^12.1.0",  // CLI framework
  "lru-cache": "^10.4.3",   // Performance caching
  "sharp": "^0.33.5"        // Image processing
}
```

### Potential New Dependencies
```json
{
  "inversify": "^6.0.0",    // Dependency injection (optional)
  "zod": "^3.22.0"          // Runtime validation (optional)
}
```

## Detailed Design

### Architecture Refactoring

#### 1. Command Architecture Pattern

Transform the monolithic `src/index.ts` into a modular command architecture:

```typescript
// src/cli/Application.ts
export class MacChromeCLI {
  private readonly container: ServiceContainer;
  private readonly registry: CommandRegistry;
  private readonly formatter: OutputFormatter;
  
  constructor() {
    this.container = new ServiceContainer();
    this.registry = new CommandRegistry(this.container);
    this.formatter = new OutputFormatter();
    this.registerServices();
    this.registerCommands();
  }
  
  async run(argv: string[]): Promise<void> {
    try {
      const result = await this.registry.execute(argv);
      this.formatter.output(result);
    } catch (error) {
      this.handleError(error);
    }
  }
}

// src/cli/commands/BaseCommand.ts
export abstract class BaseCommand<TOptions, TResult> {
  abstract readonly name: string;
  abstract readonly description: string;
  
  constructor(protected readonly services: ServiceContainer) {}
  
  abstract validate(options: unknown): ValidationResult<TOptions>;
  abstract execute(options: TOptions): Promise<Result<TResult>>;
}

// src/index.ts (reduced to ~50 lines)
import { MacChromeCLI } from './cli/Application.js';

const app = new MacChromeCLI();
app.run(process.argv).catch(console.error);
```

#### 2. Service Layer Architecture

Consolidate duplicate implementations into unified services:

```typescript
// src/services/AppleScriptService.ts
export interface IAppleScriptService {
  execute(script: string, options?: ExecutionOptions): Promise<Result<string>>;
  executeJavaScript<T>(js: string, context: BrowserContext): Promise<Result<T>>;
  validatePermissions(): Promise<PermissionStatus>;
}

export class AppleScriptService implements IAppleScriptService {
  constructor(
    private readonly cache: ICacheService,
    private readonly executor: ICommandExecutor,
    private readonly sanitizer: IDataSanitizer
  ) {}
  
  async execute(script: string, options?: ExecutionOptions): Promise<Result<string>> {
    // Unified implementation with caching, error handling, permission checking
    const cacheKey = this.generateCacheKey(script, options);
    const cached = await this.cache.get(cacheKey);
    if (cached) return Ok(cached);
    
    const result = await this.executor.run('osascript', ['-e', script], options);
    if (result.success) {
      await this.cache.set(cacheKey, result.data);
    }
    return this.normalizeResult(result);
  }
}
```

#### 3. Unified Result Pattern

Replace 15+ result interfaces with a consistent pattern:

```typescript
// src/core/Result.ts
export type Result<T, E = Error> = 
  | { readonly kind: 'ok'; readonly value: T; readonly meta?: Metadata }
  | { readonly kind: 'error'; readonly error: E; readonly code: ErrorCode };

export const Result = {
  ok<T>(value: T, meta?: Metadata): Result<T, never> {
    return { kind: 'ok', value, meta };
  },
  
  error<E>(error: E, code: ErrorCode): Result<never, E> {
    return { kind: 'error', error, code };
  },
  
  map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
    return result.kind === 'ok' 
      ? Result.ok(fn(result.value), result.meta)
      : result;
  }
};

// Migration strategy: Adapter pattern for backward compatibility
export function toJSONResult<T>(result: Result<T>): JSONResult<T> {
  return result.kind === 'ok'
    ? { success: true, data: result.value, code: ERROR_CODES.OK }
    : { success: false, error: String(result.error), code: result.code };
}
```

### Security Improvements

#### 1. Network Data Sanitization

```typescript
// src/security/DataSanitizer.ts
export class NetworkDataSanitizer implements IDataSanitizer {
  private readonly sensitivePatterns = [
    { pattern: /authorization:\s*[^\s,}]+/gi, replacement: 'authorization: [REDACTED]' },
    { pattern: /"password"\s*:\s*"[^"]*"/g, replacement: '"password":"[REDACTED]"' },
    { pattern: /api[_-]?key["\s]*[:=]["\s]*[^",}\s]+/gi, replacement: 'api_key=[REDACTED]' },
    { pattern: /token["\s]*[:=]["\s]*[^",}\s]+/gi, replacement: 'token=[REDACTED]' }
  ];
  
  sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    for (const header of sensitiveHeaders) {
      if (header in sanitized) {
        sanitized[header] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  
  sanitizeBody(body: string, contentType?: string): string {
    let sanitized = body;
    for (const { pattern, replacement } of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }
}
```

#### 2. Path Traversal Prevention

```typescript
// src/security/PathValidator.ts
export class SecurePathValidator {
  private readonly allowedPrefixes = [
    process.env.HOME,
    '/tmp',
    process.cwd()
  ];
  
  validateFilePath(inputPath: string): ValidationResult {
    const normalized = path.normalize(path.resolve(inputPath));
    
    // Check for traversal patterns
    if (inputPath.includes('../') || inputPath.includes('..\\')) {
      return ValidationResult.error('Path traversal detected');
    }
    
    // Ensure path is within allowed directories
    const isAllowed = this.allowedPrefixes.some(prefix => 
      normalized.startsWith(prefix)
    );
    
    if (!isAllowed) {
      return ValidationResult.error('Path outside allowed directories');
    }
    
    // Check file extension against whitelist
    const ext = path.extname(normalized).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    
    if (!allowedExtensions.includes(ext)) {
      return ValidationResult.error(`File type ${ext} not allowed`);
    }
    
    return ValidationResult.ok(normalized);
  }
}
```

### Testing Enhancements

#### 1. Comprehensive Failure Scenarios

```typescript
// test/integration/error-scenarios.test.ts
describe('Comprehensive Error Handling', () => {
  describe('Permission Failures', () => {
    it('should handle Chrome running but AppleScript denied', async () => {
      // Setup: Chrome is running
      mockChromeDetection.mockResolvedValue(true);
      
      // Setup: AppleScript permission denied
      mockAppleScriptExecution.mockRejectedValue(
        new PermissionError('Not authorized to send Apple events', ERROR_CODES.PERMISSION_DENIED)
      );
      
      // Execute command that requires AppleScript
      const result = await captureSnapshot({ visibleOnly: true });
      
      // Verify proper error handling
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
      expect(result.error).toContain('AppleScript permission required');
    });
    
    it('should handle partial permissions (automation yes, screen recording no)', async () => {
      // Test mixed permission states
    });
  });
  
  describe('Timeout and Network Failures', () => {
    it('should handle AppleScript timeout during long operations', async () => {
      const operation = executeWithTimeout('complex operation', 5000);
      
      // Simulate timeout after 5 seconds
      jest.advanceTimersByTime(5001);
      
      const result = await operation;
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.TIMEOUT);
    });
  });
  
  describe('Concurrent Operation Failures', () => {
    it('should handle resource conflicts in parallel operations', async () => {
      // Test race conditions and resource locks
    });
  });
});
```

#### 2. Realistic Mock Patterns

```typescript
// test/mocks/AppleScriptMock.ts
export class RealisticAppleScriptMock {
  private readonly realErrorPatterns = [
    {
      trigger: /window 999/,
      error: 'execution error: Can\'t get window 999 of application "Google Chrome". Invalid index. (-1719)',
      code: ERROR_CODES.TARGET_NOT_FOUND
    },
    {
      trigger: /not authorized/,
      error: 'execution error: Not authorized to send Apple events to Google Chrome. (-1743)',
      code: ERROR_CODES.PERMISSION_DENIED
    }
  ];
  
  async execute(script: string): Promise<Result<string>> {
    // Simulate realistic timing (50-200ms)
    await this.simulateExecutionTime();
    
    // Check for error patterns
    for (const pattern of this.realErrorPatterns) {
      if (pattern.trigger.test(script)) {
        return Result.error(new Error(pattern.error), pattern.code);
      }
    }
    
    // Return successful result
    return Result.ok(this.generateMockResult(script));
  }
  
  private async simulateExecutionTime(): Promise<void> {
    const delay = 50 + Math.random() * 150;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

## User Experience

The refactoring will be completely transparent to users:

1. **All CLI commands remain unchanged** - Same syntax and options
2. **JSON output formats preserved** - No breaking changes to programmatic usage
3. **Error messages remain consistent** - Same error codes and messages
4. **Performance maintained or improved** - Caching and optimizations preserved

Internal improvements will enhance reliability:
- Better error messages with actionable solutions
- More robust handling of edge cases
- Improved security for sensitive operations
- Faster command execution through better caching

## Testing Strategy

### Unit Tests
- **Service isolation**: Test each service independently with mocks
- **Result transformations**: Verify Result<T> pattern conversions
- **Security validators**: Test path traversal and data sanitization
- **Cache behavior**: Verify LRU cache and TTL functionality

### Integration Tests
- **Command execution**: Full command flow with real services
- **Error propagation**: Verify errors bubble up correctly
- **Permission handling**: Test various permission states
- **Concurrent operations**: Verify thread safety

### System Tests
- **End-to-end flows**: Complete user workflows
- **Performance benchmarks**: Ensure no regression
- **Memory profiling**: Verify no memory leaks
- **Security scanning**: Automated vulnerability checks

### Test Documentation
Each test must include:
```typescript
/**
 * Purpose: Validates that AppleScript timeout errors are properly handled
 * Scenario: Long-running Chrome operation exceeds configured timeout
 * Expected: Returns TIMEOUT error code with descriptive message
 * Edge case: Tests boundary condition at exactly timeout threshold
 */
it('should handle AppleScript timeout at boundary', async () => {
  // Test implementation
});
```

## Performance Considerations

### Preserved Optimizations
- **LRU Script Cache**: 50 entries, 15-minute TTL
- **Coordinate Cache**: 100 entries, 30-second TTL  
- **Connection Pooling**: 5 connections, 30-second TTL
- **WebP Optimization**: Adaptive quality with streaming

### New Performance Improvements
- **Service pooling**: Reuse service instances
- **Lazy loading**: Load commands on demand
- **Batch operations**: Group related AppleScript calls
- **Memory management**: Explicit cleanup for large operations

### Performance Targets
- Command startup: < 50ms (currently ~100ms)
- Cache hit rate: > 80% (currently ~60%)
- Memory usage: < 100MB for typical usage
- No regression in existing benchmarks

## Security Considerations

### Critical Security Fixes
1. **Network monitoring sanitization** - Redact passwords, tokens, keys
2. **Path traversal prevention** - Validate and restrict file paths
3. **JavaScript injection prevention** - Enhanced validation patterns
4. **Permission validation** - Verify permissions before operations

### Security Patterns
```typescript
// All user input must be validated
const validated = validator.validate(userInput, schema);
if (!validated.success) {
  return Result.error(validated.error, ERROR_CODES.INVALID_INPUT);
}

// All external data must be sanitized
const sanitized = sanitizer.sanitize(externalData);

// All file operations must check paths
const safePath = pathValidator.validate(filePath);
if (!safePath.success) {
  return Result.error('Invalid file path', ERROR_CODES.INVALID_INPUT);
}
```

## Documentation

### Code Documentation
- **JSDoc coverage target**: 90%+ for public APIs
- **Usage examples**: Every public method includes example
- **Error documentation**: All error conditions documented
- **Type documentation**: All TypeScript interfaces documented

### User Documentation Updates
- **Migration guide**: For any breaking changes
- **Security guide**: Best practices for secure usage
- **Performance guide**: Optimization tips
- **Troubleshooting**: Enhanced error resolution

### Developer Documentation
- **Architecture guide**: System design and patterns
- **Contributing guide**: Code standards and practices
- **Testing guide**: How to write and run tests
- **API reference**: Complete command documentation

## Implementation Phases

### Phase 1: Critical Security and Architecture (Week 1-2)

#### Step 1.1: Security Hardening
- Implement `NetworkDataSanitizer` for sensitive data redaction
- Add `SecurePathValidator` for file upload validation
- Enhance JavaScript validation in DOM evaluation
- Add security tests for all vulnerabilities

#### Step 1.2: Architecture Decomposition
- Extract command registry from monolithic index.ts
- Create `MacChromeCLI` application class
- Implement `OutputFormatter` for result handling
- Split CLI concerns into separate modules

#### Step 1.3: Service Consolidation
- Create unified `AppleScriptService`
- Consolidate three duplicate implementations
- Standardize error handling across services
- Add comprehensive permission checking

### Phase 2: Code Quality and Consistency (Week 3-4)

#### Step 2.1: Result Pattern Unification
- Implement `Result<T, E>` pattern
- Create migration adapters for backward compatibility
- Update all 15+ result interfaces
- Add comprehensive result transformation tests

#### Step 2.2: Dependency Injection
- Implement `ServiceContainer` for IoC
- Define service interfaces and contracts
- Update commands to use dependency injection
- Enable easy mocking for tests

#### Step 2.3: Error Handling Standardization
- Unify error codes and messages
- Implement error context tracking
- Add error recovery strategies
- Enhance error documentation

### Phase 3: Testing and Documentation (Week 5)

#### Step 3.1: Test Enhancement
- Add comprehensive failure scenario tests
- Implement realistic AppleScript mocks
- Add concurrent operation tests
- Achieve 85%+ test coverage

#### Step 3.2: Documentation Improvement
- Add JSDoc to all public APIs (90%+ coverage)
- Create usage examples for all commands
- Document error conditions and recovery
- Update API documentation

#### Step 3.3: Performance Validation
- Run performance benchmarks
- Verify no regression
- Optimize identified bottlenecks
- Document performance characteristics

### Phase 4: Polish and Validation (Week 6)

#### Step 4.1: Integration Testing
- Full end-to-end testing
- Cross-command integration tests
- Permission scenario testing
- Security vulnerability scanning

#### Step 4.2: Memory and Performance
- Memory leak detection
- Performance profiling
- Cache effectiveness analysis
- Resource cleanup validation

#### Step 4.3: Final Validation
- User acceptance testing
- Backward compatibility verification
- Documentation review
- Security audit

## Open Questions

1. **Dependency Injection Framework**: Should we use a library like InversifyJS or implement a lightweight custom solution?

2. **Breaking Changes**: Are there any internal APIs that external tools might depend on that we should preserve?

3. **Configuration Management**: Should we add a configuration file system for customizing behavior?

4. **Telemetry**: Should we add opt-in telemetry for understanding usage patterns?

5. **Plugin System**: Is there interest in a plugin architecture for extending functionality?

6. **Error Reporting**: Should we integrate with error reporting services for production issues?

## References

### Internal Documentation
- [Original Architecture Specification](./feat-mac-chrome-cli.md)
- [Implementation Tasks](./feat-mac-chrome-cli-tasks.md)
- [Performance Documentation](../PERFORMANCE.md)
- [Claude Integration Guide](../CLAUDE.md)

### External References
- [Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)
- [Dependency Injection Pattern](https://martinfowler.com/articles/injection.html)
- [Result Type Pattern](https://doc.rust-lang.org/std/result/)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)

### Design Patterns
- Command Pattern for CLI architecture
- Service Layer Pattern for business logic
- Repository Pattern for data access
- Strategy Pattern for algorithm selection
- Observer Pattern for event handling

### Testing References
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)

---

## Service Interface Definitions

### Core Service Interfaces

This section provides complete interface definitions for all services in the refactored architecture, ensuring type safety and clear contracts between components.

#### IAppleScriptService

```typescript
// src/services/interfaces/IAppleScriptService.ts
export interface IAppleScriptService {
  /**
   * Execute AppleScript with caching and error handling
   * @param script - The AppleScript code to execute
   * @param options - Execution options including timeout and retries
   * @returns Promise resolving to script output or error
   */
  execute(script: string, options?: ExecutionOptions): Promise<Result<string>>;
  
  /**
   * Execute JavaScript in Chrome browser context
   * @param js - JavaScript code to execute
   * @param context - Browser context (tab, window)
   * @returns Promise resolving to execution result
   */
  executeJavaScript<T = any>(js: string, context: BrowserContext): Promise<Result<T>>;
  
  /**
   * Execute JavaScript with DOM element selection
   * @param js - JavaScript code template
   * @param selector - CSS selector for target element
   * @param context - Browser context
   * @returns Promise resolving to element operation result
   */
  executeWithSelector<T = any>(
    js: string, 
    selector: string, 
    context: BrowserContext
  ): Promise<Result<T>>;
  
  /**
   * Validate system permissions for AppleScript execution
   * @returns Promise resolving to permission status
   */
  validatePermissions(): Promise<Result<PermissionStatus>>;
  
  /**
   * Check if Chrome browser is running and accessible
   * @returns Promise resolving to browser availability status
   */
  checkBrowserAvailability(): Promise<Result<BrowserStatus>>;
  
  /**
   * Get current AppleScript execution statistics
   * @returns Service statistics including cache hits, execution times
   */
  getStatistics(): ServiceStatistics;
  
  /**
   * Start the service and initialize connections
   * @returns Promise resolving when service is ready
   */
  start(): Promise<Result<void>>;
  
  /**
   * Stop the service and cleanup resources
   * @returns Promise resolving when cleanup is complete
   */
  stop(): Promise<Result<void>>;
  
  /**
   * Clear internal caches and reset state
   * @returns Promise resolving when cleanup is complete
   */
  cleanup(): Promise<Result<void>>;
}

export interface ExecutionOptions {
  timeout?: number;           // Execution timeout in milliseconds (default: 5000)
  retries?: number;          // Number of retry attempts (default: 2)
  cacheKey?: string;         // Custom cache key for result caching
  cacheTTL?: number;         // Cache time-to-live in seconds
  suppressErrors?: boolean;   // Whether to suppress non-critical errors
}

export interface BrowserContext {
  tabIndex?: number;         // Target tab index (default: active tab)
  windowIndex?: number;      // Target window index (default: front window)
  validate?: boolean;        // Validate context before execution
}

export interface PermissionStatus {
  appleScript: boolean;      // AppleScript execution permission
  automation: boolean;       // Browser automation permission
  screenRecording: boolean;  // Screen recording permission
  accessibility: boolean;    // Accessibility permission
}

export interface BrowserStatus {
  isRunning: boolean;        // Chrome is running
  isAccessible: boolean;     // Chrome is accessible via AppleScript
  version: string;           // Chrome version
  tabCount: number;          // Number of open tabs
  activeTabUrl: string;      // URL of active tab
}
```

#### ICacheService

```typescript
// src/services/interfaces/ICacheService.ts
export interface ICacheService {
  /**
   * Store value in cache with optional TTL
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds
   * @returns Promise resolving when storage is complete
   */
  set(key: string, value: any, ttl?: number): Promise<Result<void>>;
  
  /**
   * Retrieve value from cache
   * @param key - Cache key
   * @returns Promise resolving to cached value or null if not found
   */
  get<T = any>(key: string): Promise<Result<T | null>>;
  
  /**
   * Check if key exists in cache
   * @param key - Cache key to check
   * @returns Promise resolving to existence status
   */
  has(key: string): Promise<Result<boolean>>;
  
  /**
   * Remove value from cache
   * @param key - Cache key to remove
   * @returns Promise resolving when deletion is complete
   */
  delete(key: string): Promise<Result<void>>;
  
  /**
   * Clear all cached values
   * @returns Promise resolving when cache is cleared
   */
  clear(): Promise<Result<void>>;
  
  /**
   * Get cache statistics and metrics
   * @returns Cache performance metrics
   */
  getStatistics(): CacheStatistics;
  
  /**
   * Set cache size limit
   * @param maxSize - Maximum number of entries
   * @returns Promise resolving when limit is applied
   */
  setMaxSize(maxSize: number): Promise<Result<void>>;
  
  /**
   * Perform cache cleanup and optimization
   * @returns Promise resolving when optimization is complete
   */
  optimize(): Promise<Result<void>>;
  
  /**
   * Start cache service with monitoring
   * @returns Promise resolving when service is ready
   */
  start(): Promise<Result<void>>;
  
  /**
   * Stop cache service and persist data if configured
   * @returns Promise resolving when shutdown is complete
   */
  stop(): Promise<Result<void>>;
}

export interface CacheStatistics {
  hitRate: number;           // Cache hit rate percentage
  totalRequests: number;     // Total cache requests
  totalHits: number;         // Total cache hits
  totalMisses: number;       // Total cache misses
  currentSize: number;       // Current number of entries
  maxSize: number;           // Maximum allowed entries
  memoryUsage: number;       // Estimated memory usage in bytes
  averageResponseTime: number; // Average response time in milliseconds
}
```

#### ICommandExecutor

```typescript
// src/services/interfaces/ICommandExecutor.ts
export interface ICommandExecutor {
  /**
   * Execute system command with options
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Promise resolving to command output
   */
  run(command: string, args: string[], options?: CommandOptions): Promise<Result<CommandOutput>>;
  
  /**
   * Execute command with streaming output
   * @param command - Command to execute
   * @param args - Command arguments
   * @param callback - Callback for streaming output
   * @param options - Execution options
   * @returns Promise resolving when command completes
   */
  runStreaming(
    command: string, 
    args: string[], 
    callback: (chunk: string) => void,
    options?: CommandOptions
  ): Promise<Result<void>>;
  
  /**
   * Execute command in background
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Promise resolving to process handle
   */
  runBackground(
    command: string, 
    args: string[], 
    options?: CommandOptions
  ): Promise<Result<ProcessHandle>>;
  
  /**
   * Kill running background process
   * @param handle - Process handle from runBackground
   * @returns Promise resolving when process is terminated
   */
  kill(handle: ProcessHandle): Promise<Result<void>>;
  
  /**
   * Check if command is available on system
   * @param command - Command name to check
   * @returns Promise resolving to availability status
   */
  isAvailable(command: string): Promise<Result<boolean>>;
  
  /**
   * Get executor statistics and performance metrics
   * @returns Executor performance data
   */
  getStatistics(): ExecutorStatistics;
  
  /**
   * Set resource limits for command execution
   * @param limits - Resource limits configuration
   * @returns Promise resolving when limits are applied
   */
  setLimits(limits: ResourceLimits): Promise<Result<void>>;
  
  /**
   * Start executor service
   * @returns Promise resolving when service is ready
   */
  start(): Promise<Result<void>>;
  
  /**
   * Stop executor service and terminate running processes
   * @returns Promise resolving when shutdown is complete
   */
  stop(): Promise<Result<void>>;
}

export interface CommandOptions {
  timeout?: number;          // Execution timeout in milliseconds
  cwd?: string;             // Working directory
  env?: Record<string, string>; // Environment variables
  shell?: boolean;          // Execute in shell
  encoding?: string;        // Output encoding (default: 'utf8')
  maxBuffer?: number;       // Maximum output buffer size
}

export interface CommandOutput {
  stdout: string;           // Standard output
  stderr: string;           // Standard error
  exitCode: number;         // Exit code
  duration: number;         // Execution duration in milliseconds
  command: string;          // Executed command
}

export interface ProcessHandle {
  pid: number;              // Process ID
  command: string;          // Command being executed
  startTime: Date;          // Process start time
}

export interface ExecutorStatistics {
  totalExecutions: number;   // Total commands executed
  successRate: number;       // Success rate percentage
  averageExecutionTime: number; // Average execution time
  activeProcesses: number;   // Currently running processes
  memoryUsage: number;       // Current memory usage
}

export interface ResourceLimits {
  maxMemory?: number;        // Maximum memory usage in MB
  maxConcurrency?: number;   // Maximum concurrent processes
  maxExecutionTime?: number; // Maximum execution time in seconds
}
```

#### IDataSanitizer

```typescript
// src/services/interfaces/IDataSanitizer.ts
export interface IDataSanitizer {
  /**
   * Sanitize HTTP headers by removing sensitive information
   * @param headers - Raw HTTP headers
   * @returns Sanitized headers with sensitive data redacted
   */
  sanitizeHeaders(headers: Record<string, string>): Record<string, string>;
  
  /**
   * Sanitize request/response body content
   * @param body - Raw body content
   * @param contentType - Content-Type header value
   * @returns Sanitized body with sensitive data redacted
   */
  sanitizeBody(body: string, contentType?: string): string;
  
  /**
   * Sanitize URL by removing sensitive query parameters
   * @param url - Raw URL
   * @returns Sanitized URL with sensitive parameters redacted
   */
  sanitizeUrl(url: string): string;
  
  /**
   * Sanitize JavaScript code by removing potential security risks
   * @param code - Raw JavaScript code
   * @param options - Sanitization options
   * @returns Sanitized JavaScript code
   */
  sanitizeJavaScript(code: string, options?: SanitizationOptions): Result<string>;
  
  /**
   * Sanitize file path to prevent directory traversal
   * @param path - Raw file path
   * @returns Sanitized and validated file path
   */
  sanitizePath(path: string): Result<string>;
  
  /**
   * Add custom sanitization pattern
   * @param pattern - Regular expression pattern
   * @param replacement - Replacement string
   * @returns Promise resolving when pattern is added
   */
  addPattern(pattern: RegExp, replacement: string): Promise<Result<void>>;
  
  /**
   * Remove custom sanitization pattern
   * @param pattern - Pattern to remove
   * @returns Promise resolving when pattern is removed
   */
  removePattern(pattern: RegExp): Promise<Result<void>>;
  
  /**
   * Get sanitization statistics
   * @returns Statistics on sanitization operations
   */
  getStatistics(): SanitizationStatistics;
  
  /**
   * Configure sanitization rules
   * @param config - Sanitization configuration
   * @returns Promise resolving when configuration is applied
   */
  configure(config: SanitizationConfig): Promise<Result<void>>;
  
  /**
   * Start sanitizer service
   * @returns Promise resolving when service is ready
   */
  start(): Promise<Result<void>>;
  
  /**
   * Stop sanitizer service
   * @returns Promise resolving when service is stopped
   */
  stop(): Promise<Result<void>>;
}

export interface SanitizationOptions {
  level: 'basic' | 'strict' | 'paranoid'; // Sanitization level
  allowEval?: boolean;       // Allow eval() function
  allowDOM?: boolean;        // Allow DOM manipulation
  customPatterns?: Array<{ pattern: RegExp; replacement: string }>; // Custom patterns
}

export interface SanitizationStatistics {
  totalSanitizations: number; // Total sanitization operations
  patternsMatched: Record<string, number>; // Patterns matched count
  bytesProcessed: number;     // Total bytes processed
  averageProcessingTime: number; // Average processing time
}

export interface SanitizationConfig {
  enabledPatterns: string[]; // Enabled pattern names
  customPatterns: Array<{ name: string; pattern: RegExp; replacement: string }>;
  logMatches: boolean;       // Log pattern matches
  strictMode: boolean;       // Enable strict sanitization
}
```

#### ServiceContainer Interface

```typescript
// src/core/ServiceContainer.ts
export interface ServiceContainer {
  /**
   * Register a service instance
   * @param token - Service identifier token
   * @param instance - Service instance or factory
   * @param options - Registration options
   * @returns Promise resolving when service is registered
   */
  register<T>(
    token: ServiceToken<T>, 
    instance: T | ServiceFactory<T>,
    options?: RegistrationOptions
  ): Promise<Result<void>>;
  
  /**
   * Resolve a service instance
   * @param token - Service identifier token
   * @returns Promise resolving to service instance
   */
  resolve<T>(token: ServiceToken<T>): Promise<Result<T>>;
  
  /**
   * Check if service is registered
   * @param token - Service identifier token
   * @returns Whether service is registered
   */
  has<T>(token: ServiceToken<T>): boolean;
  
  /**
   * Unregister a service
   * @param token - Service identifier token
   * @returns Promise resolving when service is unregistered
   */
  unregister<T>(token: ServiceToken<T>): Promise<Result<void>>;
  
  /**
   * Create child container with inherited services
   * @returns New child container instance
   */
  createChild(): ServiceContainer;
  
  /**
   * Get all registered service tokens
   * @returns Array of registered service tokens
   */
  getRegisteredTokens(): ServiceToken<any>[];
  
  /**
   * Start all registered services
   * @returns Promise resolving when all services are started
   */
  startAll(): Promise<Result<void>>;
  
  /**
   * Stop all registered services
   * @returns Promise resolving when all services are stopped
   */
  stopAll(): Promise<Result<void>>;
  
  /**
   * Get container statistics
   * @returns Container performance and usage statistics
   */
  getStatistics(): ContainerStatistics;
  
  /**
   * Dispose container and cleanup resources
   * @returns Promise resolving when cleanup is complete
   */
  dispose(): Promise<Result<void>>;
}

export interface ServiceToken<T> {
  readonly name: string;
  readonly type: new (...args: any[]) => T;
}

export interface ServiceFactory<T> {
  create(container: ServiceContainer): Promise<T> | T;
}

export interface RegistrationOptions {
  singleton?: boolean;       // Register as singleton (default: true)
  lazy?: boolean;           // Lazy initialization (default: false)
  autoStart?: boolean;      // Auto-start service (default: true)
  dependencies?: ServiceToken<any>[]; // Service dependencies
}

export interface ContainerStatistics {
  registeredServices: number; // Number of registered services
  activeServices: number;     // Number of active services
  singletonInstances: number; // Number of singleton instances
  resolutionTime: Record<string, number>; // Resolution times by service
  memoryUsage: number;        // Estimated memory usage
}
```

#### Additional Service Interfaces

```typescript
// src/services/interfaces/IChromeService.ts
export interface IChromeService extends IAppleScriptService {
  /**
   * Navigate to URL in active tab
   * @param url - Target URL
   * @param options - Navigation options
   * @returns Promise resolving when navigation completes
   */
  navigate(url: string, options?: NavigationOptions): Promise<Result<NavigationResult>>;
  
  /**
   * Get current tab information
   * @param tabIndex - Tab index (default: active tab)
   * @returns Promise resolving to tab information
   */
  getTabInfo(tabIndex?: number): Promise<Result<TabInfo>>;
  
  /**
   * Create new tab
   * @param url - Initial URL for new tab
   * @returns Promise resolving to new tab information
   */
  createTab(url?: string): Promise<Result<TabInfo>>;
  
  /**
   * Close tab by index
   * @param tabIndex - Tab index to close
   * @returns Promise resolving when tab is closed
   */
  closeTab(tabIndex: number): Promise<Result<void>>;
  
  /**
   * Switch to tab by index
   * @param tabIndex - Target tab index
   * @returns Promise resolving when tab is active
   */
  switchToTab(tabIndex: number): Promise<Result<void>>;
  
  /**
   * Get all tabs information
   * @returns Promise resolving to array of tab information
   */
  getAllTabs(): Promise<Result<TabInfo[]>>;
}

// src/services/interfaces/IFileService.ts
export interface IFileService {
  /**
   * Upload files to web form
   * @param selector - File input selector
   * @param filePaths - Array of file paths to upload
   * @param options - Upload options
   * @returns Promise resolving when upload completes
   */
  uploadFiles(
    selector: string, 
    filePaths: string[], 
    options?: UploadOptions
  ): Promise<Result<UploadResult>>;
  
  /**
   * Validate file path for security
   * @param filePath - Path to validate
   * @returns Promise resolving to validation result
   */
  validatePath(filePath: string): Promise<Result<string>>;
  
  /**
   * Check if file exists and is accessible
   * @param filePath - File path to check
   * @returns Promise resolving to file status
   */
  checkFileAccess(filePath: string): Promise<Result<FileStatus>>;
  
  /**
   * Get file metadata
   * @param filePath - File path
   * @returns Promise resolving to file metadata
   */
  getFileInfo(filePath: string): Promise<Result<FileInfo>>;
}

// src/services/interfaces/INetworkService.ts
export interface INetworkService {
  /**
   * Start network monitoring
   * @param options - Monitoring options
   * @returns Promise resolving when monitoring starts
   */
  startMonitoring(options?: MonitoringOptions): Promise<Result<void>>;
  
  /**
   * Stop network monitoring
   * @returns Promise resolving when monitoring stops
   */
  stopMonitoring(): Promise<Result<void>>;
  
  /**
   * Get network events since monitoring started
   * @param format - Output format (json, har)
   * @returns Promise resolving to network events
   */
  getEvents(format?: 'json' | 'har'): Promise<Result<NetworkEvent[]>>;
  
  /**
   * Clear stored network events
   * @returns Promise resolving when events are cleared
   */
  clearEvents(): Promise<Result<void>>;
  
  /**
   * Export events to file
   * @param filePath - Output file path
   * @param format - Export format
   * @returns Promise resolving when export completes
   */
  exportEvents(filePath: string, format: 'json' | 'har'): Promise<Result<void>>;
}
```

## Configuration Schema

### Core Configuration System

The refactored architecture requires a comprehensive configuration system to manage performance settings, security policies, and service behaviors across different environments.

#### Configuration Structure

```typescript
// src/config/Configuration.ts
export interface MacChromeCLIConfig {
  /** Performance-related configuration */
  performance: PerformanceConfig;
  
  /** Security policies and validation rules */
  security: SecurityConfig;
  
  /** Service-specific configuration */
  services: ServicesConfig;
  
  /** Environment-specific settings */
  environment: EnvironmentConfig;
  
  /** Logging and monitoring configuration */
  monitoring: MonitoringConfig;
  
  /** Feature flags and experimental options */
  features: FeatureConfig;
}

export interface PerformanceConfig {
  /** Cache configuration for different data types */
  cache: {
    /** AppleScript result cache settings */
    appleScript: {
      maxSize: number;        // Maximum cache entries (default: 50)
      ttl: number;           // TTL in seconds (default: 900)
      cleanupInterval: number; // Cleanup interval in seconds (default: 300)
    };
    
    /** Element coordinate cache settings */
    coordinates: {
      maxSize: number;        // Maximum cache entries (default: 100)
      ttl: number;           // TTL in seconds (default: 30)
      cleanupInterval: number; // Cleanup interval in seconds (default: 60)
    };
    
    /** Network event cache settings */
    network: {
      maxEvents: number;      // Maximum stored events (default: 1000)
      maxMemory: number;      // Maximum memory usage in MB (default: 50)
      compressionEnabled: boolean; // Enable event compression (default: true)
    };
    
    /** DOM snapshot cache settings */
    snapshots: {
      maxSize: number;        // Maximum cache entries (default: 10)
      ttl: number;           // TTL in seconds (default: 60)
      maxDepth: number;       // Maximum DOM depth to cache (default: 5)
    };
  };
  
  /** Timeout configuration for different operations */
  timeouts: {
    appleScript: number;      // AppleScript execution timeout (default: 5000ms)
    navigation: number;       // Page navigation timeout (default: 30000ms)
    elementWait: number;      // Element availability wait (default: 10000ms)
    screenshot: number;       // Screenshot capture timeout (default: 5000ms)
    upload: number;          // File upload timeout (default: 30000ms)
  };
  
  /** Resource limits */
  limits: {
    maxConcurrentOperations: number; // Max parallel operations (default: 5)
    maxMemoryUsage: number;   // Max memory usage in MB (default: 200)
    maxProcesses: number;     // Max background processes (default: 3)
    maxFileSize: number;      // Max upload file size in MB (default: 100)
  };
  
  /** Retry and backoff strategies */
  retry: {
    maxAttempts: number;      // Maximum retry attempts (default: 3)
    baseDelay: number;        // Base delay between retries in ms (default: 1000)
    maxDelay: number;         // Maximum delay between retries in ms (default: 10000)
    backoffStrategy: 'linear' | 'exponential' | 'fixed'; // Backoff strategy
  };
  
  /** Image and media optimization */
  media: {
    webp: {
      quality: number;        // WebP quality (default: 80)
      effort: number;         // Compression effort (default: 4)
      progressive: boolean;   // Progressive encoding (default: true)
    };
    
    screenshots: {
      maxWidth: number;       // Maximum screenshot width (default: 1920)
      maxHeight: number;      // Maximum screenshot height (default: 1080)
      format: 'png' | 'webp' | 'jpeg'; // Default format (default: 'webp')
      previewMaxSize: number; // Preview size limit in bytes (default: 512000)
    };
  };
}

export interface SecurityConfig {
  /** Data sanitization rules */
  sanitization: {
    /** Enable automatic sanitization */
    enabled: boolean;
    
    /** Sanitization level for different data types */
    levels: {
      headers: 'basic' | 'strict' | 'paranoid';
      body: 'basic' | 'strict' | 'paranoid';
      urls: 'basic' | 'strict' | 'paranoid';
      javascript: 'basic' | 'strict' | 'paranoid';
    };
    
    /** Custom sanitization patterns */
    customPatterns: Array<{
      name: string;
      pattern: string;        // Regex pattern as string
      replacement: string;
      enabled: boolean;
    }>;
    
    /** Sensitive header detection */
    sensitiveHeaders: string[];
    
    /** Sensitive URL parameter detection */
    sensitiveParams: string[];
    
    /** Log sanitization actions */
    logActions: boolean;
  };
  
  /** File system security */
  fileSystem: {
    /** Allowed file upload directories */
    allowedUploadPaths: string[];
    
    /** Allowed file extensions for uploads */
    allowedExtensions: string[];
    
    /** Maximum file size in bytes */
    maxFileSize: number;
    
    /** Enable path traversal protection */
    pathTraversalProtection: boolean;
    
    /** Temporary file cleanup interval in seconds */
    tempFileCleanup: number;
  };
  
  /** JavaScript execution security */
  javascript: {
    /** Enable JavaScript validation */
    validationEnabled: boolean;
    
    /** Blocked JavaScript patterns */
    blockedPatterns: string[];
    
    /** Allowed DOM APIs */
    allowedAPIs: string[];
    
    /** Enable eval() protection */
    blockEval: boolean;
    
    /** Maximum script execution time */
    maxExecutionTime: number;
  };
  
  /** Network security */
  network: {
    /** Enable HTTPS-only mode */
    httpsOnly: boolean;
    
    /** Allowed domains for navigation */
    allowedDomains: string[];
    
    /** Block dangerous file types in downloads */
    blockedDownloadTypes: string[];
    
    /** Enable certificate validation */
    validateCertificates: boolean;
  };
}

export interface ServicesConfig {
  /** AppleScript service configuration */
  appleScript: {
    /** Permission check interval in seconds */
    permissionCheckInterval: number;
    
    /** Enable result caching */
    cachingEnabled: boolean;
    
    /** Script validation level */
    validationLevel: 'none' | 'basic' | 'strict';
    
    /** Maximum script length */
    maxScriptLength: number;
  };
  
  /** Chrome service configuration */
  chrome: {
    /** Browser detection method */
    detectionMethod: 'applescript' | 'process' | 'both';
    
    /** Startup wait time in milliseconds */
    startupWait: number;
    
    /** Tab switching delay in milliseconds */
    tabSwitchDelay: number;
    
    /** Enable browser health monitoring */
    healthMonitoring: boolean;
  };
  
  /** Cache service configuration */
  cache: {
    /** Cache implementation type */
    implementation: 'memory' | 'file' | 'hybrid';
    
    /** Persistent cache directory */
    persistentDirectory?: string;
    
    /** Enable cache compression */
    compressionEnabled: boolean;
    
    /** Cache statistics collection */
    collectStatistics: boolean;
  };
  
  /** Network service configuration */
  network: {
    /** Event buffer size */
    bufferSize: number;
    
    /** Enable event compression */
    compressionEnabled: boolean;
    
    /** Event retention time in seconds */
    retentionTime: number;
    
    /** Export batch size */
    exportBatchSize: number;
  };
  
  /** File service configuration */
  file: {
    /** Upload chunk size in bytes */
    uploadChunkSize: number;
    
    /** Enable upload progress tracking */
    progressTracking: boolean;
    
    /** Temporary directory for processing */
    tempDirectory: string;
    
    /** Enable file type validation */
    typeValidation: boolean;
  };
}

export interface EnvironmentConfig {
  /** Current environment */
  environment: 'development' | 'production' | 'testing';
  
  /** Debug mode settings */
  debug: {
    /** Enable debug logging */
    enabled: boolean;
    
    /** Debug log level */
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    
    /** Enable verbose AppleScript output */
    verboseAppleScript: boolean;
    
    /** Enable performance profiling */
    performanceProfiling: boolean;
  };
  
  /** Development-specific settings */
  development: {
    /** Enable hot reloading */
    hotReload: boolean;
    
    /** Mock external services */
    mockServices: boolean;
    
    /** Enable test helpers */
    testHelpers: boolean;
  };
  
  /** Production-specific settings */
  production: {
    /** Enable error reporting */
    errorReporting: boolean;
    
    /** Error reporting endpoint */
    errorReportingUrl?: string;
    
    /** Enable telemetry */
    telemetryEnabled: boolean;
    
    /** Telemetry endpoint */
    telemetryUrl?: string;
  };
}

export interface MonitoringConfig {
  /** Logging configuration */
  logging: {
    /** Log level */
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    
    /** Log output destinations */
    outputs: Array<'console' | 'file' | 'syslog'>;
    
    /** Log file path */
    filePath?: string;
    
    /** Enable structured logging */
    structured: boolean;
    
    /** Log rotation settings */
    rotation: {
      enabled: boolean;
      maxSize: string;      // e.g., '10MB'
      maxFiles: number;
    };
  };
  
  /** Metrics collection */
  metrics: {
    /** Enable metrics collection */
    enabled: boolean;
    
    /** Metrics collection interval in seconds */
    interval: number;
    
    /** Metrics to collect */
    collect: {
      performance: boolean;
      memory: boolean;
      cache: boolean;
      errors: boolean;
    };
    
    /** Metrics export */
    export: {
      enabled: boolean;
      format: 'prometheus' | 'json' | 'csv';
      endpoint?: string;
    };
  };
  
  /** Health monitoring */
  health: {
    /** Enable health checks */
    enabled: boolean;
    
    /** Health check interval in seconds */
    interval: number;
    
    /** Health check timeout in milliseconds */
    timeout: number;
    
    /** Health check endpoints */
    checks: {
      chrome: boolean;
      permissions: boolean;
      diskSpace: boolean;
      memory: boolean;
    };
  };
}

export interface FeatureConfig {
  /** Experimental features */
  experimental: {
    /** Enable parallel command execution */
    parallelExecution: boolean;
    
    /** Enable advanced caching strategies */
    advancedCaching: boolean;
    
    /** Enable machine learning optimizations */
    mlOptimizations: boolean;
  };
  
  /** Beta features */
  beta: {
    /** Enable new screenshot formats */
    newScreenshotFormats: boolean;
    
    /** Enable enhanced error recovery */
    enhancedErrorRecovery: boolean;
    
    /** Enable plugin system */
    pluginSystem: boolean;
  };
  
  /** Legacy support */
  legacy: {
    /** Support deprecated command formats */
    deprecatedCommands: boolean;
    
    /** Legacy output format compatibility */
    legacyOutput: boolean;
    
    /** Maintain backward compatibility */
    backwardCompatibility: boolean;
  };
}
```

#### Configuration Loading and Validation

```typescript
// src/config/ConfigurationLoader.ts
export class ConfigurationLoader {
  private static readonly DEFAULT_CONFIG_PATHS = [
    './mac-chrome-cli.config.json',
    '~/.mac-chrome-cli/config.json',
    '/etc/mac-chrome-cli/config.json'
  ];
  
  /**
   * Load configuration from multiple sources with precedence
   * @param configPath - Optional explicit config file path
   * @returns Promise resolving to validated configuration
   */
  async loadConfiguration(configPath?: string): Promise<Result<MacChromeCLIConfig>> {
    try {
      // 1. Load default configuration
      let config = this.getDefaultConfiguration();
      
      // 2. Load from config files (in precedence order)
      const configPaths = configPath ? [configPath] : ConfigurationLoader.DEFAULT_CONFIG_PATHS;
      
      for (const path of configPaths) {
        const fileConfig = await this.loadConfigFile(path);
        if (fileConfig.kind === 'ok') {
          config = this.mergeConfigurations(config, fileConfig.value);
        }
      }
      
      // 3. Apply environment variable overrides
      config = this.applyEnvironmentOverrides(config);
      
      // 4. Validate final configuration
      const validation = this.validateConfiguration(config);
      if (validation.kind === 'error') {
        return validation;
      }
      
      return Result.ok(config);
    } catch (error) {
      return Result.error(error, ERROR_CODES.CONFIG_LOAD_FAILED);
    }
  }
  
  /**
   * Get default configuration values
   * @returns Default configuration object
   */
  private getDefaultConfiguration(): MacChromeCLIConfig {
    return {
      performance: {
        cache: {
          appleScript: { maxSize: 50, ttl: 900, cleanupInterval: 300 },
          coordinates: { maxSize: 100, ttl: 30, cleanupInterval: 60 },
          network: { maxEvents: 1000, maxMemory: 50, compressionEnabled: true },
          snapshots: { maxSize: 10, ttl: 60, maxDepth: 5 }
        },
        timeouts: {
          appleScript: 5000,
          navigation: 30000,
          elementWait: 10000,
          screenshot: 5000,
          upload: 30000
        },
        limits: {
          maxConcurrentOperations: 5,
          maxMemoryUsage: 200,
          maxProcesses: 3,
          maxFileSize: 100
        },
        retry: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffStrategy: 'exponential' as const
        },
        media: {
          webp: { quality: 80, effort: 4, progressive: true },
          screenshots: {
            maxWidth: 1920,
            maxHeight: 1080,
            format: 'webp' as const,
            previewMaxSize: 512000
          }
        }
      },
      security: {
        sanitization: {
          enabled: true,
          levels: {
            headers: 'strict' as const,
            body: 'strict' as const,
            urls: 'basic' as const,
            javascript: 'strict' as const
          },
          customPatterns: [],
          sensitiveHeaders: [
            'authorization', 'cookie', 'x-api-key', 'x-auth-token',
            'x-csrf-token', 'x-access-token', 'bearer'
          ],
          sensitiveParams: [
            'password', 'token', 'key', 'secret', 'auth',
            'api_key', 'access_token', 'refresh_token'
          ],
          logActions: false
        },
        fileSystem: {
          allowedUploadPaths: [
            process.env.HOME + '/Downloads',
            process.env.HOME + '/Documents',
            '/tmp'
          ],
          allowedExtensions: [
            '.pdf', '.doc', '.docx', '.txt', '.rtf',
            '.png', '.jpg', '.jpeg', '.gif', '.webp',
            '.zip', '.csv', '.xlsx'
          ],
          maxFileSize: 104857600, // 100MB
          pathTraversalProtection: true,
          tempFileCleanup: 3600 // 1 hour
        },
        javascript: {
          validationEnabled: true,
          blockedPatterns: [
            'eval\\s*\\(',
            'Function\\s*\\(',
            'setTimeout\\s*\\(',
            'setInterval\\s*\\(',
            'document\\.write'
          ],
          allowedAPIs: [
            'document.querySelector',
            'document.querySelectorAll',
            'element.click',
            'element.focus',
            'element.value',
            'window.scrollTo'
          ],
          blockEval: true,
          maxExecutionTime: 5000
        },
        network: {
          httpsOnly: false,
          allowedDomains: [], // Empty means all domains allowed
          blockedDownloadTypes: ['.exe', '.scr', '.bat', '.com', '.cmd'],
          validateCertificates: true
        }
      },
      services: {
        appleScript: {
          permissionCheckInterval: 300,
          cachingEnabled: true,
          validationLevel: 'basic' as const,
          maxScriptLength: 10000
        },
        chrome: {
          detectionMethod: 'both' as const,
          startupWait: 2000,
          tabSwitchDelay: 500,
          healthMonitoring: true
        },
        cache: {
          implementation: 'memory' as const,
          persistentDirectory: undefined,
          compressionEnabled: true,
          collectStatistics: true
        },
        network: {
          bufferSize: 1000,
          compressionEnabled: true,
          retentionTime: 3600,
          exportBatchSize: 100
        },
        file: {
          uploadChunkSize: 1048576, // 1MB
          progressTracking: true,
          tempDirectory: '/tmp/mac-chrome-cli',
          typeValidation: true
        }
      },
      environment: {
        environment: (process.env.NODE_ENV as any) || 'development',
        debug: {
          enabled: process.env.NODE_ENV !== 'production',
          level: 'info' as const,
          verboseAppleScript: false,
          performanceProfiling: false
        },
        development: {
          hotReload: false,
          mockServices: false,
          testHelpers: true
        },
        production: {
          errorReporting: false,
          errorReportingUrl: undefined,
          telemetryEnabled: false,
          telemetryUrl: undefined
        }
      },
      monitoring: {
        logging: {
          level: 'info' as const,
          outputs: ['console' as const],
          filePath: undefined,
          structured: false,
          rotation: {
            enabled: false,
            maxSize: '10MB',
            maxFiles: 5
          }
        },
        metrics: {
          enabled: false,
          interval: 60,
          collect: {
            performance: true,
            memory: true,
            cache: true,
            errors: true
          },
          export: {
            enabled: false,
            format: 'json' as const,
            endpoint: undefined
          }
        },
        health: {
          enabled: true,
          interval: 30,
          timeout: 5000,
          checks: {
            chrome: true,
            permissions: true,
            diskSpace: true,
            memory: true
          }
        }
      },
      features: {
        experimental: {
          parallelExecution: false,
          advancedCaching: false,
          mlOptimizations: false
        },
        beta: {
          newScreenshotFormats: false,
          enhancedErrorRecovery: false,
          pluginSystem: false
        },
        legacy: {
          deprecatedCommands: true,
          legacyOutput: true,
          backwardCompatibility: true
        }
      }
    };
  }
  
  /**
   * Apply environment variable overrides to configuration
   * @param config - Base configuration
   * @returns Configuration with environment overrides applied
   */
  private applyEnvironmentOverrides(config: MacChromeCLIConfig): MacChromeCLIConfig {
    const overrides: Partial<MacChromeCLIConfig> = {};
    
    // Performance overrides
    if (process.env.MAC_CHROME_CLI_CACHE_SIZE) {
      overrides.performance = {
        ...config.performance,
        cache: {
          ...config.performance.cache,
          appleScript: {
            ...config.performance.cache.appleScript,
            maxSize: parseInt(process.env.MAC_CHROME_CLI_CACHE_SIZE, 10)
          }
        }
      };
    }
    
    if (process.env.MAC_CHROME_CLI_TIMEOUT) {
      overrides.performance = {
        ...config.performance,
        timeouts: {
          ...config.performance.timeouts,
          appleScript: parseInt(process.env.MAC_CHROME_CLI_TIMEOUT, 10)
        }
      };
    }
    
    // Security overrides
    if (process.env.MAC_CHROME_CLI_SANITIZATION) {
      const enabled = process.env.MAC_CHROME_CLI_SANITIZATION.toLowerCase() === 'true';
      overrides.security = {
        ...config.security,
        sanitization: {
          ...config.security.sanitization,
          enabled
        }
      };
    }
    
    // Debug overrides
    if (process.env.MAC_CHROME_CLI_DEBUG) {
      const enabled = process.env.MAC_CHROME_CLI_DEBUG.toLowerCase() === 'true';
      overrides.environment = {
        ...config.environment,
        debug: {
          ...config.environment.debug,
          enabled
        }
      };
    }
    
    if (process.env.MAC_CHROME_CLI_LOG_LEVEL) {
      const level = process.env.MAC_CHROME_CLI_LOG_LEVEL as any;
      overrides.monitoring = {
        ...config.monitoring,
        logging: {
          ...config.monitoring.logging,
          level
        }
      };
    }
    
    return this.mergeConfigurations(config, overrides as MacChromeCLIConfig);
  }
  
  /**
   * Validate configuration object
   * @param config - Configuration to validate
   * @returns Validation result
   */
  private validateConfiguration(config: MacChromeCLIConfig): Result<void> {
    const errors: string[] = [];
    
    // Validate performance limits
    if (config.performance.cache.appleScript.maxSize < 1) {
      errors.push('Performance cache maxSize must be at least 1');
    }
    
    if (config.performance.timeouts.appleScript < 1000) {
      errors.push('AppleScript timeout must be at least 1000ms');
    }
    
    // Validate security settings
    if (config.security.fileSystem.maxFileSize > 1073741824) { // 1GB
      errors.push('Maximum file size cannot exceed 1GB');
    }
    
    // Validate file paths
    for (const path of config.security.fileSystem.allowedUploadPaths) {
      if (!this.isValidPath(path)) {
        errors.push(`Invalid upload path: ${path}`);
      }
    }
    
    // Validate environment settings
    const validEnvironments = ['development', 'production', 'testing'];
    if (!validEnvironments.includes(config.environment.environment)) {
      errors.push(`Invalid environment: ${config.environment.environment}`);
    }
    
    if (errors.length > 0) {
      return Result.error(
        new Error(`Configuration validation failed: ${errors.join(', ')}`),
        ERROR_CODES.INVALID_CONFIGURATION
      );
    }
    
    return Result.ok(undefined);
  }
  
  /**
   * Merge two configuration objects with deep merging
   * @param base - Base configuration
   * @param override - Override configuration
   * @returns Merged configuration
   */
  private mergeConfigurations(
    base: MacChromeCLIConfig, 
    override: Partial<MacChromeCLIConfig>
  ): MacChromeCLIConfig {
    // Implementation of deep merge logic
    return {
      ...base,
      ...override,
      performance: { ...base.performance, ...override.performance },
      security: { ...base.security, ...override.security },
      services: { ...base.services, ...override.services },
      environment: { ...base.environment, ...override.environment },
      monitoring: { ...base.monitoring, ...override.monitoring },
      features: { ...base.features, ...override.features }
    };
  }
  
  /**
   * Load configuration from file
   * @param filePath - Configuration file path
   * @returns Promise resolving to configuration or error
   */
  private async loadConfigFile(filePath: string): Promise<Result<Partial<MacChromeCLIConfig>>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);
      return Result.ok(config);
    } catch (error) {
      return Result.error(error, ERROR_CODES.CONFIG_FILE_NOT_FOUND);
    }
  }
  
  /**
   * Validate file path
   * @param path - Path to validate
   * @returns Whether path is valid
   */
  private isValidPath(path: string): boolean {
    try {
      const resolved = require('path').resolve(path);
      return resolved.startsWith('/') && !resolved.includes('..');
    } catch {
      return false;
    }
  }
}

/**
 * Configuration change handler for runtime updates
 */
export class ConfigurationWatcher {
  private readonly loader: ConfigurationLoader;
  private currentConfig: MacChromeCLIConfig;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private changeCallbacks: Array<(config: MacChromeCLIConfig) => void> = [];
  
  constructor(loader: ConfigurationLoader, initialConfig: MacChromeCLIConfig) {
    this.loader = loader;
    this.currentConfig = initialConfig;
  }
  
  /**
   * Start watching configuration files for changes
   * @param configPaths - Paths to watch
   * @returns Promise resolving when watching starts
   */
  async startWatching(configPaths: string[]): Promise<Result<void>> {
    try {
      for (const path of configPaths) {
        if (require('fs').existsSync(path)) {
          const watcher = require('fs').watch(path, async () => {
            await this.handleConfigChange();
          });
          this.watchers.set(path, watcher);
        }
      }
      return Result.ok(undefined);
    } catch (error) {
      return Result.error(error, ERROR_CODES.CONFIG_WATCH_FAILED);
    }
  }
  
  /**
   * Stop watching configuration files
   * @returns Promise resolving when watching stops
   */
  async stopWatching(): Promise<Result<void>> {
    try {
      for (const watcher of this.watchers.values()) {
        watcher.close();
      }
      this.watchers.clear();
      return Result.ok(undefined);
    } catch (error) {
      return Result.error(error, ERROR_CODES.CONFIG_WATCH_STOP_FAILED);
    }
  }
  
  /**
   * Register callback for configuration changes
   * @param callback - Function to call when configuration changes
   */
  onConfigChange(callback: (config: MacChromeCLIConfig) => void): void {
    this.changeCallbacks.push(callback);
  }
  
  /**
   * Handle configuration file changes
   */
  private async handleConfigChange(): Promise<void> {
    const newConfig = await this.loader.loadConfiguration();
    if (newConfig.kind === 'ok') {
      this.currentConfig = newConfig.value;
      for (const callback of this.changeCallbacks) {
        try {
          callback(this.currentConfig);
        } catch (error) {
          console.error('Error in config change callback:', error);
        }
      }
    }
  }
}
```

## Appendix A: File Structure After Refactoring

```
src/
├── cli/                      # CLI-specific code
│   ├── Application.ts        # Main application class
│   ├── CommandRegistry.ts    # Command registration and routing
│   ├── OutputFormatter.ts    # Result formatting (JSON/text)
│   └── GlobalOptions.ts      # Shared CLI options
├── commands/                 # Command implementations
│   ├── base/
│   │   └── BaseCommand.ts    # Abstract command class
│   └── [existing commands]
├── services/                 # Business logic services
│   ├── interfaces/           # Service interface definitions
│   │   ├── IAppleScriptService.ts
│   │   ├── ICacheService.ts
│   │   ├── ICommandExecutor.ts
│   │   ├── IDataSanitizer.ts
│   │   ├── IChromeService.ts
│   │   ├── IFileService.ts
│   │   └── INetworkService.ts
│   ├── AppleScriptService.ts
│   ├── ChromeService.ts
│   ├── FileService.ts
│   └── NetworkService.ts
├── config/                   # Configuration system
│   ├── Configuration.ts      # Configuration interfaces
│   ├── ConfigurationLoader.ts # Configuration loading and validation
│   └── ConfigurationWatcher.ts # Runtime configuration updates
├── core/                     # Core utilities
│   ├── Result.ts            # Result type pattern
│   ├── ErrorCodes.ts        # Error constants
│   ├── ServiceContainer.ts   # Dependency injection container
│   └── Types.ts             # Shared types
├── security/                 # Security utilities
│   ├── DataSanitizer.ts
│   ├── PathValidator.ts
│   └── InputValidator.ts
├── lib/                      # Existing libraries (preserved)
└── index.ts                  # Slim entry point (~50 lines)
```

## Appendix B: Migration Examples

### Example 1: Migrating Result Types

```typescript
// Before: Multiple result interfaces
interface MouseResult {
  success: boolean;
  result?: any;
  error?: string;
  code: ErrorCode;
}

// After: Unified Result pattern
type MouseResult = Result<MouseEventData, MouseError>;

// Backward compatibility adapter
function toMouseResult(result: Result<MouseEventData>): OldMouseResult {
  return result.kind === 'ok'
    ? { success: true, result: result.value, code: ERROR_CODES.OK }
    : { success: false, error: result.error.message, code: result.code };
}
```

### Example 2: Service Injection

```typescript
// Before: Direct imports and coupling
import { execWithTimeout } from '../lib/util.js';
import { execChromeJS } from '../lib/apple.js';

export async function captureSnapshot(options: SnapshotOptions) {
  const result = await execChromeJS(script, 1, 1);
  // ...
}

// After: Dependency injection
export class SnapshotCommand extends BaseCommand<SnapshotOptions, SnapshotData> {
  constructor(
    private readonly chrome: IChromeService,
    private readonly validator: IInputValidator
  ) {
    super();
  }
  
  async execute(options: SnapshotOptions): Promise<Result<SnapshotData>> {
    const validated = this.validator.validate(options, SnapshotSchema);
    if (!validated.success) return validated;
    
    return this.chrome.executeJavaScript(this.buildScript(validated.value));
  }
}
```

## Appendix C: Performance Benchmarks

### Current Performance (Baseline)
```
Operation          Target    Current   Status
─────────────────────────────────────────────
Click element      500ms     250ms     ✅ Exceeds
Type 50 chars      1000ms    500ms     ✅ Exceeds  
Screenshot         600ms     400ms     ✅ Exceeds
Snapshot outline   300ms     200ms     ✅ Exceeds
```

### Expected Performance (After Refactoring)
```
Operation          Target    Expected  Change
─────────────────────────────────────────────
Click element      500ms     230ms     -8%
Type 50 chars      1000ms    480ms     -4%
Screenshot         600ms     380ms     -5%
Snapshot outline   300ms     190ms     -5%
Startup time       100ms     50ms      -50% ⭐
```

---

This specification provides a comprehensive roadmap for improving the mac-chrome-cli architecture while maintaining all existing functionality and performance characteristics. The phased approach ensures continuous operation while systematically addressing identified issues.