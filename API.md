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
  - [Wait Command](#wait-command)
  - [Network Commands](#network-commands)
  - [Snapshot Commands](#snapshot-commands)
  - [Scroll Commands](#scroll-commands)
  - [File Commands](#file-commands)
  - [DOM Commands](#dom-commands)
  - [Meta Commands](#meta-commands)
  - [Benchmark Command](#benchmark-command)

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

Comprehensive error code system with categories for precise error handling and recovery strategies.

### Success Codes
| Code | Constant | Description |
|------|----------|-------------|
| 0 | OK | Success |

### Input/Validation Errors (10-19)
| Code | Constant | Description |
|------|----------|-------------|
| 10 | INVALID_INPUT | Invalid input or arguments |
| 11 | INVALID_SELECTOR | Invalid CSS selector |
| 12 | INVALID_URL | Invalid URL format |
| 13 | INVALID_FILE_PATH | Invalid file path |
| 14 | INVALID_COORDINATES | Invalid coordinates |
| 15 | VALIDATION_FAILED | Input validation failed |
| 16 | MISSING_REQUIRED_PARAM | Missing required parameter |
| 17 | INVALID_JSON | Invalid JSON data |

### Target/Element Errors (20-29)
| Code | Constant | Description |
|------|----------|-------------|
| 20 | TARGET_NOT_FOUND | Target element/resource not found |
| 21 | ELEMENT_NOT_VISIBLE | Element exists but not visible |
| 22 | ELEMENT_NOT_INTERACTABLE | Element cannot be interacted with |
| 23 | MULTIPLE_TARGETS_FOUND | Multiple targets found when one expected |
| 24 | TARGET_OUTSIDE_VIEWPORT | Target element outside viewport |
| 25 | ELEMENT_STALE | Element reference is stale |

### Permission/Security Errors (30-39)
| Code | Constant | Description |
|------|----------|-------------|
| 30 | PERMISSION_DENIED | Permission denied or insufficient privileges |
| 31 | ACCESSIBILITY_DENIED | Accessibility permission denied |
| 32 | SCREEN_RECORDING_DENIED | Screen recording permission denied |
| 33 | FILE_SYSTEM_DENIED | File system access denied |
| 34 | APPLE_EVENTS_DENIED | Apple Events permission denied |
| 35 | SECURITY_RESTRICTION | Security restriction blocking operation |

### Timeout/Performance Errors (40-49)
| Code | Constant | Description |
|------|----------|-------------|
| 40 | TIMEOUT | Operation timed out |
| 41 | NETWORK_TIMEOUT | Network request timed out |
| 42 | SCRIPT_TIMEOUT | Script execution timed out |
| 43 | LOAD_TIMEOUT | Page load timed out |
| 44 | ANIMATION_TIMEOUT | Animation completion timed out |

### Chrome/Browser Errors (50-59)
| Code | Constant | Description |
|------|----------|-------------|
| 50 | CHROME_NOT_FOUND | Chrome not found or not running |
| 51 | CHROME_NOT_RUNNING | Chrome is not currently running |
| 52 | CHROME_CRASHED | Chrome has crashed |
| 53 | TAB_NOT_FOUND | Browser tab not found |
| 54 | WINDOW_NOT_FOUND | Browser window not found |
| 55 | PAGE_LOAD_FAILED | Web page failed to load |
| 56 | NAVIGATION_FAILED | Navigation to URL failed |
| 57 | JAVASCRIPT_ERROR | JavaScript execution error |

### Network/Connection Errors (60-69)
| Code | Constant | Description |
|------|----------|-------------|
| 60 | NETWORK_ERROR | Network error occurred |
| 61 | CONNECTION_REFUSED | Network connection refused |
| 62 | DNS_RESOLUTION_FAILED | DNS resolution failed |
| 63 | SSL_ERROR | SSL/TLS connection error |
| 64 | PROXY_ERROR | Proxy connection error |

### File System Errors (70-79)
| Code | Constant | Description |
|------|----------|-------------|
| 70 | FILE_NOT_FOUND | File not found |
| 71 | FILE_READ_ERROR | File read error |
| 72 | FILE_WRITE_ERROR | File write error |
| 73 | DIRECTORY_NOT_FOUND | Directory not found |
| 74 | DISK_FULL | Insufficient disk space |
| 75 | PATH_TOO_LONG | File path too long |

### System/Resource Errors (80-89)
| Code | Constant | Description |
|------|----------|-------------|
| 80 | MEMORY_ERROR | Memory allocation error |
| 81 | CPU_LIMIT_EXCEEDED | CPU usage limit exceeded |
| 82 | RESOURCE_UNAVAILABLE | System resource unavailable |
| 83 | PROCESS_FAILED | System process failed |
| 84 | SYSTEM_ERROR | General system error |
| 85 | RATE_LIMITED | Operation rate limited |

### AppleScript/Automation Errors (90-98)
| Code | Constant | Description |
|------|----------|-------------|
| 90 | APPLESCRIPT_ERROR | AppleScript execution error |
| 91 | APPLESCRIPT_COMPILATION_FAILED | AppleScript compilation failed |
| 92 | UI_AUTOMATION_FAILED | UI automation operation failed |
| 93 | COORDINATE_CALCULATION_FAILED | Screen coordinate calculation failed |
| 94 | SCREEN_CAPTURE_FAILED | Screen capture operation failed |
| 95 | MOUSE_CLICK_FAILED | Mouse click operation failed |
| 96 | KEYBOARD_INPUT_FAILED | Keyboard input operation failed |

### Unknown/Catch-all Error
| Code | Constant | Description |
|------|----------|-------------|
| 99 | UNKNOWN_ERROR | Unknown or unexpected error |

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
mac-chrome-cli nav go --url <url> [options]
```

**Options**:
- `--url <url>` (required): URL to navigate to
- `--wait`: Wait for page load completion
- `--timeout <ms>`: Navigation timeout in milliseconds (default: 30000)
- `--window <index>`: Target window index (default: 1)

**Returns**: 
Navigation result with page information including URL, title, loading state, and navigation capabilities

**Error Codes**:
- `INVALID_URL (12)`: When URL is malformed or uses unsupported protocol
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `NAVIGATION_FAILED (56)`: When navigation to URL fails
- `LOAD_TIMEOUT (43)`: When page loading exceeds timeout (with --wait)
- `NETWORK_ERROR (60)`: When network connectivity issues prevent navigation

**Examples**:
```bash
# Basic navigation
mac-chrome-cli nav go --url "https://example.com"

# Navigation with load waiting
mac-chrome-cli nav go --url "https://example.com" --wait --timeout 60000

# JSON output
mac-chrome-cli nav go --url "https://example.com" --json
# Returns: {
#   "success": true,
#   "data": {
#     "url": "https://example.com",
#     "title": "Example Domain",
#     "loading": false,
#     "canGoBack": true,
#     "canGoForward": false,
#     "timestamp": "2024-01-15T10:30:00.000Z"
#   }
# }
```

#### `nav reload`

Reload current page.

```bash
mac-chrome-cli nav reload [options]
```

**Options**:
- `--hard`: Perform hard reload (bypass cache)
- `--wait`: Wait for page load completion
- `--timeout <ms>`: Reload timeout in milliseconds (default: 30000)
- `--window <index>`: Target window index (default: 1)

**Returns**: 
Navigation result with updated page information

**Error Codes**:
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `TAB_NOT_FOUND (53)`: When no active tab exists
- `PAGE_LOAD_FAILED (55)`: When page fails to reload
- `LOAD_TIMEOUT (43)`: When reload exceeds timeout (with --wait)

**Examples**:
```bash
# Normal reload
mac-chrome-cli nav reload

# Hard reload bypassing cache
mac-chrome-cli nav reload --hard

# Reload with load waiting
mac-chrome-cli nav reload --wait --timeout 45000
```

#### `nav back`

Navigate back in browser history.

```bash
mac-chrome-cli nav back [options]
```

**Options**:
- `--wait`: Wait for page load completion
- `--timeout <ms>`: Navigation timeout in milliseconds (default: 30000)
- `--window <index>`: Target window index (default: 1)

**Returns**: 
Navigation result with previous page information

**Error Codes**:
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `TAB_NOT_FOUND (53)`: When no active tab exists
- `NAVIGATION_FAILED (56)`: When no previous page in history
- `LOAD_TIMEOUT (43)`: When navigation exceeds timeout (with --wait)

**Examples**:
```bash
# Basic back navigation
mac-chrome-cli nav back

# Back navigation with load waiting
mac-chrome-cli nav back --wait
```

#### `nav forward`

Navigate forward in browser history.

```bash
mac-chrome-cli nav forward [options]
```

**Options**:
- `--wait`: Wait for page load completion
- `--timeout <ms>`: Navigation timeout in milliseconds (default: 30000)
- `--window <index>`: Target window index (default: 1)

**Returns**: 
Navigation result with next page information

**Error Codes**:
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `TAB_NOT_FOUND (53)`: When no active tab exists
- `NAVIGATION_FAILED (56)`: When no forward page in history
- `LOAD_TIMEOUT (43)`: When navigation exceeds timeout (with --wait)

**Examples**:
```bash
# Basic forward navigation
mac-chrome-cli nav forward

# Forward navigation with load waiting
mac-chrome-cli nav forward --wait
```

### Tab Commands

#### `tab focus`

Focus tab by pattern matching title or URL.

```bash
mac-chrome-cli tab focus --pattern <pattern> [options]
```

**Options**:
- `--pattern <pattern>` (required): Pattern to match tab title or URL
- `--window-index <index>`: Target window index (default: 1)
- `--exact`: Use exact matching instead of substring matching

**Returns**: 
Information about the focused tab including ID, title, URL, and active status

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When no tab matches the pattern
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `WINDOW_NOT_FOUND (54)`: When specified window index does not exist

**Examples**:
```bash
# Focus tab by title substring
mac-chrome-cli tab focus --pattern "Dashboard"

# Focus tab with exact matching
mac-chrome-cli tab focus --pattern "My Dashboard" --exact

# JSON output
mac-chrome-cli tab focus --pattern "GitHub" --json
# Returns: {
#   "success": true,
#   "data": {
#     "action": "focus",
#     "targetTab": {
#       "id": 12345,
#       "title": "GitHub",
#       "url": "https://github.com",
#       "active": true,
#       "loading": false
#     }
#   }
# }
```

#### `tab active`

Get information about the currently active tab.

```bash
mac-chrome-cli tab active [options]
```

**Options**:
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Information about the currently active tab

**Error Codes**:
- `TAB_NOT_FOUND (53)`: When no active tab exists
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `WINDOW_NOT_FOUND (54)`: When specified window index does not exist

**Examples**:
```bash
# Get active tab information
mac-chrome-cli tab active

# Get active tab from specific window
mac-chrome-cli tab active --window-index 2 --json
```

#### `tab list`

List all tabs in a Chrome window.

```bash
mac-chrome-cli tab list [options]
```

**Options**:
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Array of tab information for all tabs in the window

**Error Codes**:
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `WINDOW_NOT_FOUND (54)`: When specified window index does not exist

**Examples**:
```bash
# List all tabs in default window
mac-chrome-cli tab list

# List tabs in specific window with JSON output
mac-chrome-cli tab list --window-index 2 --json
# Returns: {
#   "success": true,
#   "data": {
#     "action": "list",
#     "tabs": [
#       {
#         "id": 12345,
#         "title": "GitHub",
#         "url": "https://github.com",
#         "active": true,
#         "loading": false
#       },
#       {
#         "id": 12346,
#         "title": "Google",
#         "url": "https://google.com",
#         "active": false,
#         "loading": false
#       }
#     ]
#   }
# }
```

#### `tab focus-index`

Focus tab by its index position.

```bash
mac-chrome-cli tab focus-index --tab-index <index> [options]
```

**Options**:
- `--tab-index <index>` (required): Tab index to focus (1-based)
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Information about the focused tab

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When tab index does not exist
- `INVALID_INPUT (10)`: When tab index is invalid
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `WINDOW_NOT_FOUND (54)`: When specified window index does not exist

**Examples**:
```bash
# Focus first tab
mac-chrome-cli tab focus-index --tab-index 1

# Focus third tab in second window
mac-chrome-cli tab focus-index --tab-index 3 --window-index 2
```

### Screenshot Commands

#### `shot viewport`

Capture viewport screenshot (visible browser content).

```bash
mac-chrome-cli shot viewport [options]
```

**Options**:
- `--out <path>`: Output file path (auto-generated if not specified)
- `--format <format>`: Image format (png|jpg|pdf, default: png)
- `--quality <quality>`: JPEG quality 1-100 (jpg format only, default: 90)
- `--no-preview`: Disable WebP preview generation
- `--preview-max <size>`: Maximum preview size in bytes (default: 1572864)
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Screenshot file information including path, format, size, and optional preview data

**Error Codes**:
- `SCREEN_CAPTURE_FAILED (94)`: When screenshot capture fails
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `WINDOW_NOT_FOUND (54)`: When specified window index does not exist
- `FILE_WRITE_ERROR (72)`: When unable to save screenshot file
- `SCREEN_RECORDING_DENIED (32)`: When screen recording permissions not granted

**Examples**:
```bash
# Basic viewport screenshot
mac-chrome-cli shot viewport --out screenshot.png

# High-quality JPEG screenshot
mac-chrome-cli shot viewport --format jpg --quality 95 --out viewport.jpg

# JSON output with file info
mac-chrome-cli shot viewport --json
# Returns: {
#   "success": true,
#   "data": {
#     "filePath": "/path/to/screenshot-20240115-103000.png",
#     "format": "png",
#     "size": 156789,
#     "dimensions": {
#       "width": 1920,
#       "height": 1080
#     },
#     "preview": "data:image/webp;base64,..."
#   }
# }
```

#### `shot window`

Capture window screenshot (entire browser window with chrome).

```bash
mac-chrome-cli shot window [options]
```

**Options**:
- `--out <path>`: Output file path (auto-generated if not specified)
- `--format <format>`: Image format (png|jpg|pdf, default: png)
- `--quality <quality>`: JPEG quality 1-100 (jpg format only, default: 90)
- `--no-preview`: Disable WebP preview generation
- `--preview-max <size>`: Maximum preview size in bytes (default: 1572864)
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Screenshot file information including path, format, size, and optional preview data

**Error Codes**:
- `SCREEN_CAPTURE_FAILED (94)`: When screenshot capture fails
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `WINDOW_NOT_FOUND (54)`: When specified window index does not exist
- `FILE_WRITE_ERROR (72)`: When unable to save screenshot file
- `SCREEN_RECORDING_DENIED (32)`: When screen recording permissions not granted

**Examples**:
```bash
# Window screenshot with browser chrome
mac-chrome-cli shot window --out window.png

# PDF format window screenshot
mac-chrome-cli shot window --format pdf --out window.pdf
```

#### `shot element`

Capture screenshot of specific DOM element.

```bash
mac-chrome-cli shot element --selector <selector> [options]
```

**Options**:
- `--selector <selector>` (required): CSS selector for target element
- `--out <path>`: Output file path (auto-generated if not specified)
- `--format <format>`: Image format (png|jpg|pdf, default: png)
- `--quality <quality>`: JPEG quality 1-100 (jpg format only, default: 90)
- `--no-preview`: Disable WebP preview generation
- `--preview-max <size>`: Maximum preview size in bytes (default: 1572864)
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Screenshot file information with element bounds and screenshot data

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When element selector does not match any element
- `ELEMENT_NOT_VISIBLE (21)`: When element exists but is not visible
- `SCREEN_CAPTURE_FAILED (94)`: When screenshot capture fails
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running
- `INVALID_SELECTOR (11)`: When CSS selector is malformed

**Examples**:
```bash
# Element screenshot
mac-chrome-cli shot element --selector "#main-content" --out element.png

# Element screenshot with specific format
mac-chrome-cli shot element --selector ".header" --format jpg --quality 85
```

#### `shot fullscreen`

Capture fullscreen screenshot (entire screen).

```bash
mac-chrome-cli shot fullscreen [options]
```

**Options**:
- `--out <path>`: Output file path (auto-generated if not specified)
- `--format <format>`: Image format (png|jpg|pdf, default: png)
- `--quality <quality>`: JPEG quality 1-100 (jpg format only, default: 90)
- `--no-preview`: Disable WebP preview generation
- `--preview-max <size>`: Maximum preview size in bytes (default: 1572864)

**Returns**: 
Screenshot file information for entire screen capture

**Error Codes**:
- `SCREEN_CAPTURE_FAILED (94)`: When screenshot capture fails
- `FILE_WRITE_ERROR (72)`: When unable to save screenshot file
- `SCREEN_RECORDING_DENIED (32)`: When screen recording permissions not granted

**Examples**:
```bash
# Full screen screenshot
mac-chrome-cli shot fullscreen --out fullscreen.png

# High-quality fullscreen JPEG
mac-chrome-cli shot fullscreen --format jpg --quality 100
```

### Mouse Commands

#### `mouse click`

Click at coordinates or element.

```bash
mac-chrome-cli mouse click [options]
```

**Options**:
- `--selector <selector>`: CSS selector for element
- `--x <x>`: X coordinate (alternative to selector)
- `--y <y>`: Y coordinate (alternative to selector)
- `--button <button>`: Mouse button (left|right|middle, default: left)
- `--click-count <count>`: Number of clicks (default: 1)
- `--offset-x <x>`: X offset from element center
- `--offset-y <y>`: Y offset from element center
- `--window-index <index>`: Target window index (default: 1)

**Note**: Either `--selector` or both `--x` and `--y` must be provided.

**Returns**: 
Click operation result with target coordinates and element information

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When element selector does not match
- `ELEMENT_NOT_VISIBLE (21)`: When element exists but is not visible
- `ELEMENT_NOT_INTERACTABLE (22)`: When element cannot be clicked
- `INVALID_COORDINATES (14)`: When coordinates are invalid
- `MOUSE_CLICK_FAILED (95)`: When click operation fails
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running

**Examples**:
```bash
# Click element by selector
mac-chrome-cli mouse click --selector "#submit-button"

# Click at specific coordinates
mac-chrome-cli mouse click --x 100 --y 200

# Right-click with offset
mac-chrome-cli mouse click --selector ".menu" --button right --offset-x 10 --offset-y 5

# Double-click (using click-count)
mac-chrome-cli mouse click --selector ".file" --click-count 2
```

#### `mouse double-click`

Double-click at coordinates or element.

```bash
mac-chrome-cli mouse double-click [options]
```

**Options**:
- `--selector <selector>`: CSS selector for element
- `--x <x>`: X coordinate (alternative to selector)
- `--y <y>`: Y coordinate (alternative to selector)
- `--offset-x <x>`: X offset from element center
- `--offset-y <y>`: Y offset from element center
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Double-click operation result with target coordinates

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When element selector does not match
- `ELEMENT_NOT_VISIBLE (21)`: When element exists but is not visible
- `MOUSE_CLICK_FAILED (95)`: When double-click operation fails

**Examples**:
```bash
# Double-click element
mac-chrome-cli mouse double-click --selector ".file-item"

# Double-click at coordinates
mac-chrome-cli mouse double-click --x 150 --y 300
```

#### `mouse right-click`

Right-click (context menu) at coordinates or element.

```bash
mac-chrome-cli mouse right-click [options]
```

**Options**:
- `--selector <selector>`: CSS selector for element
- `--x <x>`: X coordinate (alternative to selector)
- `--y <y>`: Y coordinate (alternative to selector)
- `--offset-x <x>`: X offset from element center
- `--offset-y <y>`: Y offset from element center
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Right-click operation result with target coordinates

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When element selector does not match
- `ELEMENT_NOT_VISIBLE (21)`: When element exists but is not visible
- `MOUSE_CLICK_FAILED (95)`: When right-click operation fails

**Examples**:
```bash
# Right-click element to open context menu
mac-chrome-cli mouse right-click --selector ".context-target"

# Right-click at coordinates
mac-chrome-cli mouse right-click --x 200 --y 100
```

#### `mouse move`

Move mouse to coordinates or element (hover).

```bash
mac-chrome-cli mouse move [options]
```

**Options**:
- `--selector <selector>`: CSS selector for element
- `--x <x>`: X coordinate (alternative to selector)
- `--y <y>`: Y coordinate (alternative to selector)
- `--offset-x <x>`: X offset from element center
- `--offset-y <y>`: Y offset from element center
- `--window-index <index>`: Target window index (default: 1)

**Note**: Either `--selector` or both `--x` and `--y` must be provided.

**Returns**: 
Mouse move operation result with final coordinates

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When element selector does not match
- `INVALID_COORDINATES (14)`: When coordinates are invalid
- `UI_AUTOMATION_FAILED (92)`: When mouse move operation fails

**Examples**:
```bash
# Hover over element
mac-chrome-cli mouse move --selector ".dropdown-trigger"

# Move to specific coordinates
mac-chrome-cli mouse move --x 300 --y 400

# Move with offset from element
mac-chrome-cli mouse move --selector ".tooltip-target" --offset-x 20 --offset-y -10
```

#### `mouse drag`

Drag from one location to another.

```bash
mac-chrome-cli mouse drag [options]
```

**Options**:
- `--from-selector <selector>` (required): CSS selector for source element
- `--from-x <x>`: Source X coordinate (if not using from-selector)
- `--from-y <y>`: Source Y coordinate (if not using from-selector)
- `--to-selector <selector>` (required): CSS selector for target element
- `--to-x <x>`: Target X coordinate (if not using to-selector)
- `--to-y <y>`: Target Y coordinate (if not using to-selector)
- `--window-index <index>`: Target window index (default: 1)

**Returns**: 
Drag operation result with source and target coordinates

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When source or target selectors don't match
- `ELEMENT_NOT_VISIBLE (21)`: When elements are not visible
- `INVALID_COORDINATES (14)`: When coordinates are invalid
- `UI_AUTOMATION_FAILED (92)`: When drag operation fails

**Examples**:
```bash
# Drag between elements
mac-chrome-cli mouse drag --from-selector ".draggable" --to-selector ".drop-zone"

# Drag from element to coordinates
mac-chrome-cli mouse drag --from-selector ".item" --to-x 500 --to-y 300

# Drag between coordinates
mac-chrome-cli mouse drag --from-x 100 --from-y 100 --to-x 200 --to-y 200
```

### Keyboard Commands

#### `keyboard type`

Type text.

```bash
mac-chrome-cli keyboard type --text <text> [options]
```

**Options**:
- `--text <text>` (required): Text to type
- `--speed <ms>`: Delay between characters in milliseconds (default: 50)
- `--clear`: Clear field before typing
- `--repeat <count>`: Number of times to repeat (default: 1)

**Returns**: 
Keyboard typing operation result with text and timing information

**Error Codes**:
- `KEYBOARD_INPUT_FAILED (96)`: When keyboard input operation fails
- `ACCESSIBILITY_DENIED (31)`: When accessibility permissions not granted
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running

**Examples**:
```bash
# Type text with default speed
mac-chrome-cli keyboard type --text "Hello, World!"

# Type text slowly with clear
mac-chrome-cli keyboard type --text "username@example.com" --speed 100 --clear

# Repeat typing
mac-chrome-cli keyboard type --text "test" --repeat 3
```

#### `keyboard combo`

Send key combination.

```bash
mac-chrome-cli keyboard combo --combo <combo> [options]
```

**Options**:
- `--combo <combo>` (required): Key combination (e.g., "cmd+s", "ctrl+c", "cmd+shift+r")
- `--repeat <count>`: Number of times to repeat (default: 1)

**Returns**: 
Key combination operation result

**Error Codes**:
- `KEYBOARD_INPUT_FAILED (96)`: When keyboard input operation fails
- `INVALID_INPUT (10)`: When key combination format is invalid
- `ACCESSIBILITY_DENIED (31)`: When accessibility permissions not granted

**Examples**:
```bash
# Save shortcut
mac-chrome-cli keyboard combo --combo "cmd+s"

# Copy shortcut
mac-chrome-cli keyboard combo --combo "cmd+c"

# Complex key combination
mac-chrome-cli keyboard combo --combo "cmd+shift+i"

# Repeat key combination
mac-chrome-cli keyboard combo --combo "cmd+z" --repeat 3
```

#### `keyboard press`

Press a special key.

```bash
mac-chrome-cli keyboard press --key <key> [options]
```

**Options**:
- `--key <key>` (required): Key to press (e.g., "Enter", "Tab", "Escape", "Space", "Backspace", "Delete")
- `--repeat <count>`: Number of times to repeat (default: 1)

**Returns**: 
Key press operation result

**Error Codes**:
- `KEYBOARD_INPUT_FAILED (96)`: When keyboard input operation fails
- `INVALID_INPUT (10)`: When key name is not recognized
- `ACCESSIBILITY_DENIED (31)`: When accessibility permissions not granted

**Examples**:
```bash
# Press Enter key
mac-chrome-cli keyboard press --key "Enter"

# Press Tab to move focus
mac-chrome-cli keyboard press --key "Tab"

# Press Escape multiple times
mac-chrome-cli keyboard press --key "Escape" --repeat 2

# Press special keys
mac-chrome-cli keyboard press --key "Backspace"
mac-chrome-cli keyboard press --key "Delete"
mac-chrome-cli keyboard press --key "Space"
```

#### `keyboard clear`

Clear the current input field.

```bash
mac-chrome-cli keyboard clear
```

**Returns**: 
Clear operation result

**Error Codes**:
- `KEYBOARD_INPUT_FAILED (96)`: When clear operation fails
- `ACCESSIBILITY_DENIED (31)`: When accessibility permissions not granted

**Examples**:
```bash
# Clear current input field
mac-chrome-cli keyboard clear
```

#### `keyboard shortcut`

Execute a predefined keyboard shortcut.

```bash
mac-chrome-cli keyboard shortcut --name <name> [options]
```

**Options**:
- `--name <name>` (required): Shortcut name (copy, paste, cut, undo, redo, selectall, save, refresh, etc.)
- `--repeat <count>`: Number of times to repeat (default: 1)

**Returns**: 
Shortcut execution result

**Error Codes**:
- `KEYBOARD_INPUT_FAILED (96)`: When shortcut execution fails
- `INVALID_INPUT (10)`: When shortcut name is not recognized
- `ACCESSIBILITY_DENIED (31)`: When accessibility permissions not granted

**Examples**:
```bash
# Copy shortcut
mac-chrome-cli keyboard shortcut --name "copy"

# Paste shortcut
mac-chrome-cli keyboard shortcut --name "paste"

# Undo shortcut
mac-chrome-cli keyboard shortcut --name "undo"

# Save shortcut with repeat
mac-chrome-cli keyboard shortcut --name "save" --repeat 2

# Available shortcuts: copy, paste, cut, undo, redo, selectall, save, refresh, find, newtab, closetab
```

### Input Commands

#### `input fill`

Fill input field with value.

```bash
mac-chrome-cli input fill --selector <selector> --value <value> [options]
```

**Options**:
- `--selector <selector>` (required): CSS selector for input element
- `--value <value>` (required): Value to enter into the input
- `--no-clear`: Do not clear existing content before filling
- `--method <method>`: Input method (auto|paste|type|js, default: auto)
- `--speed <ms>`: Typing speed in milliseconds (for type method, default: 50)
- `--window <index>`: Target window index (default: 1)
- `--mask-secret`: Mask value in logs (for sensitive data)

**Returns**: 
Input fill operation result with element information and method used

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When input element selector does not match
- `ELEMENT_NOT_VISIBLE (21)`: When input element is not visible
- `ELEMENT_NOT_INTERACTABLE (22)`: When input element cannot be interacted with
- `INVALID_SELECTOR (11)`: When CSS selector is malformed
- `KEYBOARD_INPUT_FAILED (96)`: When input operation fails

**Examples**:
```bash
# Fill input field
mac-chrome-cli input fill --selector "#email" --value "user@example.com"

# Fill password field (masked)
mac-chrome-cli input fill --selector "#password" --value "secret123" --mask-secret

# Fill with specific method
mac-chrome-cli input fill --selector "#search" --value "search query" --method paste

# Fill without clearing existing content
mac-chrome-cli input fill --selector "#comment" --value "Additional text" --no-clear

# Fill with slow typing
mac-chrome-cli input fill --selector "#username" --value "testuser" --method type --speed 100
```

#### `input get-value`

Get current value of input field.

```bash
mac-chrome-cli input get-value --selector <selector> [options]
```

**Options**:
- `--selector <selector>` (required): CSS selector for input element
- `--window <index>`: Target window index (default: 1)

**Returns**: 
Current value of the input field

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When input element selector does not match
- `INVALID_SELECTOR (11)`: When CSS selector is malformed
- `CHROME_NOT_RUNNING (51)`: When Chrome browser is not running

**Examples**:
```bash
# Get input value
mac-chrome-cli input get-value --selector "#email"

# Get value with JSON output
mac-chrome-cli input get-value --selector "#search-box" --json
# Returns: {
#   "success": true,
#   "data": {
#     "selector": "#search-box",
#     "value": "current search text",
#     "element": {
#       "tagName": "INPUT",
#       "type": "text"
#     }
#   }
# }
```

#### `input submit`

Submit form.

```bash
mac-chrome-cli input submit --selector <selector> [options]
```

**Options**:
- `--selector <selector>` (required): CSS selector for form or submit button
- `--window <index>`: Target window index (default: 1)

**Returns**: 
Form submission result

**Error Codes**:
- `TARGET_NOT_FOUND (20)`: When form or submit button selector does not match
- `ELEMENT_NOT_VISIBLE (21)`: When form element is not visible
- `ELEMENT_NOT_INTERACTABLE (22)`: When form cannot be submitted
- `INVALID_SELECTOR (11)`: When CSS selector is malformed

**Examples**:
```bash
# Submit form by form selector
mac-chrome-cli input submit --selector "#login-form"

# Submit form by button selector
mac-chrome-cli input submit --selector "button[type='submit']"

# Submit with JSON output
mac-chrome-cli input submit --selector ".contact-form" --json
```

### Wait Command

#### `wait`

Wait for a specified duration.

```bash
mac-chrome-cli wait [--ms <milliseconds>]
```

**Options**:
- `--ms <milliseconds>`: Duration to wait in milliseconds (default: 800)

**Returns**: 
Wait operation result with actual duration waited

**Error Codes**:
- `INVALID_INPUT (10)`: When milliseconds value is invalid

**Examples**:
```bash
# Default wait (800ms)
mac-chrome-cli wait

# Wait for specific duration
mac-chrome-cli wait --ms 2000

# Wait with JSON output
mac-chrome-cli wait --ms 1500 --json
# Returns: {
#   "success": true,
#   "data": {
#     "duration": 1500,
#     "actualDuration": 1501,
#     "timestamp": "2024-01-15T10:30:00.000Z"
#   }
# }
```

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

## Meta Commands

CLI information and statistics commands for monitoring and diagnostics.

### `meta info`

Show CLI version, capabilities, and implementation status.

```bash
mac-chrome-cli meta info [--json]
```

**Returns**: 
CLI version information, feature capabilities, and command implementation status

**Examples**:
```bash
# Human-readable CLI information
mac-chrome-cli meta info

# JSON output for programmatic use
mac-chrome-cli meta info --json
# Returns: {
#   "success": true,
#   "data": {
#     "version": "2.0.0",
#     "capabilities": ["screenshots", "automation", "monitoring"],
#     "commands": {
#       "implemented": 45,
#       "total": 50,
#       "percentage": 90
#     }
#   }
# }
```

### `meta stats`

Show CLI runtime statistics and performance metrics.

```bash
mac-chrome-cli meta stats [--json]
```

**Returns**: 
Runtime statistics including command usage, performance metrics, and system resource usage

**Examples**:
```bash
# Show runtime statistics
mac-chrome-cli meta stats

# JSON output with detailed metrics
mac-chrome-cli meta stats --json
```

### `meta commands`

List all available commands with descriptions and status.

```bash
mac-chrome-cli meta commands [--json]
```

**Returns**: 
Comprehensive list of all CLI commands with descriptions, options, and implementation status

**Examples**:
```bash
# List all commands
mac-chrome-cli meta commands

# JSON format for automation
mac-chrome-cli meta commands --json
```

### `meta permissions`

Show permission requirements for all features.

```bash
mac-chrome-cli meta permissions [--json]
```

**Returns**: 
Detailed permission requirements for different CLI features

**Examples**:
```bash
# Show permission requirements
mac-chrome-cli meta permissions

# JSON output for scripts
mac-chrome-cli meta permissions --json
```

### `meta performance`

Show performance statistics and optimization recommendations.

```bash
mac-chrome-cli meta performance [--json]
```

**Returns**: 
Performance metrics including cache statistics, connection pool status, memory usage, and optimization recommendations

**Examples**:
```bash
# Show performance metrics
mac-chrome-cli meta performance

# JSON format with detailed stats
mac-chrome-cli meta performance --json
# Returns: {
#   "success": true,
#   "data": {
#     "stats": {
#       "cacheStats": {
#         "scriptCache": { "size": 45, "maxSize": 100 },
#         "coordsCache": { "size": 23, "maxSize": 50 }
#       },
#       "connectionPool": {
#         "activeConnections": 2,
#         "maxConnections": 10
#       },
#       "memory": {
#         "rss": 128.5,
#         "heapUsed": 45.2,
#         "heapTotal": 89.1
#       }
#     },
#     "recommendations": [
#       "Consider clearing cache if size exceeds 80%",
#       "Memory usage is within normal range"
#     ]
#   }
# }
```

## Benchmark Command

Performance testing and benchmarking utilities for CLI operations.

### `benchmark`

Run performance benchmarks on CLI operations.

```bash
mac-chrome-cli benchmark [options]
```

**Options**:
- `--operation <operation>`: Specific operation to benchmark
- `--iterations <count>`: Number of iterations to run (default: 10)
- `--warmup <count>`: Number of warmup iterations (default: 3)
- `--output <format>`: Output format (table|json|csv, default: table)

**Returns**: 
Performance benchmark results with timing statistics

**Error Codes**:
- `INVALID_INPUT (10)`: When benchmark parameters are invalid
- `CHROME_NOT_RUNNING (51)`: When Chrome is required but not running

**Examples**:
```bash
# Run general benchmarks
mac-chrome-cli benchmark

# Benchmark specific operation
mac-chrome-cli benchmark --operation screenshot --iterations 20

# JSON output for analysis
mac-chrome-cli benchmark --output json
# Returns: {
#   "success": true,
#   "data": {
#     "operation": "screenshot",
#     "iterations": 20,
#     "warmupIterations": 3,
#     "results": {
#       "min": 125.5,
#       "max": 456.2,
#       "mean": 234.7,
#       "median": 221.3,
#       "stddev": 67.8,
#       "totalTime": 4694.0
#     },
#     "timestamp": "2024-01-15T10:30:00.000Z"
#   }
# }
```

## Examples

### Basic Usage

```bash
# Check system status
mac-chrome-cli doctor

# Take a screenshot
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