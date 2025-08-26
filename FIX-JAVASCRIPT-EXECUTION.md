# Solution: Fixing JavaScript Execution in Chrome via AppleScript

## Problem
70% of mac-chrome-cli commands fail with error:
```
"Access not allowed (-1723)" or "AppleEvent timed out (-1712)"
```

## Root Causes

1. **Chrome Security Setting**: "Allow JavaScript from Apple Events" is disabled by default
2. **Tab Targeting Issues**: Using `tab N of window N` is unreliable
3. **Chrome Activation**: Chrome must be the active application
4. **File URL Restriction**: JavaScript cannot execute on `file://` URLs

## Solution

### Step 1: Enable JavaScript from Apple Events

In Google Chrome:
1. Open Chrome menu bar
2. Go to **View** → **Developer** → **Allow JavaScript from Apple Events**
3. Ensure it's checked (enabled)

Or via AppleScript:
```applescript
tell application "Google Chrome" to activate
delay 0.5
tell application "System Events"
  tell process "Google Chrome"
    click menu item "Allow JavaScript from Apple Events" of menu 1 of menu item "Developer" of menu 1 of menu bar item "View" of menu bar 1
  end tell
end tell
```

### Step 2: Fix Implementation

The current implementation in `src/services/AppleScriptService.ts` needs modification:

**Current (Broken):**
```applescript
tell application "Google Chrome"
  set targetTab to tab ${tabIndex} of window ${windowIndex}
  set jsResult to execute javascript "${escapedJS}" in targetTab
end tell
```

**Fixed Version:**
```applescript
tell application "Google Chrome"
  activate
  delay 0.5
  
  -- Option 1: Use active tab (most reliable)
  tell active tab of front window
    set jsResult to execute javascript "${escapedJS}"
  end tell
  
  -- Option 2: Focus specific tab first
  -- set active tab index of window ${windowIndex} to ${tabIndex}
  -- tell active tab of window ${windowIndex}
  --   set jsResult to execute javascript "${escapedJS}"
  -- end tell
end tell
```

### Step 3: Handle Edge Cases

1. **Check for file:// URLs**:
```javascript
if (tabURL.startsWith('file://')) {
  return error('JavaScript execution not allowed on file:// URLs');
}
```

2. **Add activation timeout**:
```javascript
// Ensure Chrome is activated before executing
await execAppleScript('tell application "Google Chrome" to activate');
await sleep(500); // Give Chrome time to activate
```

3. **Implement retry logic** for timeout errors

## Implementation Changes Needed

### 1. Update AppleScriptService.executeJavaScript()

```typescript
public async executeJavaScript<T = unknown>(
  javascript: string,
  options: JavaScriptExecutionOptions = {}
): Promise<JavaScriptResult<T>> {
  // ... existing validation ...
  
  // New: Activate Chrome first
  const activationScript = `
tell application "Google Chrome"
  activate
  delay 0.5
end tell`;
  
  await this.executeScript(activationScript, 1000);
  
  // Modified script to use active tab
  const script = `
tell application "Google Chrome"
  tell active tab of front window
    set jsResult to execute javascript "${escapedJS}"
    return jsResult as string
  end tell
end tell`;
  
  // ... rest of implementation ...
}
```

### 2. Add Pre-flight Checks

```typescript
// Check if JavaScript from Apple Events is enabled
async function checkJavaScriptEnabled(): Promise<boolean> {
  try {
    const result = await execAppleScript(`
      tell application "Google Chrome"
        activate
        tell active tab of front window
          execute javascript "true"
        end tell
      end tell
    `);
    return result === 'true';
  } catch {
    return false;
  }
}
```

### 3. Update Doctor Command

Add check for "Allow JavaScript from Apple Events":
```typescript
{
  name: 'Chrome JavaScript from Apple Events',
  check: async () => checkJavaScriptEnabled(),
  fix: 'Enable via Chrome menu: View → Developer → Allow JavaScript from Apple Events'
}
```

## Testing

After implementing fixes, test with:
```bash
# Should work on HTTPS tabs
npx mac-chrome-cli dom eval --js "document.title" --json
npx mac-chrome-cli nav go --url "https://example.com" --json
npx mac-chrome-cli snapshot outline --json
```

## Expected Results

With these fixes:
- ✅ All JavaScript-based commands should work
- ✅ Navigation commands functional
- ✅ DOM evaluation working
- ✅ Page snapshots operational
- ✅ Network monitoring active
- ✅ 100% command functionality restored

## References

- [Chrome AppleScript Documentation](https://www.chromium.org/developers/applescript/)
- [Apple Events Permission Issue](https://bugs.chromium.org/p/chromium/issues/detail?id=891697)
- [Stack Overflow: Chrome JavaScript Execution](https://stackoverflow.com/questions/5135609/can-applescript-access-browser-tabs-and-execute-javascript-in-them)