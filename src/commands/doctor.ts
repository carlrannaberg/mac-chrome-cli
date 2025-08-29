import { execWithTimeout } from '../lib/util.js';
import { isChromeRunning } from '../lib/apple.js';

export interface DependencyCheck {
  name: string;
  required: boolean;
  installed: boolean;
  version?: string | undefined;
  installCommand?: string | undefined;
  description: string;
}

export interface PermissionCheck {
  name: string;
  granted: boolean;
  description: string;
  instructions?: string | undefined;
}

export interface SystemCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  description: string;
  details?: string | undefined;
}

export interface DoctorResult {
  overall: 'healthy' | 'warnings' | 'errors';
  dependencies: DependencyCheck[];
  permissions: PermissionCheck[];
  system: SystemCheck[];
  recommendations: string[];
}

export interface ScreenshotDoctorResult {
  screenRecordingOk: boolean;
  chromeRunning: boolean;
  axWindowNumber: number | null;
  windowIdCaptureOk: boolean;
  notes: string[];
}

/**
 * Verify screenshot pipeline: permissions + AXWindowNumber + window-id capture
 */
export async function runScreenshotDoctor(): Promise<ScreenshotDoctorResult> {
  const notes: string[] = [];

  // Screen recording quick check
  let screenRecordingOk = false;
  try {
    const tmp = `/tmp/mac-chrome-cli-screenrec-test-${Date.now()}.png`;
    const r = await execWithTimeout('screencapture', ['-x', '-t', 'png', tmp], 5000);
    screenRecordingOk = r.success;
    if (screenRecordingOk) await execWithTimeout('rm', ['-f', tmp], 1000);
  } catch {}

  const chromeRunning = await isChromeRunning();
  let axWindowNumber: number | null = null;
  let windowIdCaptureOk = false;

  if (chromeRunning) {
    // Try to fetch AXWindowNumber for frontmost Chrome window
    const script = `
tell application "System Events"
  tell process "Google Chrome"
    if exists window 1 then
      return value of attribute "AXWindowNumber" of window 1
    else
      return ""
    end if
  end tell
end tell`;
    try {
      const res = await execWithTimeout('osascript', ['-e', script], 2000);
      const out = res.success ? res.data.stdout.trim() : '';
      if (out) {
        axWindowNumber = parseInt(out, 10);
        if (!Number.isNaN(axWindowNumber)) {
          // Try window-id capture
          const tmp = `/tmp/mac-chrome-cli-windowid-test-${Date.now()}.png`;
          const cap = await execWithTimeout('screencapture', ['-x', '-l', String(axWindowNumber), tmp], 8000);
          windowIdCaptureOk = cap.success;
          if (windowIdCaptureOk) await execWithTimeout('rm', ['-f', tmp], 1000);
        }
      }
    } catch (e) {
      notes.push(`Failed to query AXWindowNumber: ${String(e)}`);
    }
  } else {
    notes.push('Chrome is not running; start Chrome to test window-id capture');
  }

  if (!screenRecordingOk) {
    notes.push('Screen Recording may be denied. Grant in System Settings → Privacy & Security → Screen Recording');
  }
  if (axWindowNumber === null) {
    notes.push('Accessibility permission may be required to read AXWindowNumber (System Settings → Privacy & Security → Accessibility)');
  }

  return { screenRecordingOk, chromeRunning, axWindowNumber, windowIdCaptureOk, notes };
}

/**
 * Check if a command exists in PATH
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    const result = await execWithTimeout('which', [command], 5000);
    return result.success && result.data.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get command version
 */
async function getCommandVersion(command: string, versionFlag: string = '--version'): Promise<string | undefined> {
  try {
    const result = await execWithTimeout(command, [versionFlag], 5000);
    if (result.success) {
      return result.data.stdout.trim().split('\n')[0];
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Check Chrome CLI dependency
 */
async function checkChromeCLI(): Promise<DependencyCheck> {
  const installed = await commandExists('chrome-cli');
  let version: string | undefined;
  
  if (installed) {
    version = await getCommandVersion('chrome-cli', '--version');
  }
  
  return {
    name: 'chrome-cli',
    required: false,
    installed,
    version,
    installCommand: 'brew install chrome-cli',
    description: 'Command-line tool for controlling Chrome (optional, enhances tab management)'
  };
}

/**
 * Check cliclick dependency
 */
async function checkCliclick(): Promise<DependencyCheck> {
  const installed = await commandExists('cliclick');
  let version: string | undefined;
  
  if (installed) {
    version = await getCommandVersion('cliclick', '-V');
  }
  
  return {
    name: 'cliclick',
    required: true,
    installed,
    version,
    installCommand: 'brew install cliclick',
    description: 'Command-line tool for mouse and keyboard automation (required for interactions)'
  };
}

/**
 * Check AppleScript automation permission
 */
async function checkAppleScriptPermission(): Promise<PermissionCheck> {
  try {
    const testScript = `
tell application "System Events"
  return "test"
end tell`;
    
    const result = await execWithTimeout('osascript', ['-e', testScript], 5000);
    const granted = result.success && !result.data.stderr.includes('not authorized');
    
    return {
      name: 'AppleScript Automation',
      granted,
      description: 'Permission to control other applications via AppleScript',
      instructions: granted ? undefined : 'Grant permission in System Preferences > Privacy & Security > Automation > Terminal'
    };
  } catch {
    return {
      name: 'AppleScript Automation',
      granted: false,
      description: 'Permission to control other applications via AppleScript',
      instructions: 'Grant permission in System Preferences > Privacy & Security > Automation > Terminal'
    };
  }
}

/**
 * Check screen recording permission
 */
async function checkScreenRecordingPermission(): Promise<PermissionCheck> {
  try {
    // Try to take a small screenshot
    const result = await execWithTimeout('screencapture', ['-x', '-t', 'png', '/tmp/mac-chrome-cli-test.png'], 5000);
    const granted = result.success;
    
    // Clean up test file
    if (granted) {
      await execWithTimeout('rm', ['-f', '/tmp/mac-chrome-cli-test.png'], 1000);
    }
    
    return {
      name: 'Screen Recording',
      granted,
      description: 'Permission to capture screenshots',
      instructions: granted ? undefined : 'Grant permission in System Preferences > Privacy & Security > Screen Recording > Terminal'
    };
  } catch {
    return {
      name: 'Screen Recording',
      granted: false,
      description: 'Permission to capture screenshots',
      instructions: 'Grant permission in System Preferences > Privacy & Security > Screen Recording > Terminal'
    };
  }
}

/**
 * Check Chrome availability
 */
async function checkChromeAvailability(): Promise<SystemCheck> {
  const isRunning = await isChromeRunning();
  
  if (isRunning) {
    return {
      name: 'Google Chrome',
      status: 'ok',
      description: 'Google Chrome is running and accessible'
    };
  }
  
  // Check if Chrome is installed
  const chromeExists = await commandExists('open');
  if (chromeExists) {
    try {
      const result = await execWithTimeout('open', ['-Ra', 'Google Chrome', '--args', '--version'], 3000);
      if (result.success) {
        return {
          name: 'Google Chrome',
          status: 'warning',
          description: 'Google Chrome is installed but not currently running',
          details: 'Start Chrome to use mac-chrome-cli commands'
        };
      }
    } catch {
      // Fall through to error case
    }
  }
  
  return {
    name: 'Google Chrome',
    status: 'error',
    description: 'Google Chrome is not installed or not accessible',
    details: 'Install Google Chrome from https://www.google.com/chrome/'
  };
}

/**
 * Check Chrome JavaScript settings
 */
async function checkChromeJavaScriptSettings(): Promise<SystemCheck> {
  const isRunning = await isChromeRunning();
  
  if (!isRunning) {
    return {
      name: 'Chrome JavaScript Settings',
      status: 'warning',
      description: 'Cannot check JavaScript settings - Chrome is not running',
      details: 'Start Chrome to verify JavaScript execution settings'
    };
  }
  
  // Try to execute a simple JavaScript command
  try {
    const { execChromeJS } = await import('../lib/apple.js');
    const result = await execChromeJS<string>('JSON.stringify("test")', 1, 1, 3000);
    
    if (result.success) {
      return {
        name: 'Chrome JavaScript Settings',
        status: 'ok',
        description: 'JavaScript execution from Apple Events is enabled'
      };
    } else if (result.error?.includes('file://')) {
      return {
        name: 'Chrome JavaScript Settings',
        status: 'warning',
        description: 'Chrome is on a file:// URL - JavaScript execution limited',
        details: 'Navigate to a web page (http:// or https://) for full functionality'
      };
    } else {
      return {
        name: 'Chrome JavaScript Settings',
        status: 'warning',
        description: 'JavaScript execution may be restricted',
        details: 'Enable "Allow JavaScript from Apple Events" in Chrome: View → Developer → Allow JavaScript from Apple Events'
      };
    }
  } catch (error) {
    return {
      name: 'Chrome JavaScript Settings',
      status: 'warning',
      description: 'Could not verify JavaScript settings',
      details: 'Ensure Chrome Developer menu is enabled and "Allow JavaScript from Apple Events" is checked'
    };
  }
}

/**
 * Check macOS version compatibility
 */
async function checkMacOSVersion(): Promise<SystemCheck> {
  try {
    const result = await execWithTimeout('sw_vers', ['-productVersion'], 5000);
    if (result.success) {
      const version = result.data.stdout.trim();
      const versionParts = version.split('.');
      const majorVersion = versionParts.length > 0 && versionParts[0] ? parseInt(versionParts[0], 10) : 0;
      
      if (majorVersion >= 12) { // macOS Monterey or later
        return {
          name: 'macOS Version',
          status: 'ok',
          description: `macOS ${version} - fully compatible`
        };
      } else if (majorVersion >= 10) {
        return {
          name: 'macOS Version',
          status: 'warning',
          description: `macOS ${version} - may have limited functionality`,
          details: 'Some features may not work on older macOS versions'
        };
      } else {
        return {
          name: 'macOS Version',
          status: 'error',
          description: `macOS ${version} - not supported`,
          details: 'Upgrade to macOS 10.15 or later for best compatibility'
        };
      }
    }
  } catch {
    // Fall through to unknown case
  }
  
  return {
    name: 'macOS Version',
    status: 'warning',
    description: 'Unable to determine macOS version'
  };
}

/**
 * Run comprehensive system diagnostics
 * 
 * Performs comprehensive health checks for mac-chrome-cli including dependency
 * verification, permission checks, and system compatibility validation.
 * 
 * @returns Promise resolving to complete diagnostic results
 * 
 * @throws {SYSTEM_ERROR} When unable to execute system commands for dependency checking
 * @throws {PERMISSION_DENIED} When system permissions prevent diagnostic execution
 * @throws {CHROME_NOT_FOUND} When Chrome application cannot be located during availability check
 * @throws {APPLESCRIPT_ERROR} When AppleScript execution fails during permission checks
 * @throws {TIMEOUT} When diagnostic operations exceed time limits
 * @throws {UNKNOWN_ERROR} When unexpected errors occur during diagnostic execution
 * 
 * @example
 * ```typescript
 * // Run system diagnostics with error handling
 * try {
 *   const result = await runDiagnostics();
 *   
 *   switch (result.overall) {
 *     case 'healthy':
 *       console.log('✅ System is ready for mac-chrome-cli');
 *       break;
 *     case 'warnings':
 *       console.log('⚠️ System has warnings:', result.recommendations);
 *       break;
 *     case 'errors':
 *       console.log('❌ System has errors that need attention');
 *       break;
 *   }
 *   
 *   // Check specific issues
 *   for (const dep of result.dependencies) {
 *     if (dep.required && !dep.installed) {
 *       console.log(`Missing required dependency: ${dep.name}`);
 *       console.log(`Install with: ${dep.installCommand}`);
 *     }
 *   }
 *   
 *   for (const perm of result.permissions) {
 *     if (!perm.granted) {
 *       console.log(`Permission needed: ${perm.name}`);
 *       console.log(`Instructions: ${perm.instructions}`);
 *     }
 *   }
 * } catch (error) {
 *   console.error('Diagnostic execution failed:', error);
 * }
 * ```
 */
export async function runDiagnostics(): Promise<DoctorResult> {
  // Run all checks in parallel
  const [
    chromeCLICheck,
    cliclickCheck,
    appleScriptPermission,
    screenRecordingPermission,
    chromeAvailability,
    chromeJavaScriptSettings,
    macOSVersion
  ] = await Promise.all([
    checkChromeCLI(),
    checkCliclick(),
    checkAppleScriptPermission(),
    checkScreenRecordingPermission(),
    checkChromeAvailability(),
    checkChromeJavaScriptSettings(),
    checkMacOSVersion()
  ]);
  
  const dependencies = [chromeCLICheck, cliclickCheck];
  const permissions = [appleScriptPermission, screenRecordingPermission];
  const system = [chromeAvailability, chromeJavaScriptSettings, macOSVersion];
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  // Required dependencies
  const missingRequired = dependencies.filter(dep => dep.required && !dep.installed);
  if (missingRequired.length > 0) {
    recommendations.push('Install required dependencies:');
    missingRequired.forEach(dep => {
      recommendations.push(`  ${dep.installCommand}`);
    });
  }
  
  // Optional dependencies
  const missingOptional = dependencies.filter(dep => !dep.required && !dep.installed);
  if (missingOptional.length > 0) {
    recommendations.push('Consider installing optional dependencies for enhanced functionality:');
    missingOptional.forEach(dep => {
      recommendations.push(`  ${dep.installCommand}`);
    });
  }
  
  // Missing permissions
  const missingPermissions = permissions.filter(perm => !perm.granted);
  if (missingPermissions.length > 0) {
    recommendations.push('Grant required permissions:');
    missingPermissions.forEach(perm => {
      if (perm.instructions) {
        recommendations.push(`  ${perm.instructions}`);
      }
    });
  }
  
  // System issues
  const systemErrors = system.filter(sys => sys.status === 'error');
  const systemWarnings = system.filter(sys => sys.status === 'warning');
  
  if (systemErrors.length > 0) {
    recommendations.push('Resolve system issues:');
    systemErrors.forEach(sys => {
      if (sys.details) {
        recommendations.push(`  ${sys.details}`);
      }
    });
  }
  
  // Chrome specific
  if (chromeAvailability.status === 'warning') {
    recommendations.push('Start Google Chrome to enable all functionality');
  }
  
  // Determine overall status
  let overall: 'healthy' | 'warnings' | 'errors' = 'healthy';
  
  if (missingRequired.length > 0 || missingPermissions.length > 0 || systemErrors.length > 0) {
    overall = 'errors';
  } else if (missingOptional.length > 0 || systemWarnings.length > 0) {
    overall = 'warnings';
  }
  
  return {
    overall,
    dependencies,
    permissions,
    system,
    recommendations
  };
}
