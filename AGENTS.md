# AGENTS.md
This file provides guidance to AI coding assistants working in this repository.

**Note:** CLAUDE.md, .clinerules, .cursorrules, .windsurfrules, .replit.md, GEMINI.md, .github/copilot-instructions.md, and .idx/airules.md are symlinks to AGENTS.md in this project.

# mac-chrome-cli

A command-line interface for controlling Google Chrome on macOS systems, built for automation, testing, and browser control workflows. Written in TypeScript with enterprise-level architecture featuring dependency injection, unified error handling, and comprehensive testing.

## Build & Commands

### Development Commands
- **Build**: `npm run build` - Clean and compile TypeScript
- **Production Build**: `npm run build:prod` - Production build with optimized tsconfig
- **Clean**: `npm run clean` - Remove dist directory
- **Dev**: `npm run dev` - Run with tsx (TypeScript executor)
- **Dev Watch**: `npm run dev:watch` - Watch mode development
- **Start**: `npm start` - Start the application
- **Type Check**: `npm run type-check` - TypeScript type checking without emit

### Testing Commands
- **Test**: `npm test` - Run Jest tests
- **Test Watch**: `npm run test:watch` - Jest watch mode
- **Test Coverage**: `npm run test:coverage` - Generate coverage reports
- **Test Coverage Open**: `npm run test:coverage:open` - Generate and open coverage report
- **Test Unit**: `npm run test:unit` - Run unit tests only
- **Test Integration**: `npm run test:integration` - Run integration tests
- **Test System**: `npm run test:system` - Run system tests
- **Test CI**: `npm run test:ci` - CI test run with coverage
- **Test Publish**: `npm run test:publish` - Pre-publish test validation
- **Test Debug**: `npm run test:debug` - Debug tests with Node inspector
- **Test Clear Cache**: `npm run test:clear-cache` - Clear Jest cache
- **Test Verbose**: `npm run test:verbose` - Verbose test output

### Quality & Validation
- **Lint**: `npm run lint` - Linting (placeholder - not implemented yet)
- **Validate**: `npm run validate` - Type-check + CI tests
- **Validate Publish**: `npm run validate:publish` - Pre-publish validation

### Package Management
- **Prepack**: Automatically runs build before packaging
- **Prepublish Only**: `npm run prepublishOnly` - Comprehensive validation before publish
- **Pack Dry**: `npm run pack:dry` - Dry run package creation
- **Pack Test**: `npm run pack:test` - Create test package
- **Install Global**: `npm run install:global` - Install globally from current directory
- **Uninstall Global**: `npm run uninstall:global` - Remove global installation

### Size & Analysis
- **Size Check**: `npm run size-check` - Check built package size
- **Size Check Detail**: `npm run size-check:detail` - Detailed size breakdown

### Release Management
- **Release**: `npm run release` - Run release script
- **Release Patch**: `npm run release:patch` - Patch version bump
- **Release Minor**: `npm run release:minor` - Minor version bump
- **Release Major**: `npm run release:major` - Major version bump

### Script Command Consistency
**Important**: When modifying npm scripts in package.json, ensure all references are updated:
- GitHub Actions workflows (.github/workflows/*.yml)
- README.md documentation
- Contributing guides
- Docker files (if applicable)
- CI/CD configuration files
- Setup/installation scripts

## Code Style

### TypeScript Configuration
- **Target**: ES2022 with Node16 module resolution
- **Strict Mode**: Enabled with selective overrides for flexibility
- **ES Modules**: Full ESM support with .js extension imports
- **Declaration Files**: Generated for library usage

### Import Conventions
- Use ES module syntax: `import { } from './module.js'`
- Always include .js extension for local imports
- Group imports: external packages, then internal modules
- Use type imports when appropriate: `import type { }`

### Naming Conventions
- **Files**: camelCase for modules, PascalCase for classes/interfaces
- **Classes**: PascalCase (e.g., `AppleScriptService`)
- **Interfaces**: PascalCase with `I` prefix for service interfaces (e.g., `IAppleScriptService`)
- **Constants**: UPPER_SNAKE_CASE for enums and global constants
- **Functions**: camelCase for functions and methods
- **Private**: underscore prefix for private methods (e.g., `_validateInput`)

### Error Handling Patterns
- **Result<T, E> Pattern**: Use unified Result type for all operations
```typescript
export type Result<T, E = string> = 
  | { success: true; data: T; code: ErrorCode }
  | { success: false; error: E; code: ErrorCode; context?: ErrorContext };
```
- **Error Codes**: Use centralized ERROR_CODES enum
- **Recovery Hints**: Include recovery strategies in error context
- **Defensive Programming**: Validate inputs, handle edge cases

### Architecture Patterns
- **Service-Oriented**: Use dependency injection container
- **Command Pattern**: Extend base command classes
- **Repository Pattern**: Centralized service management
- **Single Responsibility**: Each module has one clear purpose
- **Interface Segregation**: Separate concerns with focused interfaces

### Best Practices
- **Type Safety**: Leverage TypeScript's type system fully
- **Immutability**: Prefer const and readonly where possible
- **Early Returns**: Guard clauses for cleaner code flow
- **Async/Await**: Use over promises for cleaner async code
- **Documentation**: JSDoc comments for public APIs
- **Testing**: Write tests alongside implementation

## Testing

### Framework: Jest with TypeScript
- **Preset**: ts-jest with ESM support
- **Environment**: Node.js test environment
- **Coverage Requirements**: 80% minimum across branches, functions, lines, statements
- **Test Timeout**: 30 seconds default, longer for integration tests

### Test File Patterns
- Unit tests: `**/__tests__/*.test.ts`, `test/unit/**/*.test.ts`
- Integration tests: `test/integration/**/*.test.ts`
- System tests: `test/system/**/*.test.ts`
- Performance tests: `test/performance/**/*.test.ts`

### Testing Conventions
- **Describe Blocks**: Group related tests logically
- **Test Names**: Use descriptive "should..." format
- **Arrange-Act-Assert**: Structure tests clearly
- **Mock Isolation**: Reset mocks between tests
- **Custom Matchers**: Use project-specific matchers (toBeValidCoordinates, etc.)

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should handle"

# Run with coverage
npm run test:coverage

# Debug tests
npm run test:debug
```

### Testing Philosophy
**When tests fail, fix the code, not the test.**

Key principles:
- **Tests should be meaningful** - Avoid tests that always pass regardless of behavior
- **Test actual functionality** - Call the functions being tested, don't just check side effects
- **Failing tests are valuable** - They reveal bugs or missing features
- **Fix the root cause** - When a test fails, fix the underlying issue, don't hide the test
- **Test edge cases** - Tests that reveal limitations help improve the code
- **Document test purpose** - Each test should include a comment explaining why it exists

## Security

### Data Protection
- **Path Validation**: SecurePathValidator prevents directory traversal
- **Data Sanitization**: NetworkDataSanitizer filters sensitive information
- **Input Validation**: Comprehensive validation for all user inputs
- **Secure Defaults**: Security-first configuration approach

### Security Best Practices
- **Never log sensitive data**: Passwords, tokens, API keys
- **Validate all paths**: Use PathValidator for file operations
- **Sanitize network data**: Filter before logging or displaying
- **Escape shell commands**: Prevent injection attacks
- **Limit permissions**: Request minimum required permissions

### macOS Permissions Required
- **Accessibility**: Control other applications
- **Screen Recording**: Screenshot functionality
- **Automation**: AppleScript execution
- **File Access**: Upload/download operations

## Directory Structure & File Organization

### Reports Directory
ALL project reports and documentation should be saved to the `reports/` directory:

```
mac-chrome-cli/
├── reports/              # All project reports and documentation
│   └── *.md             # Various report types
├── temp/                # Temporary files and debugging
└── [other directories]
```

### Report Generation Guidelines
**Important**: ALL reports should be saved to the `reports/` directory with descriptive names:

**Implementation Reports:**
- Phase validation: `PHASE_X_VALIDATION_REPORT.md`
- Implementation summaries: `IMPLEMENTATION_SUMMARY_[FEATURE].md`
- Feature completion: `FEATURE_[NAME]_REPORT.md`

**Testing & Analysis Reports:**
- Test results: `TEST_RESULTS_[DATE].md`
- Coverage reports: `COVERAGE_REPORT_[DATE].md`
- Performance analysis: `PERFORMANCE_ANALYSIS_[SCENARIO].md`
- Security scans: `SECURITY_SCAN_[DATE].md`

**Quality & Validation:**
- Code quality: `CODE_QUALITY_REPORT.md`
- Dependency analysis: `DEPENDENCY_REPORT.md`
- API compatibility: `API_COMPATIBILITY_REPORT.md`

**Report Naming Conventions:**
- Use descriptive names: `[TYPE]_[SCOPE]_[DATE].md`
- Include dates: `YYYY-MM-DD` format
- Group with prefixes: `TEST_`, `PERFORMANCE_`, `SECURITY_`
- Markdown format: All reports end in `.md`

### Temporary Files & Debugging
All temporary files, debugging scripts, and test artifacts should be organized in a `/temp` folder:

**Temporary File Organization:**
- **Debug scripts**: `temp/debug-*.js`, `temp/analyze-*.py`
- **Test artifacts**: `temp/test-results/`, `temp/coverage/`
- **Generated files**: `temp/generated/`, `temp/build-artifacts/`
- **Logs**: `temp/logs/debug.log`, `temp/logs/error.log`

**Guidelines:**
- Never commit files from `/temp` directory
- Use `/temp` for all debugging and analysis scripts
- Clean up `/temp` directory regularly
- Include `/temp/` in `.gitignore`

### Example `.gitignore` patterns
```
# Temporary files and debugging
/temp/
temp/
**/temp/
debug-*.js
test-*.py
analyze-*.sh
*-debug.*
*.debug

# Claude settings
.claude/settings.local.json

# Don't ignore reports directory
!reports/
!reports/**
```

### Claude Code Settings (.claude Directory)

The `.claude` directory contains Claude Code configuration files:

#### Version Controlled Files (commit these):
- `.claude/settings.json` - Shared team settings for hooks, tools, and environment
- `.claude/commands/*.md` - Custom slash commands available to all team members
- `.claude/hooks/*.sh` - Hook scripts for automated validations and actions
- `.claude/agents/**/*.md` - Specialized AI agent configurations

#### Ignored Files (do NOT commit):
- `.claude/settings.local.json` - Personal preferences and local overrides
- Any `*.local.json` files - Personal configuration not meant for sharing

**Important Notes:**
- Claude Code automatically adds `.claude/settings.local.json` to `.gitignore`
- The shared `settings.json` should contain team-wide standards
- Personal preferences belong in `settings.local.json`
- Hook scripts in `.claude/hooks/` should be executable (`chmod +x`)

## Configuration

### Environment Setup
- **Node.js**: Version 18.x or higher required
- **npm**: Version 8.x or higher
- **macOS**: 10.15 (Catalina) or later
- **Google Chrome**: Must be installed

### Development Environment Setup
```bash
# Clone repository
git clone [repository-url]
cd mac-chrome-cli

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Start development
npm run dev
```

### Required Permissions
1. **Accessibility**: System Preferences → Security & Privacy → Accessibility
2. **Screen Recording**: System Preferences → Security & Privacy → Screen Recording
3. **Automation**: Allow Terminal/IDE to control Chrome

### Configuration Files
- **tsconfig.json**: TypeScript configuration
- **tsconfig.prod.json**: Production build configuration
- **jest.config.js**: Test framework configuration
- **package.json**: Project dependencies and scripts

## Architecture Overview

### Core Architecture
```
Service Layer (DI Container)
    ↓
Command Layer (CLI Commands)
    ↓
Core Layer (Result<T,E> Pattern)
    ↓
Library Layer (Utilities)
    ↓
AppleScript/System APIs
```

### Key Components
- **ServiceContainer**: Dependency injection and lifecycle management
- **AppleScriptService**: Chrome automation via AppleScript
- **CommandRegistry**: CLI command registration and execution
- **Result<T,E>**: Unified error handling pattern
- **Security Layer**: Path validation and data sanitization

### Design Patterns
- **Dependency Injection**: Service-based architecture
- **Command Pattern**: Encapsulated command execution
- **Repository Pattern**: Centralized data access
- **Factory Pattern**: Service creation and configuration
- **Strategy Pattern**: Pluggable command implementations

## Git Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format**: `<type>[optional scope]: <description>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvements
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build process or auxiliary tools
- `ci`: CI configuration changes
- `build`: Changes that affect the build system or dependencies

**Scopes** (optional):
- `cli`: Command-line interface changes
- `core`: Core functionality changes
- `security`: Security-related changes
- `perf`: Performance optimizations
- `docs`: Documentation changes
- `deps`: Dependency changes

**Breaking Changes**: Add `!` after type/scope or `BREAKING CHANGE:` in footer

**Examples:**
```
feat(cli): add memory monitoring commands
fix(security): prevent directory traversal in file uploads
docs: update architecture overview in README
refactor!: migrate to unified Result<T,E> pattern
perf(core): implement AppleScript connection pooling
test: add comprehensive failure scenario coverage
```

**Attribution**: Include Claude Code attribution for AI-assisted changes:
```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Available AI Subagents

This project includes 25+ specialized AI agents in `.claude/agents/` for various development tasks:

### Core Development
- **oracle**: GPT-5 powered advanced analysis and problem-solving
- **typescript-expert**: Advanced TypeScript patterns and type system
- **testing-expert**: Jest testing, mocking strategies, coverage optimization
- **refactoring-expert**: Code quality improvement and refactoring

### Build & Infrastructure
- **webpack-expert**: Webpack configuration and optimization
- **vite-expert**: Vite build tool expertise
- **docker-expert**: Containerization and Docker optimization
- **github-actions-expert**: CI/CD pipeline configuration

### Specialized Domains
- **nodejs-expert**: Node.js runtime and ecosystem
- **react-expert**: React patterns and performance
- **database-expert**: Database design and optimization
- **security-expert**: Security best practices and vulnerability analysis

### Usage Example
When facing domain-specific challenges, delegate to specialized agents:
```
"I need help optimizing TypeScript type inference" → Use typescript-expert
"Jest tests are failing with mock issues" → Use testing-expert
"Need to containerize this application" → Use docker-expert
```

## Agent Delegation & Tool Execution

### ⚠️ MANDATORY: Always Delegate to Specialists & Execute in Parallel

**When specialized agents are available, you MUST use them instead of attempting tasks yourself.**

**When performing multiple operations, send all tool calls in a single message to execute them concurrently.**

#### Why Agent Delegation Matters:
- Specialists have deeper, more focused knowledge
- They're aware of edge cases and subtle bugs
- They follow established patterns and best practices
- They can provide more comprehensive solutions

#### Key Principles:
- **Agent Delegation**: Always check if a specialized agent exists for your task
- **Complex Problems**: Delegate to domain experts
- **Multiple Agents**: Send multiple Task calls in parallel
- **DEFAULT TO PARALLEL**: Execute multiple tools simultaneously unless sequential is required
- **Plan Upfront**: Determine all needed information, then execute searches together

#### Critical: Always Use Parallel Tool Calls

**These cases MUST use parallel tool calls:**
- Searching for different patterns (imports, usage, definitions)
- Multiple grep searches with different regex patterns
- Reading multiple files or searching different directories
- Combining Glob with Grep for comprehensive results
- Agent delegations with multiple Task calls

**Sequential calls ONLY when:**
You genuinely REQUIRE the output of one tool to determine the next tool usage.

**Performance Impact:** Parallel execution is 3-5x faster than sequential calls.

## Additional Project-Specific Guidelines

### Chrome Automation Patterns
- Always check if Chrome is running before commands
- Use Result<T,E> pattern for all Chrome operations
- Include recovery hints in error responses
- Validate selectors before interaction attempts

### Performance Considerations
- Cache AppleScript compilations
- Batch operations when possible
- Use connection pooling for AppleScript
- Monitor execution times in tests

### Testing Chrome Commands
- Mock AppleScript execution in unit tests
- Use real Chrome for integration tests
- Validate error scenarios thoroughly
- Test permission denial cases

Remember: This file serves as the single source of truth for all AI assistants working on this project. Keep it updated as the project evolves.