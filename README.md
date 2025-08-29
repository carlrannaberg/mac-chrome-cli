# mac-chrome-cli

A powerful command-line interface for controlling Google Chrome on macOS systems. Built for automation, testing, and browser control workflows.

## Overview

`mac-chrome-cli` provides programmatic control over Google Chrome through macOS's AppleScript and system automation APIs. It enables developers, testers, and automation engineers to:

- Take screenshots and capture page structure
- Navigate, scroll, and interact with web pages
- Execute JavaScript in browser context with DOM evaluation
- Monitor network traffic and performance
- Upload files and manage form inputs
- Integrate with Claude Code for AI-powered browser automation

## Architecture

`mac-chrome-cli` is built with a modern, service-oriented architecture that provides excellent performance, maintainability, and extensibility:

### Core Components

- **CLI Layer** (`src/cli/`): Command-line interface using Commander.js with modular command registration
- **Commands** (`src/commands/`): Individual command implementations extending base classes
- **Core Services** (`src/core/`): Unified error handling, result patterns, and retry mechanisms
- **Dependency Injection** (`src/di/`): Service container with lifecycle management and dependency resolution
- **Security Layer** (`src/security/`): Data sanitization and secure path validation
- **Service Layer** (`src/services/`): Business logic with AppleScript service abstraction

### Key Design Patterns

- **Unified Result<T,E> Pattern**: Type-safe error handling across all operations
- **Service-Oriented Architecture**: Modular services with dependency injection
- **Command Pattern**: Consistent command structure with base class inheritance
- **Repository Pattern**: Centralized service management and configuration
- **Decorator Pattern**: Enhanced error handling and retry capabilities

### Service Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   CLI Interface     │    │   Command Layer     │    │   Service Layer     │
│                     │    │                     │    │                     │
│ • MacChromeCLI      │───▶│ • SnapshotCommand   │───▶│ • AppleScriptService│
│ • CommandRegistry   │    │ • NavigationCommand │    │ • CacheService      │
│ • OutputFormatter   │    │ • InteractionCommand│    │ • LoggerService     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Core Systems      │    │   Security Layer    │    │   Utilities         │
│                     │    │                     │    │                     │
│ • Result<T,E>       │    │ • DataSanitizer     │    │ • Performance       │
│ • ErrorCodes        │    │ • PathValidator     │    │ • Benchmarking      │
│ • RetryHandler      │    │ • Input validation  │    │ • Compatibility     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Performance Optimizations

- **Connection Pooling**: Reuse AppleScript connections for better performance
- **Caching Layer**: LRU cache for frequently accessed data and compiled scripts
- **Batch Operations**: Group multiple AppleScript calls to reduce IPC overhead
- **Lazy Loading**: Services instantiated only when needed via dependency injection
- **Data Sanitization**: Secure input processing with performance-optimized validation

### Error Handling Strategy

The application uses a unified `Result<T, E>` pattern that provides:

- **Type Safety**: Compile-time guarantees for error handling
- **Recovery Hints**: Automatic suggestions for error resolution
- **Context Tracking**: Detailed error context for debugging
- **Consistent APIs**: Uniform error handling across all services
- **Functional Programming**: Map, flatMap, and other FP operations on results

## Features

- **Screenshots & Snapshots**: Capture viewport, window, or element screenshots; extract page structure
- **Navigation**: Control tabs, windows, and page navigation 
- **Interaction**: Mouse clicks, keyboard input, form filling, file uploads
- **DOM Evaluation**: Execute JavaScript in browser context with security validation and result serialization
- **Network Monitoring**: Capture and analyze network requests in JSON or HAR format
- **Scrolling**: Precise scroll control by pixels or to specific elements
- **System Integration**: Native macOS automation with proper permission handling
- **JSON Output**: Machine-readable output format for programmatic use

## Installation

### NPM (Recommended)

```bash
npm install -g mac-chrome-cli
```

### Homebrew

```bash
brew install mac-chrome-cli
```

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/carlrannaberg/mac-chrome-cli.git
cd mac-chrome-cli
```

2. Build and install:
```bash
npm install
npm run build
npm link
```

## Quick Start

1. **Check system setup**:
```bash
mac-chrome-cli doctor
```

2. **Take a screenshot**:
```bash
mac-chrome-cli shot viewport --out screenshot.png
```

3. **Navigate to a URL**:
```bash
mac-chrome-cli nav go --url https://example.com
```

4. **Capture page structure**:
```bash
mac-chrome-cli snapshot outline --visible-only
```

## Prerequisites

- macOS 10.15 (Catalina) or later
- Google Chrome installed
- System accessibility permissions (see [PERMISSIONS.md](./PERMISSIONS.md))
- Node.js 18.0.0 or later
- Terminal app permissions: Your terminal application (Terminal, iTerm2, etc.) must have permission to control your computer in System Settings → Privacy & Security → Accessibility

## Common Examples

### Taking Screenshots

```bash
# Capture current viewport
mac-chrome-cli shot viewport --out page.png

# Capture entire browser window
mac-chrome-cli shot window --out window.png

# Capture specific element
mac-chrome-cli shot element --selector "#main-content" --out element.png

# Advanced controls
# Prefer window-id method, use the frontmost window, and wait 200ms before capture
mac-chrome-cli shot viewport --method window-id --frontmost --delay-ms 200 --out page.png

# Diagnostics for screenshots
mac-chrome-cli doctor-screenshots
```

### Page Interaction

```bash
# Click on an element
mac-chrome-cli mouse click --selector "button#submit"

# Fill a form field
mac-chrome-cli input fill --selector "#email" --value "user@example.com"

# Upload files
mac-chrome-cli files upload --selector "input[type=file]" --path "/path/to/file.pdf"
```

### Scrolling

```bash
# Scroll to an element
mac-chrome-cli scroll to --selector "#footer"

# Scroll by pixels
mac-chrome-cli scroll by --px 500

# Get current scroll position
mac-chrome-cli scroll position
```

### Network Monitoring

```bash
# Start monitoring
mac-chrome-cli netlog start --max-events 1000

# Navigate and interact with the page
mac-chrome-cli nav go --url https://api-example.com

# Dump captured network events
mac-chrome-cli netlog dump --format har > network.har

# Stop monitoring
mac-chrome-cli netlog stop
```

### DOM Evaluation

Execute JavaScript in the browser context and get results back:

```bash
# Get page title
mac-chrome-cli dom eval --js "document.title"

# Get page dimensions
mac-chrome-cli dom eval --js "({width: window.innerWidth, height: window.innerHeight})"

# Check if element exists
mac-chrome-cli dom eval --js "document.querySelector('#login-form') !== null"

# Get form data
mac-chrome-cli dom eval --js "Object.fromEntries(new FormData(document.querySelector('form')))"

# Execute on specific tab/window
mac-chrome-cli dom eval --js "location.href" --tab 2 --window 1
```

### JSON Output

All commands support JSON output for programmatic use:

```bash
mac-chrome-cli snapshot outline --json | jq '.data.elements[0]'
mac-chrome-cli scroll position --json | jq '.data.y'
```

### Page Structure Snapshots

```bash
# Outline: interactive elements only
mac-chrome-cli snapshot outline --visible-only

# DOM-lite: pruned hierarchy (full algorithm)
mac-chrome-cli snapshot dom-lite --max-depth 6 --visible-only

# DOM-lite: lightweight fallback algorithm
mac-chrome-cli snapshot dom-lite --mode simple --max-depth 6 --visible-only
```

## Global Options

- `--json`: Output results in JSON format
- `--timeout <ms>`: Set command timeout (default: 30000ms)
- `--out <path>`: Output file path for screenshots and files
- `--preview-max <bytes>`: Maximum preview size (default: 1.5MB)

## Exit Codes

- `0`: Success
- `10`: Invalid input or arguments
- `20`: Target element/resource not found
- `30`: Permission denied or insufficient privileges
- `40`: Operation timed out
- `50`: Chrome not found or not running
- `99`: Unknown error

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure accessibility permissions are granted (see [PERMISSIONS.md](./PERMISSIONS.md))
2. **Chrome Not Found**: Install Google Chrome or ensure it's in Applications folder
3. **Command Timeouts**: Increase timeout with `--timeout` option
4. **Element Not Found**: Verify CSS selectors and ensure elements are visible

### Debugging

Use the doctor command to diagnose system issues:

```bash
mac-chrome-cli doctor
```

For detailed debugging, use JSON output to see full error information:

```bash
mac-chrome-cli command --json
```

## Documentation

- [API Reference](./API.md) - Complete command documentation
- [Permissions Setup](./PERMISSIONS.md) - macOS permission configuration
- [Claude Code Integration](./CLAUDE.md) - AI-powered automation patterns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

ISC License - see LICENSE file for details.

## Support

- [GitHub Issues](https://github.com/carlrannaberg/mac-chrome-cli/issues)
- [Documentation](https://github.com/carlrannaberg/mac-chrome-cli#readme)

---

For advanced usage and integration patterns, see the [complete API documentation](./API.md).
