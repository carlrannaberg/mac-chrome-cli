# macOS Permissions Setup Guide

This guide covers the macOS permission requirements and setup process for `mac-chrome-cli`.

## Overview

`mac-chrome-cli` requires specific macOS permissions to interact with Google Chrome and the system. These permissions are necessary for:

- Controlling Chrome through AppleScript
- Taking screenshots
- Simulating mouse and keyboard input
- Accessing application windows and UI elements

## Required Permissions

### 1. Accessibility (Required)

**Purpose**: Allows the CLI to interact with Chrome's UI elements, simulate clicks, and read page content.

**Setup Steps**:

1. Open **System Settings** (macOS 13+) or **System Preferences** (macOS 12 and earlier)
2. Navigate to **Privacy & Security** > **Accessibility**
3. Click the lock icon and enter your password to make changes
4. Click the **+** button to add an application
5. Navigate to and select **Terminal** (or your terminal application)
6. Ensure the checkbox next to **Terminal** is checked
7. If using from scripts or other applications, also add:
   - **Node.js** (if installed via installer)
   - **iTerm2** (if using iTerm)
   - Any IDE or editor you're running the CLI from

**Alternative Method** (Terminal command):
```bash
# This will prompt you to grant accessibility permissions
osascript -e 'tell application "System Events" to get name of first process'
```

### 2. Automation (Required)

**Purpose**: Allows the CLI to send AppleScript commands to Google Chrome.

**Setup Steps**:

1. Open **System Settings** > **Privacy & Security** > **Automation**
2. Look for your terminal application (Terminal, iTerm2, etc.)
3. Under your terminal app, ensure **Google Chrome** is checked
4. If not present, run the CLI once - it will request permission automatically

### 3. Screen Recording (Optional but Recommended)

**Purpose**: Required for taking screenshots and visual automation.

**Setup Steps**:

1. Open **System Settings** > **Privacy & Security** > **Screen Recording**
2. Click the lock icon and enter your password
3. Add your terminal application (Terminal, iTerm2, etc.)
4. Restart your terminal application after granting permission

## Setup Verification

Run the doctor command to verify your permissions:

```bash
mac-chrome-cli doctor
```

You should see output similar to:

```
🔍 Mac Chrome CLI System Diagnostics

✅ Overall Status: HEALTHY

📦 Dependencies:
  ✅ Google Chrome (Required): Installed
      Version: 120.0.6099.109
  ✅ Node.js (Required): Installed
      Version: v18.19.0

🔐 Permissions:
  ✅ Accessibility: Granted
  ✅ Automation: Granted
  ✅ Screen Recording: Granted

🖥️  System:
  ✅ macOS Version: macOS 14.2.1
      Details: Compatible version
  ✅ Chrome Running: Active
      Details: 3 windows, 5 tabs
```

## Troubleshooting

### Common Permission Issues

#### "Permission denied" errors

**Symptoms**:
```
Error: Permission denied: Unable to access Chrome
```

**Solutions**:
1. Verify Accessibility permissions are granted
2. Restart your terminal application
3. Try running with `sudo` (not recommended for regular use)
4. Check that the correct terminal application is listed in permissions

#### "Chrome not responding" errors

**Symptoms**:
```
Error: Chrome not found or not running
```

**Solutions**:
1. Ensure Google Chrome is running
2. Check Automation permissions for Chrome
3. Restart Chrome if it becomes unresponsive
4. Verify Chrome is installed in `/Applications/Google Chrome.app`

#### Screenshots fail or return black images

**Symptoms**:
- Commands complete but images are black/empty
- "Screen recording permission required" messages

**Solutions**:
1. Grant Screen Recording permissions
2. Restart terminal application after granting permissions
3. Test with a simple screenshot command
4. Check that Chrome windows are visible (not minimized)

### Advanced Troubleshooting

#### Reset Permissions

If permissions seem corrupted:

1. Remove your terminal app from all Privacy & Security categories
2. Restart your terminal
3. Run `mac-chrome-cli doctor` to re-trigger permission requests
4. Grant permissions when prompted

#### Terminal Detection Issues

If the system doesn't detect your terminal correctly:

```bash
# Check what process is requesting permissions
ps aux | grep -E "(Terminal|iTerm|node)"

# Check current shell
echo $0

# Verify running from correct location
which mac-chrome-cli
```

#### Permission Database Reset (Nuclear Option)

⚠️ **Warning**: This resets ALL privacy permissions for ALL apps:

```bash
sudo tccutil reset All
```

After running this, you'll need to re-grant permissions for all applications.

## Automated Setup

For development or CI environments, you can script some permission checks:

```bash
#!/bin/bash
# check-permissions.sh

# Check if accessibility is enabled
if ! osascript -e 'tell application "System Events" to get name of first process' >/dev/null 2>&1; then
    echo "❌ Accessibility permission required"
    echo "Grant in System Settings > Privacy & Security > Accessibility"
    exit 1
fi

# Check if Chrome automation is allowed
if ! osascript -e 'tell application "Google Chrome" to get name' >/dev/null 2>&1; then
    echo "❌ Chrome automation permission required"
    echo "Grant in System Settings > Privacy & Security > Automation"
    exit 1
fi

echo "✅ Basic permissions are configured"
```

## Security Considerations

### What Permissions Allow

- **Accessibility**: Full control over UI elements, can read and interact with any visible content
- **Automation**: Can send commands to Chrome, control navigation and page interaction
- **Screen Recording**: Can capture screenshots of your entire screen

### Best Practices

1. **Principle of Least Privilege**: Only grant permissions to applications you trust
2. **Regular Audits**: Periodically review granted permissions in System Settings
3. **Specific Applications**: Grant permissions to specific terminal apps rather than broad system access
4. **Environment Isolation**: Consider using separate user accounts for automation tasks

### Revoking Permissions

To remove permissions:

1. Open **System Settings** > **Privacy & Security**
2. Navigate to the relevant permission category
3. Uncheck or remove your terminal application
4. Restart the terminal application

## Alternative Setups

### Using with Different Terminals

#### iTerm2
- Grant permissions to iTerm2 specifically
- May require separate permission grants from Terminal

#### VS Code Integrated Terminal
- Grant permissions to "Code" or "Visual Studio Code"
- Sometimes requires permissions for both VS Code and Node.js

#### SSH/Remote Sessions
- Permissions must be granted on the local machine
- Remote automation requires additional SSH key setup

### Sandboxed Environments

For maximum security, consider:

1. **Separate User Account**: Create a dedicated user for automation tasks
2. **Virtual Machine**: Run automation in a VM (though this limits screen recording)
3. **Container Solutions**: Use Docker or similar (limited GUI access)

## macOS Version Differences

### macOS 13+ (Ventura and later)
- Uses "System Settings" instead of "System Preferences"
- More granular permission controls
- Enhanced security notifications

### macOS 12 and earlier
- Uses "System Preferences"
- Slightly different navigation paths
- May have fewer automation-specific permissions

### Enterprise/MDM Environments

If using in a managed environment:

1. Contact your IT administrator for permission policies
2. Some permissions may require admin approval
3. Corporate security software may interfere with automation

## Getting Help

If you continue to have permission issues:

1. Run `mac-chrome-cli doctor` for detailed diagnostics
2. Check the [GitHub Issues](https://github.com/carlrannaberg/mac-chrome-cli/issues) for similar problems
3. Provide the full doctor output when reporting issues
4. Include your macOS version and terminal application details

## Quick Reference

| Permission | Location | Purpose | Required |
|------------|----------|---------|----------|
| Accessibility | Privacy & Security > Accessibility | UI interaction, element detection | Yes |
| Automation | Privacy & Security > Automation | Chrome control via AppleScript | Yes |
| Screen Recording | Privacy & Security > Screen Recording | Screenshot capture | Recommended |

**Remember**: Always restart your terminal application after granting new permissions!