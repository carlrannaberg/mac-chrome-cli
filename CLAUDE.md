# Claude Code Integration Guide

This guide covers best practices for integrating `mac-chrome-cli` with Claude Code for AI-powered browser automation workflows.

## Overview

Claude Code can use `mac-chrome-cli` to perform sophisticated browser automation tasks by combining visual understanding, strategic planning, and precise command execution. This enables powerful workflows like:

- Visual web testing and QA automation
- Dynamic form filling based on page content
- Multi-step user journey automation
- Content extraction and analysis
- Cross-browser compatibility testing

## Core Integration Patterns

### 1. Visual-First Automation

Use screenshots to guide automation decisions:

```bash
# Capture current state
mac-chrome-cli shot viewport --out current-state.png --json

# Let Claude analyze the screenshot and plan next steps
# Claude can identify interactive elements and determine actions

# Execute planned actions
mac-chrome-cli mouse click --selector "button.submit"
```

### 2. Adaptive Form Filling

Combine page structure analysis with intelligent form completion:

```bash
# Capture page structure
mac-chrome-cli snapshot outline --visible-only --json > page-structure.json

# Use Claude to analyze form fields and determine appropriate values
# Then fill forms dynamically

mac-chrome-cli input fill --selector "#email" --value "user@example.com"
mac-chrome-cli input fill --selector "#password" --value "securepassword"
mac-chrome-cli mouse click --selector "button[type=submit]"
```

### 3. Network-Aware Automation

Monitor network activity to guide automation flow:

```bash
# Start network monitoring
mac-chrome-cli netlog start --max-events 1000

# Perform actions
mac-chrome-cli nav go --url "https://app.example.com"
mac-chrome-cli mouse click --selector ".load-data-btn"

# Analyze network traffic to determine when loading is complete
mac-chrome-cli netlog dump --format json | jq '.events[] | select(.type=="response")'
```

## Recommended Workflows

### Web Testing Automation

```bash
#!/bin/bash
# Automated testing workflow with Claude guidance

# 1. Capture initial state
mac-chrome-cli shot viewport --out test-start.png --json

# 2. Navigate to test page
mac-chrome-cli nav go --url "$TEST_URL"

# 3. Capture page structure for analysis
mac-chrome-cli snapshot outline --visible-only --json > test-structure.json

# 4. Perform test actions (guided by Claude's analysis)
mac-chrome-cli mouse click --selector ".test-button"
mac-chrome-cli scroll to --selector "#results"

# 5. Capture final state for comparison
mac-chrome-cli shot viewport --out test-end.png --json

# 6. Extract results for validation
mac-chrome-cli snapshot dom-lite --max-depth 5 --json > test-results.json
```

### Data Extraction Pipeline

```bash
#!/bin/bash
# Extract data from dynamic web applications

# 1. Start with fresh session
mac-chrome-cli nav go --url "$TARGET_URL"

# 2. Wait for page load and capture structure
sleep 2
mac-chrome-cli snapshot outline --visible-only --json > page-elements.json

# 3. Navigate through pagination or sections
for page in {1..10}; do
  # Extract current page data
  mac-chrome-cli snapshot dom-lite --json > "data-page-$page.json"
  
  # Find and click next button (Claude can help identify pagination)
  mac-chrome-cli mouse click --selector ".pagination .next"
  
  # Wait for new content
  sleep 2
done
```

### Form Automation with Validation

```bash
#!/bin/bash
# Intelligent form filling with error handling

# 1. Capture initial form state
mac-chrome-cli snapshot outline --json > form-initial.json

# 2. Fill form fields (Claude determines optimal values)
mac-chrome-cli input fill --selector "#name" --value "John Doe"
mac-chrome-cli input fill --selector "#email" --value "john@example.com"

# 3. Upload files if needed
mac-chrome-cli files upload --selector "input[type=file]" --path "/path/to/document.pdf"

# 4. Submit and capture response
mac-chrome-cli mouse click --selector "button[type=submit]"
sleep 2

# 5. Check for errors or success
mac-chrome-cli snapshot outline --json > form-result.json
mac-chrome-cli shot viewport --out form-submission.png
```

## Best Practices

### Error Handling and Resilience

1. **Always use JSON output** for programmatic processing:
```bash
result=$(mac-chrome-cli command --json)
if echo "$result" | jq -e '.success' > /dev/null; then
  # Success path
  echo "Command succeeded"
else
  # Error handling
  error=$(echo "$result" | jq -r '.error')
  echo "Command failed: $error"
fi
```

2. **Implement timeouts and retries**:
```bash
for attempt in {1..3}; do
  if mac-chrome-cli mouse click --selector ".retry-btn" --timeout 10000 --json | jq -e '.success'; then
    break
  fi
  echo "Attempt $attempt failed, retrying..."
  sleep 2
done
```

3. **Validate element presence before interaction**:
```bash
# Check if element exists before clicking
if mac-chrome-cli snapshot outline --json | jq -e '.data.elements[] | select(.selector == "#target-button")'; then
  mac-chrome-cli mouse click --selector "#target-button"
else
  echo "Target button not found"
fi
```

### Performance Optimization

1. **Use targeted snapshots**:
```bash
# Use visible-only for faster snapshots
mac-chrome-cli snapshot outline --visible-only --json

# Limit DOM depth for large pages
mac-chrome-cli snapshot dom-lite --max-depth 3 --json
```

2. **Batch network monitoring**:
```bash
# Start monitoring once, perform multiple actions
mac-chrome-cli netlog start
# ... multiple interactions ...
mac-chrome-cli netlog dump --format har > complete-session.har
mac-chrome-cli netlog stop
```

3. **Optimize screenshot settings**:
```bash
# Use lower preview sizes for faster processing
mac-chrome-cli shot viewport --preview-max 512000 --out quick-preview.png
```

### State Management

1. **Capture state at key decision points**:
```bash
# Before major interactions
mac-chrome-cli snapshot outline --json > state-before-login.json
mac-chrome-cli shot viewport --out before-login.png

# After state changes
mac-chrome-cli snapshot outline --json > state-after-login.json
```

2. **Track scroll position for consistent interactions**:
```bash
# Save current position
position=$(mac-chrome-cli scroll position --json | jq '.data')

# Scroll to element
mac-chrome-cli scroll to --selector "#target"

# Restore position if needed
# (implement scroll to coordinates when available)
```

## Advanced Patterns

### Multi-Tab Automation

```bash
# Work with multiple tabs/windows
mac-chrome-cli tab focus --match "Dashboard"
mac-chrome-cli shot viewport --out dashboard.png

mac-chrome-cli tab focus --match "Settings"  
mac-chrome-cli snapshot outline --json > settings-page.json
```

### Conditional Automation

```bash
#!/bin/bash
# Automation that adapts based on page content

page_content=$(mac-chrome-cli snapshot outline --json)

if echo "$page_content" | jq -e '.data.elements[] | select(.text | contains("Login"))'; then
  # Login workflow
  mac-chrome-cli input fill --selector "#username" --value "$USERNAME"
  mac-chrome-cli input fill --selector "#password" --value "$PASSWORD"
  mac-chrome-cli mouse click --selector "button[type=submit]"
elif echo "$page_content" | jq -e '.data.elements[] | select(.text | contains("Dashboard"))'; then
  # Already logged in, proceed with main workflow
  mac-chrome-cli mouse click --selector ".start-process"
fi
```

### Performance Monitoring

```bash
#!/bin/bash
# Monitor page performance during automation

# Start network monitoring
mac-chrome-cli netlog start --max-events 500

# Perform actions with timing
start_time=$(date +%s)
mac-chrome-cli nav go --url "$TARGET_URL"
mac-chrome-cli mouse click --selector ".load-heavy-content"
end_time=$(date +%s)

# Analyze performance
duration=$((end_time - start_time))
network_events=$(mac-chrome-cli netlog dump --format json | jq '.events | length')

echo "Operation took: ${duration}s with ${network_events} network events"
```

## Troubleshooting with Claude

### Common Issues and Solutions

1. **Element Not Found**:
   - Capture page structure: `mac-chrome-cli snapshot outline --json`
   - Take screenshot: `mac-chrome-cli shot viewport --out debug.png`
   - Let Claude analyze the visual state and suggest alternative selectors

2. **Timing Issues**:
   - Use network monitoring to detect when loading completes
   - Implement smart waits based on page content changes
   - Add screenshot comparisons to detect visual changes

3. **Permission Problems**:
   - Run `mac-chrome-cli doctor` for system diagnostics
   - Check [PERMISSIONS.md](./PERMISSIONS.md) for setup instructions

### Debug Workflow

```bash
#!/bin/bash
# Comprehensive debugging session

echo "=== System Check ==="
mac-chrome-cli doctor --json

echo "=== Current Page State ==="
mac-chrome-cli shot viewport --out debug-$(date +%s).png --json
mac-chrome-cli snapshot outline --json > debug-structure.json

echo "=== Scroll Position ==="
mac-chrome-cli scroll position --json

echo "=== Recent Network Activity ==="
mac-chrome-cli netlog dump --format json | jq '.events[-5:]'
```

## Integration Tips

1. **Use consistent file naming** for screenshots and data files
2. **Implement logging** for complex automation workflows
3. **Combine multiple commands** strategically to reduce overhead
4. **Leverage Claude's visual analysis** for dynamic selector generation
5. **Build reusable automation modules** for common patterns

For complete command reference and options, see [API.md](./API.md).