# API Reference

Complete command reference for `mac-chrome-cli`.

## Table of Contents

- [Global Options](#global-options)
- [Exit Codes](#exit-codes)
- [Command Groups](#command-groups)
  - [System Commands](#system-commands)
  - [Navigation Commands](#navigation-commands)
  - [Tab Commands](#tab-commands)
  - [Screenshot Commands](#screenshot-commands)
  - [Mouse Commands](#mouse-commands)
  - [Keyboard Commands](#keyboard-commands)
  - [Input Commands](#input-commands)
  - [Network Commands](#network-commands)
  - [Snapshot Commands](#snapshot-commands)
  - [Scroll Commands](#scroll-commands)
  - [File Commands](#file-commands)
  - [DOM Commands](#dom-commands)

## Global Options

These options can be used with any command:

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output results in JSON format | false |
| `--timeout <ms>` | Command timeout in milliseconds | 30000 |
| `--preview-max <bytes>` | Maximum preview size in bytes | 1572864 (1.5MB) |
| `--out <path>` | Output file path for screenshots/files | - |

### JSON Output Format

When `--json` is specified, all commands return a consistent JSON structure:

```json
{
  "success": true,
  "data": {}, 
  "code": 0,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": 10,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Exit Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | OK | Success |
| 10 | INVALID_INPUT | Invalid input or arguments |
| 20 | TARGET_NOT_FOUND | Target element/resource not found |
| 30 | PERMISSION_DENIED | Permission denied or insufficient privileges |
| 40 | TIMEOUT | Operation timed out |
| 50 | CHROME_NOT_FOUND | Chrome not found or not running |
| 99 | UNKNOWN_ERROR | Unknown error |

## Command Groups

### System Commands

#### `test`

Test command to verify CLI is working.

```bash
mac-chrome-cli test
```

**Output**: Success message confirming CLI functionality.

#### `doctor`

Diagnose system setup and dependencies.

```bash
mac-chrome-cli doctor [--json]
```

**Output**: System diagnostics including dependencies, permissions, and recommendations.

**JSON Output**:
```json
{
  "overall": "healthy|warnings|errors",
  "dependencies": [
    {
      "name": "Google Chrome",
      "installed": true,
      "required": true,
      "version": "120.0.6099.109",
      "installCommand": "Download from https://chrome.google.com"
    }
  ],
  "permissions": [
    {
      "name": "Accessibility",
      "granted": true,
      "instructions": "Grant in System Preferences > Security & Privacy"
    }
  ],
  "system": [
    {
      "name": "macOS Version",
      "status": "ok",
      "description": "macOS 14.2.1",
      "details": "Compatible version"
    }
  ],
  "recommendations": []
}
```

### Navigation Commands

#### `nav go`

Navigate to a URL.

```bash
mac-chrome-cli nav go --url <url>
```

**Options**:
- `--url <url>` (required): URL to navigate to

**Status**: Not yet implemented

#### `nav reload`

Reload current page.

```bash
mac-chrome-cli nav reload [--hard]
```

**Options**:
- `--hard`: Perform hard reload (bypass cache)

**Status**: Not yet implemented

#### `nav back`

Navigate back in history.

```bash
mac-chrome-cli nav back
```

**Status**: Not yet implemented

#### `nav forward`

Navigate forward in history.

```bash
mac-chrome-cli nav forward
```

**Status**: Not yet implemented

### Tab Commands

#### `tab focus`

Focus tab by match criteria.

```bash
mac-chrome-cli tab focus --match <pattern>
```

**Options**:
- `--match <pattern>`: Pattern to match tab title or URL

**Status**: Not yet implemented

### Screenshot Commands

#### `shot viewport`

Capture viewport screenshot.

```bash
mac-chrome-cli shot viewport [--out <path>]
```

**Options**:
- `--out <path>`: Output file path (uses global `--out` if not specified)

**Status**: Not yet implemented

#### `shot window`

Capture window screenshot.

```bash
mac-chrome-cli shot window [--out <path>]
```

**Options**:
- `--out <path>`: Output file path (uses global `--out` if not specified)

**Status**: Not yet implemented

#### `shot element`

Capture element screenshot.

```bash
mac-chrome-cli shot element --selector <selector> [--out <path>]
```

**Options**:
- `--selector <selector>` (required): CSS selector for element
- `--out <path>`: Output file path (uses global `--out` if not specified)

**Status**: Not yet implemented

### Mouse Commands

#### `mouse click`

Click at coordinates or element.

```bash
mac-chrome-cli mouse click [--selector <selector>] [--x <x> --y <y>] [--button <button>]
```

**Options**:
- `--selector <selector>`: CSS selector for element
- `--x <x>`: X coordinate (alternative to selector)
- `--y <y>`: Y coordinate (alternative to selector)
- `--button <button>`: Mouse button (left|right|middle), default: left

**Note**: Either `--selector` or both `--x` and `--y` must be provided.

**Status**: Not yet implemented

#### `mouse move`

Move mouse to coordinates or element.

```bash
mac-chrome-cli mouse move [--selector <selector>] [--x <x> --y <y>]
```

**Options**:
- `--selector <selector>`: CSS selector for element
- `--x <x>`: X coordinate (alternative to selector)  
- `--y <y>`: Y coordinate (alternative to selector)

**Note**: Either `--selector` or both `--x` and `--y` must be provided.

**Status**: Not yet implemented

### Keyboard Commands

#### `keyboard type`

Type text.

```bash
mac-chrome-cli keyboard type --text <text> [--speed <ms>]
```

**Options**:
- `--text <text>` (required): Text to type
- `--speed <ms>`: Delay between characters in milliseconds, default: 50

**Status**: Not yet implemented

#### `keyboard keys`

Send key combination.

```bash
mac-chrome-cli keyboard keys --combo <combo>
```

**Options**:
- `--combo <combo>` (required): Key combination (e.g., "cmd+shift+r", "ctrl+c")

**Status**: Not yet implemented

### Input Commands

#### `input fill`

Fill input field.

```bash
mac-chrome-cli input fill --selector <selector> --value <value> [--clear]
```

**Options**:
- `--selector <selector>` (required): CSS selector for input element
- `--value <value>` (required): Value to fill
- `--clear`: Clear field before filling

**Status**: Not yet implemented

### Network Commands

#### `netlog start`

Start network monitoring.

```bash
mac-chrome-cli netlog start [--max-events <number>] [--body-limit <bytes>]
```

**Options**:
- `--max-events <number>`: Maximum number of events to store (1-10000), default: 100
- `--body-limit <bytes>`: Maximum body preview size in bytes (100-100000), default: 2048

**Output**: Success/failure message with monitoring configuration.

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "monitoring": true,
    "maxEvents": 100,
    "bodyPreviewLimit": 2048
  }
}
```

#### `netlog stop`

Stop network monitoring.

```bash
mac-chrome-cli netlog stop
```

**Output**: Success/failure message.

#### `netlog dump`

Dump captured network events.

```bash
mac-chrome-cli netlog dump [--format <format>]
```

**Options**:
- `--format <format>`: Output format (json|har), default: json

**JSON Output**:
```json
{
  "startTime": "2024-01-15T10:30:00.000Z",
  "endTime": "2024-01-15T10:35:00.000Z",
  "events": [
    {
      "timestamp": "2024-01-15T10:30:15.123Z",
      "type": "request",
      "method": "GET",
      "url": "https://example.com/api/data",
      "headers": {},
      "bodyPreview": null
    }
  ]
}
```

**HAR Output**: Standard HAR (HTTP Archive) format compatible with network analysis tools.

#### `netlog clear`

Clear captured network events.

```bash
mac-chrome-cli netlog clear
```

**Output**: Success/failure message.

### Snapshot Commands

#### `snapshot outline`

Capture flat list of interactive elements.

```bash
mac-chrome-cli snapshot outline [--visible-only]
```

**Options**:
- `--visible-only`: Only include visible elements

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Page",
    "elements": [
      {
        "selector": "#submit-button",
        "tagName": "BUTTON",
        "type": "button",
        "text": "Submit",
        "visible": true,
        "bounds": {
          "x": 100,
          "y": 200,
          "width": 80,
          "height": 32
        },
        "attributes": {
          "id": "submit-button",
          "class": "btn btn-primary"
        }
      }
    ]
  }
}
```

#### `snapshot dom-lite`

Capture pruned DOM hierarchy.

```bash
mac-chrome-cli snapshot dom-lite [--max-depth <depth>] [--visible-only]
```

**Options**:
- `--max-depth <depth>`: Maximum traversal depth, default: 10
- `--visible-only`: Only include visible elements

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Page",
    "dom": {
      "tagName": "HTML",
      "children": [
        {
          "tagName": "BODY",
          "children": [
            {
              "tagName": "DIV",
              "attributes": {"class": "container"},
              "text": "Content text",
              "children": []
            }
          ]
        }
      ]
    }
  }
}
```

### Scroll Commands

#### `scroll to`

Scroll to element (centers in viewport).

```bash
mac-chrome-cli scroll to --selector <selector> [--smooth] [--tab <index>] [--window <index>]
```

**Options**:
- `--selector <selector>` (required): CSS selector for element
- `--smooth`: Use smooth scrolling animation
- `--tab <index>`: Tab index (1-based), default: 1
- `--window <index>`: Window index (1-based), default: 1

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "scrolledTo": {
      "x": 0,
      "y": 500
    },
    "element": {
      "selector": "#footer",
      "bounds": {
        "x": 0,
        "y": 500,
        "width": 1200,
        "height": 100
      }
    }
  }
}
```

#### `scroll by`

Scroll by pixel amount.

```bash
mac-chrome-cli scroll by --px <pixels> [--smooth] [--horizontal] [--tab <index>] [--window <index>]
```

**Options**:
- `--px <pixels>` (required): Number of pixels to scroll (positive or negative)
- `--smooth`: Use smooth scrolling animation
- `--horizontal`: Scroll horizontally instead of vertically
- `--tab <index>`: Tab index (1-based), default: 1
- `--window <index>`: Window index (1-based), default: 1

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "scrolled": {
      "direction": "vertical",
      "pixels": 500,
      "smooth": false
    },
    "newPosition": {
      "x": 0,
      "y": 1000
    }
  }
}
```

#### `scroll position`

Get current scroll position.

```bash
mac-chrome-cli scroll position [--tab <index>] [--window <index>]
```

**Options**:
- `--tab <index>`: Tab index (1-based), default: 1
- `--window <index>`: Window index (1-based), default: 1

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "x": 0,
    "y": 500,
    "maxX": 0,
    "maxY": 2000
  }
}
```

### File Commands

#### `files upload`

Upload files to a file input element.

```bash
mac-chrome-cli files upload --selector <selector> --path <path> [--multiple]
```

**Options**:
- `--selector <selector>` (required): CSS selector for file input element
- `--path <path>` (required): File path or comma-separated paths for multiple files
- `--multiple`: Enable multiple file selection

**Examples**:
```bash
# Single file
mac-chrome-cli files upload --selector "input[type=file]" --path "/path/to/document.pdf"

# Multiple files
mac-chrome-cli files upload --selector "#file-input" --path "/path/to/file1.jpg,/path/to/file2.png" --multiple
```

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "totalFiles": 2,
    "filesUploaded": [
      "/path/to/file1.jpg",
      "/path/to/file2.png"
    ],
    "element": {
      "selector": "#file-input",
      "multiple": true
    }
  }
}
```

#### `files dragdrop`

Simulate drag and drop file upload to a dropzone.

```bash
mac-chrome-cli files dragdrop --selector <selector> --path <path> [--multiple]
```

**Options**:
- `--selector <selector>` (required): CSS selector for dropzone element
- `--path <path>` (required): File path or comma-separated paths for multiple files
- `--multiple`: Enable multiple file selection

**JSON Output**:
```json
{
  "success": true,
  "data": {
    "totalFiles": 1,
    "filesUploaded": [
      "/path/to/document.pdf"
    ],
    "dropzone": {
      "selector": ".upload-dropzone",
      "multiple": false
    }
  }
}
```

## Error Handling

All commands return appropriate exit codes and error messages. When using `--json`, errors are returned in a consistent format:

```json
{
  "success": false,
  "error": "Element not found: #nonexistent-element",
  "code": 20,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Common error scenarios:

- **Invalid selectors**: Returns code 10 (INVALID_INPUT)
- **Element not found**: Returns code 20 (TARGET_NOT_FOUND)  
- **Permission denied**: Returns code 30 (PERMISSION_DENIED)
- **Timeout**: Returns code 40 (TIMEOUT)
- **Chrome not running**: Returns code 50 (CHROME_NOT_FOUND)

## DOM Commands

Execute JavaScript in the browser context and retrieve results.

### `dom eval`

Execute JavaScript code in the active Chrome tab.

```bash
mac-chrome-cli dom eval --js "<javascript>" [--tab <index>] [--window <index>]
```

**Options:**
- `--js <javascript>` (required): JavaScript code to execute
- `--tab <index>`: Tab index (1-based, default: 1)
- `--window <index>`: Window index (1-based, default: 1)

**Security Features:**
- Input validation blocks dangerous patterns (`eval`, `Function`, `setTimeout`, etc.)
- Results are automatically serialized with 1MB size limit
- Non-serializable objects (DOM nodes, functions) are converted to descriptive representations

**Examples:**

```bash
# Get page title
mac-chrome-cli dom eval --js "document.title"

# Get page metadata
mac-chrome-cli dom eval --js "({
  title: document.title,
  url: location.href,
  dimensions: {
    width: window.innerWidth,
    height: window.innerHeight
  }
})"

# Check if element exists
mac-chrome-cli dom eval --js "document.querySelector('#login-form') !== null"

# Get element properties
mac-chrome-cli dom eval --js "document.querySelector('h1')?.textContent"

# Execute on specific tab
mac-chrome-cli dom eval --js "location.href" --tab 2
```

**Return Value:**

```json
{
  "success": true,
  "result": "Example Page Title",
  "meta": {
    "executionTimeMs": 15,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "resultSize": 18,
    "truncated": false
  }
}
```

For complex objects:

```json
{
  "success": true,
  "result": {
    "title": "Example Page",
    "url": "https://example.com",
    "dimensions": {
      "width": 1920,
      "height": 1080
    }
  },
  "meta": {
    "executionTimeMs": 25,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "resultSize": 128,
    "truncated": false
  }
}
```

**Error Handling:**

JavaScript execution errors are returned gracefully:

```json
{
  "success": false,
  "error": "ReferenceError: undefinedVariable is not defined",
  "meta": {
    "executionTimeMs": 5,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "resultSize": 0,
    "truncated": false
  }
}
```

Common error scenarios:
- **Empty JavaScript**: Returns code 10 (INVALID_INPUT)
- **Dangerous patterns**: Returns code 10 (INVALID_INPUT) with security message
- **Chrome not running**: Returns code 50 (CHROME_NOT_FOUND)
- **Tab/window not found**: Returns code 20 (TARGET_NOT_FOUND)

## Examples

### Basic Usage

```bash
# Check system status
mac-chrome-cli doctor

# Take a screenshot (when implemented)
mac-chrome-cli shot viewport --out screenshot.png

# Get page structure
mac-chrome-cli snapshot outline --visible-only --json
```

### Network Monitoring Workflow

```bash
# Start monitoring
mac-chrome-cli netlog start --max-events 500

# Perform web interactions
# (navigation, clicks, etc.)

# Export network data
mac-chrome-cli netlog dump --format har > network.har

# Clean up
mac-chrome-cli netlog stop
```

### File Upload Workflow

```bash
# Upload single file
mac-chrome-cli files upload --selector "input[type=file]" --path "/path/to/file.pdf"

# Upload multiple files with drag-drop simulation
mac-chrome-cli files dragdrop --selector ".dropzone" --path "/path/to/file1.jpg,/path/to/file2.png" --multiple
```

### Scrolling and Navigation

```bash
# Scroll to specific element
mac-chrome-cli scroll to --selector "#footer" --smooth

# Get current position
mac-chrome-cli scroll position --json

# Scroll by specific amount
mac-chrome-cli scroll by --px 500 --smooth
```

For more integration patterns and workflows, see [CLAUDE.md](./CLAUDE.md).