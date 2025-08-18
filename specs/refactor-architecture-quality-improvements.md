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
│   ├── AppleScriptService.ts
│   ├── ChromeService.ts
│   ├── FileService.ts
│   └── NetworkService.ts
├── core/                     # Core utilities
│   ├── Result.ts            # Result type pattern
│   ├── ErrorCodes.ts        # Error constants
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