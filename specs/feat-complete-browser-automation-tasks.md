# Complete Browser Automation - Task Decomposition

## Overview

This document decomposes the browser automation specification into 52 actionable STM (Simple Task Master) tasks. Each task is designed to be completed in 1-2 hours with clear validation criteria and dependencies.

## Task Organization

**Priority Levels:**
- **Critical**: Essential for basic automation workflows
- **High**: Important for comprehensive automation
- **Medium**: Nice-to-have and advanced features

**Complexity Levels:**
- **Simple**: Straightforward implementation (< 1 hour)
- **Medium**: Moderate complexity (1-2 hours)  
- **Complex**: Advanced implementation (2+ hours, may need decomposition)

## Phase 1: Core Navigation (Priority: Critical)

### NAV-001: Create Navigation Command Base Structure
**Priority:** Critical | **Complexity:** Simple | **Dependencies:** None

**Description:** Create the foundation for navigation commands with proper type definitions and base class structure.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/navigation.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/navigation.ts`

**Implementation Details:**
- Define `NavigationOptions` and `NavigationData` interfaces
- Create `NavigationCommand` class extending `BrowserCommandBase`
- Implement stub methods for go, reload, back, forward
- Add proper TypeScript types and JSDoc comments

**Validation Criteria:**
- [ ] Files compile without errors
- [ ] All navigation methods have proper type signatures
- [ ] Class follows existing command patterns
- [ ] JSDoc documentation is complete

### NAV-002: Implement URL Validation and Normalization
**Priority:** Critical | **Complexity:** Medium | **Dependencies:** NAV-001

**Description:** Add robust URL validation and normalization logic to handle various URL formats.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/navigation.ts`

**Implementation Details:**
- Support protocol-less URLs (add https:// prefix)
- Validate URL format using built-in URL constructor
- Handle special protocols (file://, data:, chrome://)
- Add comprehensive error handling for malformed URLs

**Validation Criteria:**
- [ ] Handles protocol-less URLs correctly
- [ ] Rejects invalid URL formats with clear errors
- [ ] Supports special protocol schemes
- [ ] Unit tests cover all validation scenarios

### NAV-003: Implement Navigation Go Command
**Priority:** Critical | **Complexity:** Medium | **Dependencies:** NAV-002

**Description:** Implement the core navigation functionality using AppleScript service.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/navigation.ts`

**Implementation Details:**
- Use AppleScriptService to navigate to URLs
- Implement JavaScript execution for navigation
- Add window index targeting support
- Include loading state detection

**Validation Criteria:**
- [ ] Successfully navigates to valid URLs
- [ ] Handles window targeting correctly
- [ ] Returns proper NavigationData structure
- [ ] Integrates with existing Result<T,E> pattern

### NAV-004: Implement Navigation Reload Command
**Priority:** Critical | **Complexity:** Simple | **Dependencies:** NAV-003

**Description:** Add page reload functionality with normal and hard refresh options.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/navigation.ts`

**Implementation Details:**
- Implement normal page reload via JavaScript
- Add hard refresh option (bypass cache)
- Include proper error handling and timeouts

**Validation Criteria:**
- [ ] Normal reload works correctly
- [ ] Hard refresh bypasses cache
- [ ] Returns consistent NavigationData
- [ ] Handles reload failures gracefully

### NAV-005: Implement Navigation Back/Forward Commands
**Priority:** Critical | **Complexity:** Simple | **Dependencies:** NAV-003

**Description:** Add browser history navigation capabilities.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/navigation.ts`

**Implementation Details:**
- Use browser history.back() and history.forward()
- Check canGoBack/canGoForward state
- Handle navigation boundary conditions

**Validation Criteria:**
- [ ] Back navigation works when history available
- [ ] Forward navigation works when history available
- [ ] Properly detects navigation boundaries
- [ ] Returns appropriate error when no history

### NAV-006: Add Navigation CLI Integration
**Priority:** Critical | **Complexity:** Medium | **Dependencies:** NAV-005

**Description:** Wire navigation commands into the CLI interface with proper option handling.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Replace existing navigation stubs with functional implementations
- Add proper command-line options and validation
- Integrate with OutputFormatter for consistent results
- Add timeout and window targeting options

**Validation Criteria:**
- [ ] All navigation commands available via CLI
- [ ] Options are properly parsed and validated
- [ ] Error messages are user-friendly
- [ ] JSON output format is consistent

### NAV-007: Add Navigation Wait-for-Load Integration
**Priority:** High | **Complexity:** Medium | **Dependencies:** NAV-006

**Description:** Integrate with existing wait functionality for automatic page load completion.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/navigation.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/wait.ts`

**Implementation Details:**
- Add optional waitForLoad parameter to navigation
- Use existing wait functionality for load completion
- Implement configurable timeout handling
- Add network idle detection integration

**Validation Criteria:**
- [ ] Navigation can wait for page load completion
- [ ] Timeout handling works correctly
- [ ] Integrates with existing wait commands
- [ ] Provides clear feedback on wait status

### NAV-008: Create Navigation Unit Tests
**Priority:** High | **Complexity:** Medium | **Dependencies:** NAV-007

**Description:** Comprehensive unit tests for all navigation functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/commands/navigation.test.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/lib/navigation.test.ts`

**Implementation Details:**
- Test URL validation and normalization
- Mock AppleScript service interactions
- Test error handling and recovery scenarios
- Cover all navigation methods and options

**Validation Criteria:**
- [ ] All navigation methods have unit tests
- [ ] Error scenarios are thoroughly tested
- [ ] Mocking is properly implemented
- [ ] Test coverage is >90%

## Phase 2: Screenshot Capture (Priority: High)

### SHOT-001: Create Screenshot Command Base Structure
**Priority:** High | **Complexity:** Simple | **Dependencies:** None

**Description:** Establish foundation for screenshot commands with proper types and interfaces.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/screenshot.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/capture.ts`

**Implementation Details:**
- Define `ScreenshotOptions` and `ScreenshotData` interfaces
- Create `ScreenshotCommand` class extending `BrowserCommandBase`
- Add stub methods for viewport, window, element capture
- Include proper TypeScript definitions

**Validation Criteria:**
- [ ] Files compile without TypeScript errors
- [ ] All screenshot methods have proper signatures
- [ ] Follows existing command structure patterns
- [ ] Documentation is complete

### SHOT-002: Implement Viewport Screenshot Capture
**Priority:** High | **Complexity:** Medium | **Dependencies:** SHOT-001

**Description:** Core viewport screenshot functionality using macOS screencapture.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/capture.ts`

**Implementation Details:**
- Use macOS screencapture command for viewport capture
- Implement coordinate calculation for browser viewport
- Add support for PNG, JPG, PDF formats
- Include automatic file path generation

**Validation Criteria:**
- [ ] Captures viewport screenshots successfully
- [ ] Supports multiple image formats
- [ ] Auto-generates file paths when not specified
- [ ] Handles screen recording permission errors

### SHOT-003: Add Screenshot Output Path Management
**Priority:** High | **Complexity:** Medium | **Dependencies:** SHOT-002

**Description:** Robust file path handling and validation for screenshot outputs.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/capture.ts`

**Implementation Details:**
- Implement secure path validation
- Add automatic filename generation with timestamps
- Create directory structure if needed
- Handle file permission errors

**Validation Criteria:**
- [ ] Validates output paths securely
- [ ] Creates directories as needed
- [ ] Generates unique filenames automatically
- [ ] Handles permission errors gracefully

### SHOT-004: Implement Window Screenshot Capture
**Priority:** High | **Complexity:** Medium | **Dependencies:** SHOT-003

**Description:** Full window screenshot functionality including browser chrome.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/capture.ts`

**Implementation Details:**
- Capture entire browser window including chrome
- Use window coordinate calculation
- Handle multiple window scenarios
- Add window index targeting

**Validation Criteria:**
- [ ] Captures full browser window correctly
- [ ] Handles multiple windows properly
- [ ] Window targeting works accurately
- [ ] Coordinates are calculated correctly

### SHOT-005: Implement Element Screenshot Capture
**Priority:** High | **Complexity:** Complex | **Dependencies:** SHOT-004

**Description:** Element-specific screenshot with coordinate calculation and visibility validation.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/capture.ts`

**Implementation Details:**
- Integrate with existing coordinate calculation system
- Validate element visibility before capture
- Handle element scrolling into view
- Crop screenshot to element bounds

**Validation Criteria:**
- [ ] Captures individual elements accurately
- [ ] Validates element visibility first
- [ ] Handles scrolling when needed
- [ ] Crops to exact element boundaries

### SHOT-006: Add WebP Preview Integration
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** SHOT-005

**Description:** Enhance screenshots with WebP preview generation for efficient transfer.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/capture.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/src/lib/util.ts` (enhance existing)

**Implementation Details:**
- Integrate with existing `createWebPPreview` function
- Add configurable preview size limits
- Include base64 encoding for JSON output
- Optimize preview generation performance

**Validation Criteria:**
- [ ] Generates WebP previews efficiently
- [ ] Respects size limits configuration
- [ ] Includes previews in JSON output
- [ ] Performance is acceptable (<2s)

### SHOT-007: Add Screenshot CLI Integration
**Priority:** High | **Complexity:** Medium | **Dependencies:** SHOT-006

**Description:** Wire screenshot commands into CLI with comprehensive option handling.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Replace screenshot stubs with functional commands
- Add format, output, preview options
- Implement element selector support
- Add window targeting options

**Validation Criteria:**
- [ ] All screenshot commands available via CLI
- [ ] Options are properly validated
- [ ] Element selector integration works
- [ ] Output formatting is consistent

### SHOT-008: Create Screenshot Unit Tests
**Priority:** High | **Complexity:** Medium | **Dependencies:** SHOT-007

**Description:** Comprehensive testing for all screenshot functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/commands/screenshot.test.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/lib/capture.test.ts`

**Implementation Details:**
- Mock screencapture command execution
- Test file path generation and validation
- Cover error handling scenarios
- Test preview generation

**Validation Criteria:**
- [ ] All screenshot methods tested
- [ ] File operations are mocked properly
- [ ] Error scenarios covered
- [ ] Test coverage >85%

## Phase 3: Mouse Interactions (Priority: High)

### MOUSE-001: Create Mouse Command Structure
**Priority:** High | **Complexity:** Simple | **Dependencies:** None

**Description:** Establish mouse command foundation leveraging existing mouse library.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/mouse.ts`

**Implementation Details:**
- Define `MouseClickOptions` and `MouseActionData` interfaces
- Create `MouseCommand` class extending `BrowserCommandBase`
- Import existing mouse functions from `/src/lib/mouse.ts`
- Add proper validation methods

**Validation Criteria:**
- [ ] MouseCommand class created successfully
- [ ] Integrates with existing mouse library
- [ ] Type definitions are complete
- [ ] Follows command pattern conventions

### MOUSE-002: Implement Mouse Click Command
**Priority:** High | **Complexity:** Medium | **Dependencies:** MOUSE-001

**Description:** CLI integration for mouse clicking with selector and coordinate support.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/mouse.ts`

**Implementation Details:**
- Implement click method using existing `mouseClick` function
- Add input validation for selectors and coordinates
- Support mouse button selection (left, right, middle)
- Include element offset handling

**Validation Criteria:**
- [ ] Clicks work with CSS selectors
- [ ] Clicks work with absolute coordinates
- [ ] All mouse buttons supported
- [ ] Element offsets calculated correctly

### MOUSE-003: Add Mouse Move Command Implementation  
**Priority:** High | **Complexity:** Medium | **Dependencies:** MOUSE-002

**Description:** Implement mouse movement functionality for hover effects and positioning.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/mouse.ts`

**Implementation Details:**
- Use existing `mouseMove` function from mouse library
- Add smooth movement option support
- Implement relative and absolute positioning
- Include hover duration options

**Validation Criteria:**
- [ ] Mouse moves to correct positions
- [ ] Smooth movement works when enabled
- [ ] Relative positioning calculated correctly
- [ ] Hover effects are triggered properly

### MOUSE-004: Add Element Visibility Validation
**Priority:** High | **Complexity:** Medium | **Dependencies:** MOUSE-003

**Description:** Enhance mouse commands with element visibility checking before interaction.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/mouse.ts`

**Implementation Details:**
- Integrate with existing `validateElementVisibility` function
- Check element existence before mouse operations
- Validate clickable state (not disabled/hidden)
- Scroll element into view if needed

**Validation Criteria:**
- [ ] Elements validated before interaction
- [ ] Disabled elements properly rejected
- [ ] Hidden elements scrolled into view
- [ ] Clear error messages for invalid targets

### MOUSE-005: Add Mouse CLI Integration
**Priority:** High | **Complexity:** Medium | **Dependencies:** MOUSE-004

**Description:** Complete CLI integration for all mouse commands with option parsing.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Replace mouse command stubs with functional implementations
- Add selector, coordinate, and offset options
- Implement button selection options
- Add window targeting support

**Validation Criteria:**
- [ ] mouse click command fully functional
- [ ] mouse move command available
- [ ] All options properly parsed
- [ ] Error handling consistent with other commands

### MOUSE-006: Create Mouse Unit Tests
**Priority:** High | **Complexity:** Medium | **Dependencies:** MOUSE-005

**Description:** Comprehensive testing for mouse command functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/commands/mouse.test.ts`

**Implementation Details:**
- Mock cliclick command execution
- Test coordinate calculation accuracy
- Cover element validation scenarios
- Test error handling and recovery

**Validation Criteria:**
- [ ] All mouse methods have unit tests
- [ ] Coordinate calculations tested
- [ ] Element validation covered
- [ ] Error scenarios thoroughly tested

## Phase 4: Keyboard Input (Priority: High)

### KEY-001: Create Keyboard Command Structure
**Priority:** High | **Complexity:** Simple | **Dependencies:** None

**Description:** Foundation for keyboard input commands leveraging existing UI library.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/keyboard.ts`

**Implementation Details:**
- Define `KeyboardOptions` and `KeyboardActionData` interfaces
- Create `KeyboardCommand` class extending `BrowserCommandBase`
- Import existing functions from `/src/lib/ui.ts`
- Add key combination parsing utilities

**Validation Criteria:**
- [ ] KeyboardCommand class structure complete
- [ ] Integrates with existing UI functions
- [ ] Key combination parsing implemented
- [ ] Type definitions comprehensive

### KEY-002: Implement Keyboard Type Command
**Priority:** High | **Complexity:** Medium | **Dependencies:** KEY-001

**Description:** Text typing functionality with speed and modifier support.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/keyboard.ts`

**Implementation Details:**
- Use existing `typeText` function from ui library
- Add typing speed configuration
- Include Unicode text support
- Implement input sanitization

**Validation Criteria:**
- [ ] Types text accurately
- [ ] Speed configuration works
- [ ] Unicode characters supported
- [ ] Input properly sanitized

### KEY-003: Implement Keyboard Keys Command
**Priority:** High | **Complexity:** Medium | **Dependencies:** KEY-002

**Description:** Key combination and special key functionality.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/keyboard.ts`

**Implementation Details:**
- Use existing `sendKeys` function
- Support modifier keys (cmd, shift, alt, ctrl)
- Handle special keys (arrows, function keys)
- Add key combination validation

**Validation Criteria:**
- [ ] Modifier keys work correctly
- [ ] Special keys are supported
- [ ] Key combinations validated
- [ ] Cross-platform compatibility considered

### KEY-004: Add Keyboard CLI Integration
**Priority:** High | **Complexity:** Medium | **Dependencies:** KEY-003

**Description:** CLI integration for keyboard commands with comprehensive options.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Replace keyboard stubs with functional commands
- Add text and key combination options
- Implement speed and modifier settings
- Include proper option validation

**Validation Criteria:**
- [ ] keyboard type command functional
- [ ] keyboard keys command available
- [ ] All options properly implemented
- [ ] Validation prevents invalid inputs

### KEY-005: Create Keyboard Unit Tests
**Priority:** High | **Complexity:** Medium | **Dependencies:** KEY-004

**Description:** Testing suite for keyboard functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/commands/keyboard.test.ts`

**Implementation Details:**
- Mock cliclick execution for key operations
- Test text input with various characters
- Cover key combination scenarios
- Test error handling

**Validation Criteria:**
- [ ] Text typing thoroughly tested
- [ ] Key combinations covered
- [ ] Unicode input validated
- [ ] Error scenarios handled

## Phase 5: Form Input Operations (Priority: Medium)

### INPUT-001: Create Input Command Structure
**Priority:** Medium | **Complexity:** Simple | **Dependencies:** MOUSE-005, KEY-004

**Description:** High-level form input operations combining mouse and keyboard functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/input.ts`

**Implementation Details:**
- Define `InputOptions` and `InputActionData` interfaces
- Create `InputCommand` class extending `BrowserCommandBase`
- Combine mouse click for focus and keyboard for typing
- Add form element validation

**Validation Criteria:**
- [ ] InputCommand structure established
- [ ] Integrates mouse and keyboard operations
- [ ] Form element validation included
- [ ] Type definitions complete

### INPUT-002: Implement Input Fill Functionality
**Priority:** Medium | **Complexity:** Complex | **Dependencies:** INPUT-001

**Description:** Complete form field filling with focus, clear, and type operations.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/input.ts`

**Implementation Details:**
- Click element to focus input field
- Clear existing content if requested
- Type new value with configurable speed
- Validate input element types (input, textarea, contentEditable)

**Validation Criteria:**
- [ ] Focuses input fields correctly
- [ ] Clears existing content when requested
- [ ] Types new values accurately
- [ ] Validates appropriate input elements

### INPUT-003: Add Input Element Validation
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** INPUT-002

**Description:** Comprehensive validation for form input elements before interaction.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/input.ts`

**Implementation Details:**
- JavaScript-based element type validation
- Check for input, textarea, contentEditable elements
- Validate element is not disabled or readonly
- Provide clear error messages for invalid targets

**Validation Criteria:**
- [ ] Correctly identifies valid input elements
- [ ] Rejects disabled/readonly elements
- [ ] Clear error messages provided
- [ ] JavaScript validation secure

### INPUT-004: Add Input CLI Integration
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** INPUT-003

**Description:** CLI integration for form input operations.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Replace input command stubs with functionality
- Add selector and value options
- Implement clear/no-clear options
- Add speed configuration

**Validation Criteria:**
- [ ] input fill command functional
- [ ] All options properly handled
- [ ] Clear/no-clear options work
- [ ] Speed configuration effective

### INPUT-005: Create Input Unit Tests
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** INPUT-004

**Description:** Test suite for form input functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/commands/input.test.ts`

**Implementation Details:**
- Mock mouse click and keyboard type operations
- Test element validation scenarios
- Cover clear and no-clear operations
- Test various input element types

**Validation Criteria:**
- [ ] Form filling operations tested
- [ ] Element validation covered
- [ ] Clear operations validated
- [ ] Different input types handled

## Phase 6: Tab Management (Priority: Medium)

### TAB-001: Create Tab Command Structure  
**Priority:** Medium | **Complexity:** Simple | **Dependencies:** None

**Description:** Foundation for tab management operations.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/tab.ts`

**Implementation Details:**
- Define `TabOptions` and `TabActionData` interfaces
- Create `TabCommand` class extending `BrowserCommandBase`
- Import existing navigation functions
- Add pattern matching utilities

**Validation Criteria:**
- [ ] TabCommand structure complete
- [ ] Pattern matching utilities added
- [ ] Integrates with navigation library
- [ ] Type definitions comprehensive

### TAB-002: Implement Tab Focus Functionality
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** TAB-001

**Description:** Tab focusing based on title/URL pattern matching.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/tab.ts`

**Implementation Details:**
- Use existing `focusTabByPattern` function
- Support both exact and substring matching
- Handle multiple window scenarios
- Provide feedback on match results

**Validation Criteria:**
- [ ] Focuses tabs by title pattern
- [ ] Focuses tabs by URL pattern
- [ ] Exact and substring matching work
- [ ] Multiple windows handled correctly

### TAB-003: Add Tab CLI Integration
**Priority:** Medium | **Complexity:** Simple | **Dependencies:** TAB-002

**Description:** CLI integration for tab management commands.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Replace tab command stubs with functionality
- Add pattern matching options
- Implement exact match flags
- Add window targeting support

**Validation Criteria:**
- [ ] tab focus command functional
- [ ] Pattern matching options work
- [ ] Exact match flag effective
- [ ] Window targeting available

### TAB-004: Create Tab Unit Tests
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** TAB-003

**Description:** Testing for tab management functionality.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/unit/commands/tab.test.ts`

**Implementation Details:**
- Mock AppleScript tab operations
- Test pattern matching accuracy
- Cover exact vs substring matching
- Test window targeting

**Validation Criteria:**
- [ ] Tab focusing operations tested
- [ ] Pattern matching validated
- [ ] Match types covered
- [ ] Window scenarios handled

## Integration and Testing Tasks

### INT-001: Update Command Registry Integration
**Priority:** Critical | **Complexity:** Medium | **Dependencies:** NAV-006, SHOT-007, MOUSE-005, KEY-004, INPUT-004, TAB-003

**Description:** Complete integration of all new commands into the command registry.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/cli/CommandRegistry.ts`

**Implementation Details:**
- Register all new command modules
- Update command initialization
- Ensure proper error handling integration
- Add comprehensive help text

**Validation Criteria:**
- [ ] All commands properly registered
- [ ] Help text is comprehensive
- [ ] Error handling consistent
- [ ] No command conflicts exist

### INT-002: Update Doctor Command for New Features
**Priority:** High | **Complexity:** Medium | **Dependencies:** INT-001

**Description:** Enhance doctor command to check permissions for new automation features.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/src/commands/doctor.ts`

**Implementation Details:**
- Add screen recording permission check
- Add accessibility permission validation
- Check cliclick availability
- Add browser automation readiness check

**Validation Criteria:**
- [ ] Screen recording permission detected
- [ ] Accessibility permission validated
- [ ] cliclick installation checked
- [ ] Comprehensive readiness report

### INT-003: Create Integration Test Suite
**Priority:** High | **Complexity:** Complex | **Dependencies:** INT-002

**Description:** End-to-end integration tests for complete browser automation workflows.

**Files to Create:**
- `/Users/carl/Development/agents/mac-chrome-cli/test/integration/browser-automation.test.ts`
- `/Users/carl/Development/agents/mac-chrome-cli/test/fixtures/test-page.html`

**Implementation Details:**
- Set up test Chrome instance
- Create test page with various elements
- Test complete automation workflows
- Validate screenshot and interaction results

**Validation Criteria:**
- [ ] Test environment setup functional
- [ ] Complete workflows tested
- [ ] Screenshots validated
- [ ] Form interactions verified

### INT-004: Performance Optimization Pass
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** INT-003

**Description:** Optimize performance for batch operations and connection reuse.

**Files to Modify:**
- Multiple command files for optimization

**Implementation Details:**
- Profile command execution times
- Optimize AppleScript connection reuse
- Implement operation batching where possible
- Add performance metrics logging

**Validation Criteria:**
- [ ] Performance metrics established
- [ ] Connection reuse optimized
- [ ] Batch operations implemented
- [ ] Response times within targets

### INT-005: Documentation Updates
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** INT-004

**Description:** Update API documentation and examples for all new features.

**Files to Modify:**
- `/Users/carl/Development/agents/mac-chrome-cli/API.md`
- `/Users/carl/Development/agents/mac-chrome-cli/CLAUDE.md`

**Implementation Details:**
- Document all new command options
- Add comprehensive usage examples
- Update integration patterns
- Include troubleshooting guides

**Validation Criteria:**
- [ ] All commands documented
- [ ] Examples are functional
- [ ] Integration patterns updated
- [ ] Troubleshooting complete

## Error Handling and Recovery Tasks

### ERR-001: Standardize Error Recovery Hints
**Priority:** High | **Complexity:** Medium | **Dependencies:** INT-001

**Description:** Ensure all new commands provide consistent recovery hints in error scenarios.

**Files to Modify:**
- All command files created in previous tasks

**Implementation Details:**
- Implement `RecoveryHint` enum usage
- Add context-specific recovery suggestions
- Standardize error message formats
- Include troubleshooting steps

**Validation Criteria:**
- [ ] All commands provide recovery hints
- [ ] Error messages are consistent
- [ ] Troubleshooting steps included
- [ ] Recovery strategies tested

### ERR-002: Permission Error Handling
**Priority:** High | **Complexity:** Medium | **Dependencies:** ERR-001

**Description:** Comprehensive permission error detection and user guidance.

**Files to Modify:**
- All command files that require system permissions

**Implementation Details:**
- Detect permission denied errors
- Provide specific permission remediation steps
- Link to system settings when appropriate
- Test permission error scenarios

**Validation Criteria:**
- [ ] Permission errors detected accurately
- [ ] Remediation steps are clear
- [ ] System settings guidance included
- [ ] Error scenarios tested

### ERR-003: Network and Timeout Error Handling
**Priority:** Medium | **Complexity:** Medium | **Dependencies:** ERR-002

**Description:** Robust handling of network timeouts and connectivity issues.

**Files to Modify:**
- Navigation and screenshot command files

**Implementation Details:**
- Implement retry strategies with backoff
- Detect network connectivity issues
- Provide timeout configuration options
- Handle partial operation failures

**Validation Criteria:**
- [ ] Retry strategies implemented
- [ ] Network issues detected
- [ ] Timeout configuration available
- [ ] Partial failures handled gracefully

## Task Dependencies Summary

**Critical Path:**
NAV-001 → NAV-002 → NAV-003 → NAV-006 → INT-001

**Major Dependency Chains:**
1. Navigation: NAV-001 through NAV-008
2. Screenshots: SHOT-001 through SHOT-008  
3. Mouse: MOUSE-001 through MOUSE-006
4. Keyboard: KEY-001 through KEY-005
5. Input: INPUT-001 through INPUT-005 (depends on Mouse and Keyboard)
6. Tab: TAB-001 through TAB-004
7. Integration: INT-001 through INT-005 (depends on all features)
8. Error Handling: ERR-001 through ERR-003 (runs parallel with implementation)

## Estimated Timeline

**Week 1:** Navigation foundation and core functionality (NAV-001 through NAV-008)
**Week 2:** Screenshots and Mouse interactions (SHOT-001 through MOUSE-006)  
**Week 3:** Keyboard, Input, and Tab management (KEY-001 through TAB-004)
**Week 4:** Integration, testing, and error handling (INT-001 through ERR-003)

**Total:** 52 tasks, estimated 4 weeks with single developer
**Parallelization:** Some tasks can be done in parallel with multiple developers

## Success Criteria

- [ ] All 52% missing functionality implemented
- [ ] 100% of advertised commands functional
- [ ] Comprehensive error handling with recovery hints
- [ ] >90% test coverage for new functionality
- [ ] Performance within established benchmarks
- [ ] Complete documentation and examples
- [ ] Integration with existing architecture patterns