# Test Suite Documentation

This document describes the comprehensive test suite for the mac-chrome-cli project.

## Test Structure

The test suite is organized into three main categories:

### Unit Tests (`test/unit/`)
- **coords.test.ts**: Tests coordinate calculation functions
  - Coverage: viewport-to-screen conversion, CSS selector resolution, visibility checks
  - Edge cases: large coordinates, negative values, zero dimensions
  - Error handling: Chrome not found, element not found, invalid input

- **util.test.ts**: Tests utility functions
  - Coverage: command execution, JSON formatting, input validation, path expansion
  - Edge cases: timeout handling, malformed data, special characters
  - Error scenarios: command failures, invalid inputs

- **edge-cases.test.ts**: Comprehensive edge case testing
  - Boundary conditions and extreme values
  - Error propagation and recovery
  - Memory and performance scenarios
  - Special character handling

### Integration Tests (`test/integration/`)
- **commands.test.ts**: Tests command execution and interactions
  - Doctor command diagnostics
  - Snapshot capture functionality
  - Cross-command coordination
  - Real-world usage scenarios

### System Tests (`test/system/`)
- **permissions.test.ts**: Tests system-level permission handling
  - AppleScript automation permissions
  - Screen recording permissions  
  - Chrome access validation
  - Permission error recovery

## Test Configuration

### Jest Configuration (`jest.config.js`)
- ESM/TypeScript support with ts-jest
- Custom matchers for coordinates and rectangles
- Coverage thresholds: 80% for all metrics
- Optimized for CI/CD environments

### Test Utilities (`test/setup.ts`)
- Global test setup and teardown
- Custom Jest matchers:
  - `toBeValidCoordinates()`: Validates coordinate objects
  - `toBeValidRect()`: Validates rectangle objects
  - `toBeErrorCode()`: Validates error codes
- Mock utilities for creating test data

## Coverage Goals

The test suite aims for 80%+ coverage in:
- **Statements**: Line-by-line code execution
- **Branches**: Conditional logic paths
- **Functions**: Function call coverage
- **Lines**: Physical line coverage

### Current Coverage by Module
- **coords.ts**: 95.16% (excellent coverage)
- **doctor.ts**: 90.62% (excellent coverage)  
- **snapshot.ts**: 100% (complete coverage)
- **util.ts**: 79.72% (near target)
- **apple.ts**: 72% (good coverage)

## Running Tests

### Basic Commands
```bash
# Run all tests
yarn test

# Run with coverage
yarn test:coverage

# Run specific test categories
yarn test:unit
yarn test:integration
yarn test:system

# Debug mode
yarn test:debug

# CI mode
yarn test:ci
```

### Test Categories
```bash
# Unit tests only
yarn jest test/unit

# Integration tests only  
yarn jest test/integration

# System tests only
yarn jest test/system

# Watch mode for development
yarn test:watch
```

## Test Patterns and Best Practices

### Mocking Strategy
1. **External Dependencies**: Mock child_process, Apple APIs, file system
2. **System Commands**: Mock osascript, screencapture, cliclick
3. **Chrome Integration**: Mock AppleScript execution results
4. **Isolation**: Each test is independent with proper cleanup

### Error Testing
1. **Permission Denied**: Test AppleScript and screen recording failures
2. **Command Timeouts**: Test long-running operation handling
3. **Invalid Input**: Test boundary conditions and malformed data
4. **Network Issues**: Test Chrome connectivity problems

### Async Testing
1. **Promise Resolution**: Use async/await patterns
2. **Error Propagation**: Test both success and failure paths
3. **Timeout Handling**: Test command timeout scenarios
4. **Concurrent Operations**: Test parallel execution safety

## Test Data and Fixtures

### Mock Objects
- **Viewport**: Standard 1920x1080 viewport with scroll offsets
- **Window Bounds**: Chrome window positioning and dimensions
- **Elements**: Various button, input, and interactive elements
- **Commands**: Simulated shell command outputs

### Error Scenarios
- Chrome not running
- Permission denied errors
- Invalid selectors
- Network timeouts
- Malformed responses

## Continuous Integration

### CI Configuration
- Tests run in Node.js 18+ environment
- Coverage reports generated in multiple formats
- Fail-fast on coverage threshold violations
- No real system permissions required (all mocked)

### Performance Considerations
- Tests complete in under 30 seconds
- Parallel execution with 50% CPU utilization
- Memory usage optimized with proper cleanup
- Cache enabled for faster subsequent runs

## Debugging and Troubleshooting

### Common Issues
1. **Module Resolution**: Ensure ESM imports use .js extensions
2. **Mock Configuration**: Verify mocks are properly scoped
3. **Async Handling**: Use proper async/await patterns
4. **Timeout Issues**: Increase timeout for slow operations

### Debug Tools
```bash
# Run with open handle detection
yarn jest --detectOpenHandles

# Verbose output
yarn test:verbose

# Clear cache if needed
yarn test:clear-cache

# Debug specific test
yarn test:debug test/unit/coords.test.ts
```

## Future Enhancements

### Planned Improvements
1. **Visual Regression**: Screenshot comparison tests
2. **E2E Testing**: Real Chrome browser automation
3. **Performance Benchmarks**: Speed and memory profiling  
4. **Cross-Platform**: Windows and Linux compatibility tests

### Maintenance
- Regular dependency updates
- Coverage threshold reviews
- Test performance optimization
- Documentation updates

This test suite provides comprehensive validation of the mac-chrome-cli functionality while maintaining fast execution and reliable CI/CD integration.