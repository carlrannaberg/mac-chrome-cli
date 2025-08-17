# Task Breakdown: mac-chrome-cli

Generated: 2025-08-17  
Source: specs/feat-mac-chrome-cli.md  
Status: Ready for Implementation

## Overview

Building a macOS-native Chrome control CLI that provides human-like browser interaction through native APIs, designed for Claude Code integration. The implementation is divided into three phases with clear dependencies and parallel execution opportunities.

## Phase 1: Foundation & Core Infrastructure

### Task 1.1: Initialize TypeScript Project Structure
**Description**: Set up TypeScript project with ESM modules and build configuration  
**Size**: Small  
**Priority**: High  
**Dependencies**: None  
**Can run parallel with**: None (must complete first)

**Technical Requirements**:
- Node.js ≥ 18.0.0 (LTS)
- TypeScript ^5.5.0 with ES2022 target
- ESM module system with "type": "module"
- Commander ^12.0.0 for CLI framework
- Sharp ^0.33.4 for image processing

**Implementation Steps**:
1. Initialize npm project with `npm init`
2. Configure package.json with ESM settings
3. Set up TypeScript configuration (tsconfig.json)
4. Install core dependencies
5. Create source directory structure
6. Configure build scripts

**Acceptance Criteria**:
- [ ] package.json configured with type: "module"
- [ ] tsconfig.json targets ES2022 with strict mode
- [ ] Build script compiles TypeScript to dist/
- [ ] npm link works for local testing
- [ ] Source maps generated for debugging

---

### Task 1.2: Implement Core Utilities Module
**Description**: Build util.ts with shared helpers for JSON output, exec wrapper, and image processing  
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 1.1  
**Can run parallel with**: Task 1.3

**Technical Requirements**:
- Exec wrapper with timeout support (default 30s)
- JSON result formatter for consistent output
- WebP preview generation with Sharp
- Error code constants and mapping
- Path expansion for ~ handling

**Implementation from spec**:
```typescript
interface BaseResult {
  ok: boolean;
  cmd: string;
  ts: string;           // ISO 8601
  durationMs: number;
  warnings?: string[];
}

// Exit codes
const EXIT_CODES = {
  OK: 0,
  INVALID_INPUT: 10,
  TARGET_NOT_FOUND: 20,
  PERMISSION_DENIED: 30,
  NO_ACTIVE_WINDOW: 40,
  TIMEOUT: 50,
  DEPENDENCY_MISSING: 60,
  INTERNAL_ERROR: 90
};
```

**Acceptance Criteria**:
- [ ] Exec wrapper handles timeouts correctly
- [ ] JSON formatter produces valid structured output
- [ ] WebP preview generation stays under 1.5MB
- [ ] Error codes match specification
- [ ] Unit tests cover all utility functions

---

### Task 1.3: Create AppleScript Integration Module
**Description**: Build apple.ts for JavaScript execution in Chrome via osascript  
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 1.1  
**Can run parallel with**: Task 1.2

**Technical Requirements**:
- Execute JavaScript in Chrome tab context
- Get window bounds and metrics
- Handle AppleScript errors gracefully
- Escape strings properly for injection
- Support for System Events automation

**Core function from spec**:
```javascript
async function execChromeJS(js: string): Promise<any> {
  const script = `
    tell application "Google Chrome"
      execute front window's active tab javascript "${escapeForAppleScript(js)}"
    end tell
  `;
  return await execAppleScript(script);
}
```

**Acceptance Criteria**:
- [ ] JavaScript execution returns JSON-serializable results
- [ ] Special characters in selectors properly escaped
- [ ] Error handling for permission denials
- [ ] Window metrics retrieval works
- [ ] Tests verify AppleScript integration

---

### Task 1.4: Implement CLI Router with Commander
**Description**: Build cli.ts entry point with command routing and global flags  
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 1.1, Task 1.2  
**Can run parallel with**: Task 1.5

**Technical Requirements**:
- Commander.js command structure
- Global flags: --json, --timeout, --preview-max, --out
- Version and help commands
- Error handling and exit codes
- Subcommand routing pattern

**Implementation Steps**:
1. Set up commander program with version
2. Add global options handling
3. Create command groups (nav, shot, mouse, etc.)
4. Implement error middleware
5. Add shebang for npm global install

**Acceptance Criteria**:
- [ ] mac-chrome --help displays all commands
- [ ] Global flags apply to all subcommands
- [ ] Exit codes match specification
- [ ] JSON output to stdout, logs to stderr
- [ ] Binary works after npm link

---

### Task 1.5: Build Doctor Diagnostic Command
**Description**: Implement doctor command for system diagnostics and dependency checking  
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 1.2  
**Can run parallel with**: Task 1.4

**Technical Requirements**:
- Check chrome-cli installation
- Check cliclick installation
- Verify AppleScript execution permission
- Test screen recording permission
- Detect active Chrome window
- Return actionable JSON diagnostics

**Output format from spec**:
```json
{
  "ok": false,
  "cmd": "doctor",
  "checks": {
    "chrome-cli": false,
    "cliclick": true,
    "applescript": true,
    "screen-recording": false,
    "active-window": true
  },
  "code": "DEPENDENCY_MISSING",
  "error": "chrome-cli not found. Install with: brew install chrome-cli"
}
```

**Acceptance Criteria**:
- [ ] Detects all required dependencies
- [ ] Provides installation commands for missing tools
- [ ] Identifies permission issues with clear messages
- [ ] Returns structured JSON with --json flag
- [ ] Human-readable output without --json

## Phase 2: Core Browser Control Features

### Task 2.1: Implement Coordinate Calculation Module
**Description**: Build coords.ts for selector to screen coordinate mapping  
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 1.3  
**Can run parallel with**: None (critical for other features)

**Technical Requirements**:
- Viewport to screen coordinate conversion
- Handle window chrome offsets
- DPR (device pixel ratio) handling
- Element centering with scrollIntoView
- Points vs pixels distinction for cliclick

**Core algorithm from spec**:
```javascript
const getElementCoords = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return { err: "TARGET_NOT_FOUND" };
  
  el.scrollIntoView({ 
    block: "center", 
    inline: "center", 
    behavior: "instant" 
  });
  
  const rect = el.getBoundingClientRect();
  const offX = (window.outerWidth - window.innerWidth) / 2;
  const offY = window.outerHeight - window.innerHeight;
  
  const screenX = window.screenX + offX + (rect.left + rect.width / 2);
  const screenY = window.screenY + offY + (rect.top + rect.height / 2);
  
  return {
    x: Math.round(screenX),
    y: Math.round(screenY),
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
  };
};
```

**Acceptance Criteria**:
- [ ] Coordinates work on Retina displays
- [ ] Elements scroll into view before calculation
- [ ] Handle viewport vs window distinction
- [ ] Return error for non-existent selectors
- [ ] Unit tests verify coordinate math

---

### Task 2.2: Create UI Events Module with cliclick
**Description**: Build ui.ts for mouse and keyboard event simulation  
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 1.2, Task 2.1  
**Can run parallel with**: Task 2.3

**Technical Requirements**:
- Mouse click, double-click, right-click
- Mouse movement to coordinates
- Keyboard typing with configurable speed
- Key combinations (cmd+shift+r)
- Clipboard paste operations

**Implementation Steps**:
1. Wrap cliclick commands with exec
2. Handle coordinate format (c:x,y)
3. Implement key mapping for special keys
4. Add typing speed control (--per-char-ms)
5. Error handling for permission denials

**Acceptance Criteria**:
- [ ] Click events work at correct coordinates
- [ ] Keyboard typing supports special characters
- [ ] Key combinations execute correctly
- [ ] Permission errors return PERMISSION_DENIED
- [ ] Tests verify cliclick integration

---

### Task 2.3: Implement Navigation Commands
**Description**: Build navigation module for URL navigation and page control  
**Size**: Small  
**Priority**: High  
**Dependencies**: Task 1.3, Task 1.4  
**Can run parallel with**: Task 2.2

**Technical Requirements**:
- nav go --url command
- nav reload with --hard option
- nav back and nav forward
- Tab focus by title/URL match
- Return current URL and title in response

**Commands to implement**:
- `tab focus --match "<title|url>"`
- `nav go --url "<url>"`
- `nav reload [--hard]`
- `nav back`
- `nav forward`

**Acceptance Criteria**:
- [ ] URL navigation loads pages correctly
- [ ] Hard reload bypasses cache
- [ ] Tab focus finds correct tab
- [ ] Back/forward maintain history
- [ ] JSON output includes page metadata

---

### Task 2.4: Build Screenshot Capture Module
**Description**: Implement capture.ts for screenshot commands with WebP previews  
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 1.2, Task 2.1  
**Can run parallel with**: Task 2.5

**Technical Requirements**:
- Viewport screenshot (visible area)
- Window screenshot (full window)
- Element screenshot with selector
- WebP preview generation (max 1200px)
- Output path specification with --out

**Output format from spec**:
```json
{
  "ok": true,
  "cmd": "shot.viewport",
  "path": "/Users/you/Desktop/shot.png",
  "preview": {"mime":"image/webp","base64":"..."},
  "meta": {
    "url":"https://…",
    "title":"…",
    "window":{"x":128,"y":46,"w":1440,"h":900,"dpr":2},
    "ts":"2025-08-17T15:40:12Z",
    "durationMs":412
  }
}
```

**Acceptance Criteria**:
- [ ] Screenshots capture correct area
- [ ] WebP preview under 1.5MB
- [ ] Element screenshots handle scrolling
- [ ] Permission errors handled gracefully
- [ ] Tests verify image generation

---

### Task 2.5: Implement Mouse Interaction Commands
**Description**: Build mouse command module for click and movement operations  
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 2.1, Task 2.2  
**Can run parallel with**: Task 2.4

**Technical Requirements**:
- Click with button selection (left/right/middle)
- Double-click support
- Context menu (right-click)
- Mouse movement to element or coordinates
- Offset support for precise clicking

**Commands from spec**:
- `mouse click --selector "<css>" [--button left|right|middle] [--offset dx,dy]`
- `mouse dblclick --selector "<css>"`
- `mouse context --selector "<css>"`
- `mouse move --selector "<css>" | --xy X,Y`

**Acceptance Criteria**:
- [ ] Clicks trigger at correct element
- [ ] Offset calculation works correctly
- [ ] Context menus appear on right-click
- [ ] Movement animates cursor position
- [ ] Selector not found returns TARGET_NOT_FOUND

---

### Task 2.6: Create Input Field Handling Module
**Description**: Build input.ts for form field interaction with progressive strategies  
**Size**: Large  
**Priority**: High  
**Dependencies**: Task 2.2, Task 2.1  
**Can run parallel with**: Task 2.7

**Technical Requirements**:
- Progressive input strategies (paste → type → JS)
- Field clearing before input
- Value verification after input
- Secret masking in output
- Support for textarea and contenteditable

**Strategy implementation from spec**:
```typescript
async function setInput(selector: string, value: string): Promise<InputResult> {
  // Method 1: Paste (fastest, most reliable)
  try {
    await focusElement(selector);
    await clearField();
    await pasteText(value);
    if (await verifyValue(selector, value)) {
      return { method: "paste", success: true };
    }
  } catch {}
  
  // Method 2: Keystroke simulation
  try {
    await focusElement(selector);
    await clearField();
    await typeText(value, { perCharMs: 15 });
    if (await verifyValue(selector, value)) {
      return { method: "keystroke", success: true };
    }
  } catch {}
  
  // Method 3: JavaScript injection
  await injectJS(`...`);
  return { method: "js", success: true };
}
```

**Acceptance Criteria**:
- [ ] Paste method works for most fields
- [ ] Fallback to typing when paste fails
- [ ] JS injection as last resort
- [ ] Passwords masked in output (show ***)
- [ ] Tests cover all input strategies

---

### Task 2.7: Implement Keyboard Commands
**Description**: Build keyboard module for text typing and key combinations  
**Size**: Medium  
**Priority**: High  
**Dependencies**: Task 2.2  
**Can run parallel with**: Task 2.6

**Technical Requirements**:
- Type text with configurable speed
- Execute key combinations
- Support special keys (escape, tab, enter)
- Clear existing text option
- Per-character delay control

**Commands to implement**:
- `keyboard type --text "<string>" [--method paste|keystroke|js] [--clear]`
- `keyboard keys --combo "cmd+shift+r[,cmd+enter]"`

**Acceptance Criteria**:
- [ ] Text typing appears naturally
- [ ] Key combinations execute correctly
- [ ] Special keys handled properly
- [ ] Clear option removes existing text
- [ ] Typing speed is configurable

## Phase 3: Advanced Features

### Task 3.1: Build File Upload Module
**Description**: Implement files.ts for file upload via OS dialog automation  
**Size**: Large  
**Priority**: Medium  
**Dependencies**: Task 1.3, Task 2.2  
**Can run parallel with**: Task 3.2

**Technical Requirements**:
- Click file input to open dialog
- Drive macOS Open dialog with System Events
- Support multiple file selection
- Path expansion for ~ handling
- Synthetic drag-and-drop for dropzones

**AppleScript implementation from spec**:
```typescript
await executeAppleScript(`
  tell application "System Events"
    keystroke "g" using {command down, shift down}
    delay 0.2
    keystroke "${expandPath(filePath)}"
    delay 0.1
    key code 36  -- Return
    delay 0.2
    key code 36  -- Return
  end tell
`);
```

**Acceptance Criteria**:
- [ ] File dialog opens and navigates correctly
- [ ] Absolute paths work
- [ ] Tilde expansion works
- [ ] Multiple files can be selected
- [ ] Verification of file upload success

---

### Task 3.2: Create Page Snapshot Module
**Description**: Build snapshot.ts for page structure extraction  
**Size**: Large  
**Priority**: Medium  
**Dependencies**: Task 1.3  
**Can run parallel with**: Task 3.1

**Technical Requirements**:
- Outline mode: flat list of interactive elements
- DOM-lite mode: pruned hierarchy
- Visible-only filtering option
- Element role and name derivation
- Selector generation (id → data-testid → path)

**Output format from spec**:
```json
{
  "ok": true,
  "cmd": "snapshot.outline",
  "nodes": [
    {
      "role":"textbox",
      "name":"Email",
      "selector":"#email",
      "rect":{"x":240,"y":220,"w":320,"h":36},
      "state":{"editable":true,"disabled":false,"value":""}
    }
  ]
}
```

**Acceptance Criteria**:
- [ ] Captures 90%+ of interactive elements
- [ ] Generates reliable selectors
- [ ] Respects visibility filtering
- [ ] Handles dynamic content
- [ ] Tests verify structure extraction

---

### Task 3.3: Implement Network Monitoring Module
**Description**: Build netlog.ts for lightweight network activity tracking  
**Size**: Large  
**Priority**: Medium  
**Dependencies**: Task 1.3  
**Can run parallel with**: Task 3.4

**Technical Requirements**:
- Inject fetch/XHR/WebSocket hooks
- PerformanceObserver for resource timing
- Circular buffer for event storage
- Body preview truncation (2KB default)
- Start/stop/dump commands

**Hook injection approach**:
- Wrap native fetch function
- Override XMLHttpRequest methods
- Monitor WebSocket connections
- Use PerformanceObserver for timing

**Acceptance Criteria**:
- [ ] Captures fetch/XHR requests
- [ ] Includes timing information
- [ ] Body previews stay under limit
- [ ] Start/stop controls work
- [ ] Tests verify network capture

---

### Task 3.4: Add Scroll Commands
**Description**: Implement scrolling functionality for page navigation  
**Size**: Small  
**Priority**: Medium  
**Dependencies**: Task 1.3  
**Can run parallel with**: Task 3.3

**Technical Requirements**:
- Scroll to element (centers in viewport)
- Scroll by pixel amount
- Smooth vs instant scrolling
- Return scroll position in response

**Commands to implement**:
- `scroll to --selector "<css>"`
- `scroll by --px N`

**Acceptance Criteria**:
- [ ] Elements center in viewport
- [ ] Pixel scrolling is accurate
- [ ] Scroll position returned
- [ ] Handles overflow containers
- [ ] Tests verify scrolling behavior

---

### Task 3.5: Create DOM Evaluation Command
**Description**: Build dom eval command for arbitrary JavaScript execution  
**Size**: Small  
**Priority**: Low  
**Dependencies**: Task 1.3  
**Can run parallel with**: Task 3.6

**Technical Requirements**:
- Execute arbitrary JavaScript
- Return JSON-serializable results
- Size cap for large results
- Error handling for exceptions
- Security considerations

**Acceptance Criteria**:
- [ ] JavaScript executes in page context
- [ ] Results are JSON-serializable
- [ ] Large results are truncated
- [ ] Errors return gracefully
- [ ] Tests verify execution

---

### Task 3.6: Implement Wait Command
**Description**: Add wait idle command for delays between operations  
**Size**: Small  
**Priority**: Low  
**Dependencies**: Task 1.2  
**Can run parallel with**: Task 3.5

**Technical Requirements**:
- Configurable delay in milliseconds
- Default 800ms if not specified
- Return after delay completes
- Include timing in response

**Acceptance Criteria**:
- [ ] Delays for specified time
- [ ] Default works correctly
- [ ] JSON response includes duration
- [ ] Can be interrupted gracefully
- [ ] Tests verify timing

## Phase 4: Documentation & Polish

### Task 4.1: Create Comprehensive Documentation
**Description**: Write README, CLAUDE.md, API.md, and PERMISSIONS.md  
**Size**: Large  
**Priority**: High  
**Dependencies**: All Phase 1-3 tasks  
**Can run parallel with**: Task 4.2

**Documentation Requirements**:
- README.md: Installation, quick start, examples
- CLAUDE.md: Claude Code specific patterns
- API.md: Complete command reference
- PERMISSIONS.md: macOS setup guide

**Acceptance Criteria**:
- [ ] Installation instructions clear
- [ ] All commands documented
- [ ] Permission setup explained
- [ ] Claude Code usage patterns included
- [ ] Examples for common workflows

---

### Task 4.2: Write Comprehensive Test Suite
**Description**: Create unit, integration, and system tests  
**Size**: Large  
**Priority**: High  
**Dependencies**: All Phase 1-3 tasks  
**Can run parallel with**: Task 4.1

**Test Requirements from spec**:
- Unit tests for coordinate math
- Integration tests for commands
- System tests for permissions
- Edge case coverage
- Meaningful tests that can fail

**Test categories**:
1. Coordinate calculation tests
2. Command execution tests
3. Permission handling tests
4. Error scenario tests
5. Edge case tests

**Acceptance Criteria**:
- [ ] 80%+ code coverage
- [ ] Tests can reveal real failures
- [ ] Edge cases covered
- [ ] CI-ready test suite
- [ ] Test documentation included

---

### Task 4.3: Add Performance Optimizations
**Description**: Optimize performance based on benchmarks  
**Size**: Medium  
**Priority**: Medium  
**Dependencies**: All Phase 1-3 tasks  
**Can run parallel with**: Task 4.4

**Optimization targets from spec**:
- Click element: <500ms target
- Type 50 chars: <1000ms target
- Screenshot viewport: <600ms target
- Snapshot outline: <300ms target

**Areas to optimize**:
- AppleScript compilation caching
- WebP preview generation
- Batch operations in single script
- Memory usage for large snapshots

**Acceptance Criteria**:
- [ ] Meet performance targets
- [ ] Memory usage stays reasonable
- [ ] No performance regressions
- [ ] Benchmarks documented
- [ ] Tests verify performance

---

### Task 4.4: Prepare npm Package for Publishing
**Description**: Configure package for npm publication  
**Size**: Small  
**Priority**: Medium  
**Dependencies**: Task 4.1, Task 4.2  
**Can run parallel with**: Task 4.3

**Requirements**:
- Configure npm scripts
- Set up prepublish hooks
- Add .npmignore
- Configure GitHub Actions CI
- Create release process

**Acceptance Criteria**:
- [ ] npm publish works correctly
- [ ] Binary installed globally works
- [ ] CI runs tests on push
- [ ] Package size reasonable
- [ ] Version management setup

---

### Task 4.5: Implement Meta Command
**Description**: Add meta command for machine-readable capability schema  
**Size**: Small  
**Priority**: Low  
**Dependencies**: All command implementations  
**Can run parallel with**: None (requires all features)

**Technical Requirements**:
- List all available commands
- Include version information
- Document required permissions
- Return structured JSON schema
- Include platform requirements

**Acceptance Criteria**:
- [ ] Lists all commands accurately
- [ ] Version matches package.json
- [ ] Schema is valid JSON
- [ ] Permissions documented
- [ ] Tests verify completeness

## Execution Strategy

### Parallel Execution Opportunities

**Phase 1 Parallel Groups**:
- Group A: Task 1.2 (Utilities) + Task 1.3 (AppleScript)
- Group B: Task 1.4 (CLI Router) + Task 1.5 (Doctor)

**Phase 2 Parallel Groups**:
- Group A: Task 2.2 (UI Events) + Task 2.3 (Navigation)
- Group B: Task 2.4 (Screenshots) + Task 2.5 (Mouse)
- Group C: Task 2.6 (Input) + Task 2.7 (Keyboard)

**Phase 3 Parallel Groups**:
- Group A: Task 3.1 (Files) + Task 3.2 (Snapshot)
- Group B: Task 3.3 (Network) + Task 3.4 (Scroll)
- Group C: Task 3.5 (DOM Eval) + Task 3.6 (Wait)

### Critical Path

1. Task 1.1 → Task 1.2/1.3 → Task 2.1 → Phase 2 commands
2. Doctor command (1.5) can validate environment early
3. Core features (Phase 2) unlock testing
4. Advanced features (Phase 3) can be developed incrementally

### Risk Mitigation

**High Risk Areas**:
1. **Permission handling**: Implement doctor command early for validation
2. **AppleScript reliability**: Extensive error handling and retries
3. **Coordinate calculation**: Thorough testing on different displays
4. **File upload automation**: Alternative strategies if System Events fails

## Summary Statistics

- **Total Tasks**: 20
- **Phase 1 (Foundation)**: 5 tasks
- **Phase 2 (Core Features)**: 7 tasks
- **Phase 3 (Advanced)**: 6 tasks
- **Phase 4 (Polish)**: 5 tasks
- **High Priority**: 12 tasks
- **Medium Priority**: 7 tasks
- **Low Priority**: 3 tasks
- **Parallel Execution Groups**: 9

## Success Metrics

- ✅ All commands return valid JSON
- ✅ Performance targets met
- ✅ 80%+ test coverage
- ✅ Zero-configuration usage
- ✅ Claude Code integration works
- ✅ npm package publishable
- ✅ Comprehensive documentation