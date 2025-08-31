import { Command } from 'commander';
import { OutputFormatter, GlobalOptions } from './OutputFormatter.js';
import { ERROR_CODES } from '../lib/util.js';
import { ErrorCode } from '../core/ErrorCodes.js';
import type { ScreenshotOptions } from '../commands/screenshot.js';
import type { MouseOptions } from '../commands/mouse.js';
import type { KeyboardOptions } from '../commands/keyboard.js';
import type { InputOptions, InputValueOptions, FormSubmitOptions } from '../commands/input.js';
import type { TabFocusOptions, TabListOptions, TabFocusIndexOptions } from '../commands/tab.js';
import type { IServiceContainer } from '../di/ServiceContainer.js';

interface TabInfoOptions {
  windowIndex: number;
}

/**
 * Central registry for all CLI commands
 * Handles command registration and execution
 */
export class CommandRegistry {
  private program: Command;
  private formatter: OutputFormatter;
  private serviceContainer?: IServiceContainer;

  constructor(program: Command, formatter: OutputFormatter) {
    this.program = program;
    this.formatter = formatter;
  }

  /**
   * Set the service container for commands that need it
   */
  setServiceContainer(container: IServiceContainer): void {
    this.serviceContainer = container;
  }

  /**
   * Get or create service container
   */
  private async getServiceContainer(): Promise<IServiceContainer> {
    if (!this.serviceContainer) {
      const { createServiceContainer } = await import('../di/ServiceRegistry.js');
      this.serviceContainer = await createServiceContainer();
    }
    return this.serviceContainer;
  }

  /**
   * Register all CLI commands
   */
  async registerAll(): Promise<void> {
    this.registerDoctorCommand();
    this.registerNavigationCommands();
    this.registerTabCommands();
    this.registerScreenshotCommands();
    this.registerMouseCommands();
    this.registerKeyboardCommands();
    this.registerInputCommands();
    this.registerWaitCommand();
    this.registerNetlogCommands();
    this.registerSnapshotCommands();
    this.registerScrollCommands();
    this.registerFilesCommands();
    this.registerDomCommands();
    this.registerMetaCommands();
    await this.registerBenchmarkCommand();
  }


  private registerDoctorCommand(): void {
    const doctor = this.program
      .command('doctor')
      .description('Diagnose system setup and dependencies')
      .action(async () => {
        try {
          const { runDiagnostics } = await import('../commands/doctor.js');
          const result = await runDiagnostics();
          
          const globalOpts = this.program.opts() as GlobalOptions;
          
          if (globalOpts.json) {
            this.formatter.output(result);
          } else {
            // Human-readable output
            console.log('🔍 Mac Chrome CLI System Diagnostics\n');
            
            // Overall status
            const statusIcon = result.overall === 'healthy' ? '✅' : result.overall === 'warnings' ? '⚠️' : '❌';
            console.log(`${statusIcon} Overall Status: ${result.overall.toUpperCase()}\n`);
            
            // Dependencies
            console.log('📦 Dependencies:');
            result.dependencies.forEach(dep => {
              const icon = dep.installed ? '✅' : dep.required ? '❌' : '⚠️';
              const label = dep.required ? 'Required' : 'Optional';
              console.log(`  ${icon} ${dep.name} (${label}): ${dep.installed ? 'Installed' : 'Missing'}`);
              if (dep.version) {
                console.log(`      Version: ${dep.version}`);
              }
              if (!dep.installed && dep.installCommand) {
                console.log(`      Install: ${dep.installCommand}`);
              }
            });
            console.log();
            
            // Permissions
            console.log('🔐 Permissions:');
            result.permissions.forEach(perm => {
              const icon = perm.granted ? '✅' : '❌';
              console.log(`  ${icon} ${perm.name}: ${perm.granted ? 'Granted' : 'Denied'}`);
              if (!perm.granted && perm.instructions) {
                console.log(`      Fix: ${perm.instructions}`);
              }
            });
            console.log();
            
            // System
            console.log('🖥️  System:');
            result.system.forEach(sys => {
              const icon = sys.status === 'ok' ? '✅' : sys.status === 'warning' ? '⚠️' : '❌';
              console.log(`  ${icon} ${sys.name}: ${sys.description}`);
              if (sys.details) {
                console.log(`      Details: ${sys.details}`);
              }
            });
            console.log();
            
            // Recommendations
            if (result.recommendations.length > 0) {
              console.log('💡 Recommendations:');
              result.recommendations.forEach(rec => {
                console.log(`  ${rec}`);
              });
              console.log();
            }
            
            // Set appropriate exit code
            if (result.overall === 'errors') {
              process.exitCode = ERROR_CODES.PERMISSION_DENIED;
            } else if (result.overall === 'warnings') {
              process.exitCode = ERROR_CODES.OK; // Warnings don't fail
            }
          }
        } catch (error) {
          this.formatter.output(null, `Doctor command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    // Additional targeted screenshot diagnostics
    this.program
      .command('doctor-screenshots')
      .description('Verify Screen Recording permission and window-id capture path')
      .action(async () => {
        try {
          const { runScreenshotDoctor } = await import('../commands/doctor.js');
          const result = await runScreenshotDoctor();

          const globalOpts = this.program.opts() as GlobalOptions;
          if (globalOpts.json) {
            this.formatter.output(result);
          } else {
            console.log('🖼️  Screenshot Diagnostics');
            console.log(`  Screen Recording: ${result.screenRecordingOk ? '✅ OK' : '❌ Denied'}`);
            console.log(`  Chrome Running:   ${result.chromeRunning ? '✅ Yes' : '❌ No'}`);
            console.log(`  AXWindowNumber:   ${result.axWindowNumber !== null ? '✅ ' + result.axWindowNumber : '❌ Not found'}`);
            console.log(`  Window-ID Capture:${result.windowIdCaptureOk ? '✅ Succeeded' : '❌ Failed'}`);
            if (result.notes.length) {
              console.log('  Notes:');
              result.notes.forEach(n => console.log(`    - ${n}`));
            }
            if (!result.screenRecordingOk) {
              process.exitCode = ERROR_CODES.PERMISSION_DENIED;
            }
          }
        } catch (error) {
          this.formatter.output(null, `Doctor screenshots failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerNavigationCommands(): void {
    // Top-level reload command
    this.program
      .command('reload')
      .description('Reload current page')
      .option('--hard', 'perform hard reload (bypass cache)')
      .option('--wait', 'wait for page load completion')
      .option('--timeout <ms>', 'reload timeout in milliseconds', '30000')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { NavigationCommand } = await import('../commands/navigation.js');
          const cmd = new NavigationCommand();
          
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(options.timeout, 10);
          
          if (isNaN(windowIndex) || windowIndex < 1) {
            this.formatter.output(null, 'Invalid window index. Must be a positive integer.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          if (isNaN(timeoutMs) || timeoutMs < 1000) {
            this.formatter.output(null, 'Invalid timeout. Must be at least 1000ms.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await cmd.reload({
            windowIndex,
            waitForLoad: options.wait,
            timeoutMs,
            hardReload: options.hard
          });
          
          if (result.success) {
            this.formatter.output(result.data, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Reload command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    // Top-level back command
    this.program
      .command('back')
      .description('Navigate back in browser history')
      .option('--wait', 'wait for page load completion')
      .option('--timeout <ms>', 'navigation timeout in milliseconds', '30000')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { NavigationCommand } = await import('../commands/navigation.js');
          const cmd = new NavigationCommand();
          
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(options.timeout, 10);
          
          if (isNaN(windowIndex) || windowIndex < 1) {
            this.formatter.output(null, 'Invalid window index. Must be a positive integer.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          if (isNaN(timeoutMs) || timeoutMs < 1000) {
            this.formatter.output(null, 'Invalid timeout. Must be at least 1000ms.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await cmd.back({
            windowIndex,
            waitForLoad: options.wait,
            timeoutMs
          });
          
          if (result.success) {
            this.formatter.output(result.data, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Back navigation failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    // Top-level forward command
    this.program
      .command('forward')
      .description('Navigate forward in browser history')
      .option('--wait', 'wait for page load completion')
      .option('--timeout <ms>', 'navigation timeout in milliseconds', '30000')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { NavigationCommand } = await import('../commands/navigation.js');
          const cmd = new NavigationCommand();
          
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(options.timeout, 10);
          
          if (isNaN(windowIndex) || windowIndex < 1) {
            this.formatter.output(null, 'Invalid window index. Must be a positive integer.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          if (isNaN(timeoutMs) || timeoutMs < 1000) {
            this.formatter.output(null, 'Invalid timeout. Must be at least 1000ms.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await cmd.forward({
            windowIndex,
            waitForLoad: options.wait,
            timeoutMs
          });
          
          if (result.success) {
            this.formatter.output(result.data, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Forward navigation failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    // Top-level open command
    this.program
      .command('open <url>')
      .description('Navigate to URL')
      .option('--wait', 'wait for page load completion')
      .option('--timeout <ms>', 'navigation timeout in milliseconds', '30000')
      .option('--window <index>', 'Target window index', '1')
      .action(async (url, options) => {
        try {
          const { NavigationCommand } = await import('../commands/navigation.js');
          const cmd = new NavigationCommand();
          
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(options.timeout, 10);
          
          if (isNaN(windowIndex) || windowIndex < 1) {
            this.formatter.output(null, 'Invalid window index. Must be a positive integer.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          if (isNaN(timeoutMs) || timeoutMs < 1000) {
            this.formatter.output(null, 'Invalid timeout. Must be at least 1000ms.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await cmd.go(url, {
            windowIndex,
            waitForLoad: options.wait,
            timeoutMs
          });
          
          if (result.success) {
            this.formatter.output(result.data, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Open command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }


  private registerTabCommands(): void {
    const tabCmd = this.program
      .command('tab')
      .description('Tab management commands');

    // Focus tab command
    tabCmd
      .command('focus')
      .description('Focus tab by pattern matching title or URL')
      .requiredOption('--pattern <pattern>', 'Pattern to match tab title or URL')
      .option('--window <index>', 'Target window index', '1')
      .option('--exact', 'Use exact matching instead of substring matching')
      .action(async (options) => {
        try {
          const { TabCommand } = await import('../commands/tab.js');
          const tabCommand = new TabCommand();
          
          const focusOptions: TabFocusOptions = {
            pattern: options.pattern,
            windowIndex: parseInt(options.window, 10),
            exactMatch: options.exact
          };
          
          const result = await tabCommand.focus(focusOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Tab focus failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });

    // Get active tab command
    tabCmd
      .command('active')
      .description('Get information about the currently active tab')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { TabCommand } = await import('../commands/tab.js');
          const tabCommand = new TabCommand();
          
          const infoOptions: TabInfoOptions = {
            windowIndex: parseInt(options.window, 10)
          };
          
          const result = await tabCommand.getActive(infoOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Get active tab failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });

    // List tabs command
    tabCmd
      .command('list')
      .description('List all tabs in a Chrome window')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { TabCommand } = await import('../commands/tab.js');
          const tabCommand = new TabCommand();
          
          const listOptions: TabListOptions = {
            windowIndex: parseInt(options.window, 10)
          };
          
          const result = await tabCommand.list(listOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `List tabs failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });

    // Focus tab by index command
    tabCmd
      .command('focus-index')
      .description('Focus tab by its index position')
      .requiredOption('--tab-index <index>', 'Tab index to focus (1-based)')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { TabCommand } = await import('../commands/tab.js');
          const tabCommand = new TabCommand();
          
          const focusIndexOptions: TabFocusIndexOptions = {
            tabIndex: parseInt(options.tabIndex, 10),
            windowIndex: parseInt(options.window, 10)
          };
          
          const result = await tabCommand.focusByIndex(focusIndexOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Focus tab by index failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });
  }

  private registerScreenshotCommands(): void {
    // Unified screenshot command - handles viewport, element, navigation, and fullscreen
    this.program
      .command('screenshot [url]')
      .description('Take screenshot (optionally navigate to URL first)')
      .option('--out <path>', 'Output file path (auto-generated if not specified)')
      .option('--format <format>', 'Image format (png|jpg|pdf)', 'png')
      .option('--quality <quality>', 'JPEG quality 1-100 (jpg format only)', '90')
      .option('--save-file', 'Save to file instead of returning base64 (default: return base64)')
      .option('--wait', 'wait for page load completion (when navigating)')
      .option('--timeout <ms>', 'navigation/screenshot timeout in milliseconds', '30000')
      .option('--window <index>', 'Target window index', '1')
      .option('--selector <selector>', 'CSS selector for element screenshot')
      .option('--fullscreen', 'capture entire screen instead of browser viewport')
      .action(async (url, options) => {
        await this.executeScreenshotCommand(url, options);
      });

    // Add 'capture' as alias for 'screenshot'
    this.program
      .command('capture [url]')
      .description('Alias for screenshot command')
      .option('--out <path>', 'Output file path (auto-generated if not specified)')
      .option('--format <format>', 'Image format (png|jpg|pdf)', 'png')
      .option('--quality <quality>', 'JPEG quality 1-100 (jpg format only)', '90')
      .option('--save-file', 'Save to file instead of returning base64 (default: return base64)')
      .option('--wait', 'wait for page load completion (when navigating)')
      .option('--timeout <ms>', 'navigation/screenshot timeout in milliseconds', '30000')
      .option('--window <index>', 'Target window index', '1')
      .option('--selector <selector>', 'CSS selector for element screenshot')
      .option('--fullscreen', 'capture entire screen instead of browser viewport')
      .action(async (url, options) => {
        await this.executeScreenshotCommand(url, options);
      });

  }

  private registerMouseCommands(): void {
    // Natural top-level click command (unified mouse interaction)
    this.program
      .command('click <selector>')
      .description('Click on element by CSS selector')
      .option('--button <button>', 'Mouse button (left|right|middle)', 'left')
      .option('--click-count <count>', 'Number of clicks (1=single, 2=double)', '1')
      .option('--hover-only', 'Only hover over element without clicking')
      .option('--offset-x <x>', 'X offset from element center')
      .option('--offset-y <y>', 'Y offset from element center')
      .option('--window <index>', 'Target window index', '1')
      .action(async (selector, options) => {
        // Determine action based on options
        let action: 'click' | 'doubleClick' | 'rightClick' | 'move';
        
        if (options.hoverOnly) {
          action = 'move';
        } else if (options.button === 'right') {
          action = 'rightClick';
        } else if (options.clickCount && parseInt(options.clickCount, 10) === 2) {
          action = 'doubleClick';
        } else {
          action = 'click';
        }
        
        await this.executeMouseCommand(selector, action, options);
      });

    // Add 'double-click' as alias for 'click --click-count 2'
    this.program
      .command('double-click <selector>')
      .description('Double-click on element by CSS selector')
      .option('--offset-x <x>', 'X offset from element center')
      .option('--offset-y <y>', 'Y offset from element center')
      .option('--window <index>', 'Target window index', '1')
      .action(async (selector, options) => {
        await this.executeMouseCommand(selector, 'doubleClick', options);
      });

    // Add 'right-click' as alias for 'click --button right'
    this.program
      .command('right-click <selector>')
      .description('Right-click (context menu) on element by CSS selector')
      .option('--offset-x <x>', 'X offset from element center')
      .option('--offset-y <y>', 'Y offset from element center')
      .option('--window <index>', 'Target window index', '1')
      .action(async (selector, options) => {
        await this.executeMouseCommand(selector, 'rightClick', options);
      });

    // Add 'hover' as alias for 'click --hover-only'
    this.program
      .command('hover <selector>')
      .description('Hover over element by CSS selector')
      .option('--offset-x <x>', 'X offset from element center')
      .option('--offset-y <y>', 'Y offset from element center')
      .option('--window <index>', 'Target window index', '1')
      .action(async (selector, options) => {
        await this.executeMouseCommand(selector, 'move', options);
      });

    // Grouped mouse commands (for advanced use cases)
    const mouseCmd = this.program
      .command('mouse')
      .description('Advanced mouse interaction commands');

    // Advanced coordinate-based click (for when you need exact coordinates)
    mouseCmd
      .command('click-coords')
      .description('Click at exact coordinates')
      .requiredOption('--x <x>', 'X coordinate')
      .requiredOption('--y <y>', 'Y coordinate')
      .option('--button <button>', 'Mouse button (left|right|middle)', 'left')
      .option('--click-count <count>', 'Number of clicks', '1')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { MouseCommand } = await import('../commands/mouse.js');
          const mouseCommand = new MouseCommand();
          
          const mouseOptions: MouseOptions = {
            x: parseFloat(options.x),
            y: parseFloat(options.y),
            button: options.button as 'left' | 'right' | 'middle',
            ...(options.clickCount && { clickCount: parseInt(options.clickCount, 10) }),
            windowIndex: parseInt(options.window, 10)
          };
          
          const result = await mouseCommand.click(mouseOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Mouse coordinate click failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });

    // Drag command (no simple equivalent - complex operation)
    mouseCmd
      .command('drag')
      .description('Drag from one location to another')
      .requiredOption('--from-selector <selector>', 'CSS selector for source element')
      .option('--from-x <x>', 'Source X coordinate (if not using from-selector)')
      .option('--from-y <y>', 'Source Y coordinate (if not using from-selector)')
      .requiredOption('--to-selector <selector>', 'CSS selector for target element')
      .option('--to-x <x>', 'Target X coordinate (if not using to-selector)')
      .option('--to-y <y>', 'Target Y coordinate (if not using to-selector)')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { MouseCommand } = await import('../commands/mouse.js');
          const mouseCommand = new MouseCommand();
          
          const fromOptions: MouseOptions = {
            selector: options.fromSelector,
            ...(options.fromX && { x: parseFloat(options.fromX) }),
            ...(options.fromY && { y: parseFloat(options.fromY) }),
            windowIndex: parseInt(options.window, 10)
          };
          
          const toOptions: MouseOptions = {
            selector: options.toSelector,
            ...(options.toX && { x: parseFloat(options.toX) }),
            ...(options.toY && { y: parseFloat(options.toY) }),
            windowIndex: parseInt(options.window, 10)
          };
          
          const result = await mouseCommand.drag(fromOptions, toOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Mouse drag failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });
  }

  private registerKeyboardCommands(): void {
    // Natural top-level type command (unified keyboard input)
    this.program
      .command('type <text>')
      .description('Type text at current cursor position')
      .option('--speed <ms>', 'Delay between characters in ms', '50')
      .option('--clear', 'Clear field before typing')
      .option('--combo', 'Treat text as key combination (e.g., cmd+s, ctrl+c)')
      .option('--repeat <count>', 'Number of times to repeat', '1')
      .action(async (text, options) => {
        const action = options.combo ? 'combo' : 'type';
        const keyboardOptions = {
          [options.combo ? 'combo' : 'text']: text,
          speed: options.speed,
          clear: options.clear,
          repeat: options.repeat
        };
        
        await this.executeKeyboardCommand(action, keyboardOptions);
      });

    // Grouped keyboard commands (for advanced use cases)
    const keyboardCmd = this.program
      .command('keyboard')
      .description('Advanced keyboard input commands');

    // Key combination command
    keyboardCmd
      .command('combo')
      .description('Send key combination')
      .requiredOption('--combo <combo>', 'Key combination (e.g., cmd+s, ctrl+c)')
      .option('--repeat <count>', 'Number of times to repeat', '1')
      .action(async (options) => {
        await this.executeKeyboardCommand('combo', options);
      });

    // Press key command
    keyboardCmd
      .command('press')
      .description('Press a special key')
      .requiredOption('--key <key>', 'Key to press (e.g., Enter, Tab, Escape)')
      .option('--repeat <count>', 'Number of times to repeat', '1')
      .action(async (options) => {
        try {
          const { KeyboardCommand } = await import('../commands/keyboard.js');
          const keyboardCommand = new KeyboardCommand();
          
          const keyboardOptions: KeyboardOptions = {
            key: options.key,
            ...(options.repeat && { repeat: parseInt(options.repeat, 10) })
          };
          
          const result = await keyboardCommand.press(keyboardOptions);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Keyboard press failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });

    // Clear command
    keyboardCmd
      .command('clear')
      .description('Clear the current input field')
      .action(async () => {
        try {
          const { KeyboardCommand } = await import('../commands/keyboard.js');
          const keyboardCommand = new KeyboardCommand();
          
          const result = await keyboardCommand.clear();
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Keyboard clear failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });

    // Shortcut command
    keyboardCmd
      .command('shortcut')
      .description('Execute a predefined keyboard shortcut')
      .requiredOption('--name <name>', 'Shortcut name (copy, paste, cut, undo, redo, etc.)')
      .option('--repeat <count>', 'Number of times to repeat', '1')
      .action(async (options) => {
        try {
          const { KeyboardCommand } = await import('../commands/keyboard.js');
          const keyboardCommand = new KeyboardCommand();
          
          const repeat = parseInt(options.repeat, 10);
          const result = await keyboardCommand.shortcut(options.name, repeat);
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Keyboard shortcut failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
        }
      });
  }

  private registerInputCommands(): void {
    // Natural top-level fill command (unified input handling)
    this.program
      .command('fill <selector> <value>')
      .description('Fill input field with value')
      .option('--no-clear', 'Do not clear existing content before filling')
      .option('--method <method>', 'Input method (auto|paste|type|js)', 'auto')
      .option('--speed <ms>', 'Typing speed in milliseconds (for type method)', '50')
      .option('--window <index>', 'Target window index', '1')
      .option('--mask-secret', 'Mask value in logs (for sensitive data)')
      .option('--get-value', 'Get current value instead of filling (ignores <value>)')
      .action(async (selector, value, options) => {
        const action = options.getValue ? 'getValue' : 'fill';
        await this.executeInputCommand(action, selector, value, options);
      });

    // Grouped input commands (for advanced use cases)
    const inputCmd = this.program
      .command('input')
      .description('Advanced form input commands');

    // Get input value
    inputCmd
      .command('get-value')
      .description('Get current value of input field')
      .requiredOption('--selector <selector>', 'CSS selector for input element')
      .option('--window <index>', 'Target window index', '1')
      .option('--json', 'Output result as JSON')
      .action(async (options) => {
        await this.executeInputCommand('getValue', options.selector, undefined, { window: options.window });
        
        // Note: JSON output handling would need to be moved to executeInputCommand
        // for full consolidation, but keeping it simple for now
      });

    // Submit form
    inputCmd
      .command('submit')
      .description('Submit form')
      .requiredOption('--selector <selector>', 'CSS selector for form or submit button')
      .option('--window <index>', 'Target window index', '1')
      .option('--json', 'Output result as JSON')
      .action(async (options) => {
        try {
          const { InputCommand } = await import('../commands/input.js');
          const inputCommand = new InputCommand();
          
          const submitOptions: FormSubmitOptions = {
            selector: options.selector,
            windowIndex: parseInt(options.window, 10)
          };
          
          const result = await inputCommand.submit(submitOptions);
          
          if (options.json) {
            if (result.success) {
              this.formatter.outputJSON(result.data, undefined, result.code);
            } else {
              this.formatter.outputJSON(null, result.error, result.code);
            }
          } else {
            if (result.success) {
              this.formatter.output(result.data, undefined, result.code);
            } else {
              this.formatter.output(null, result.error, result.code);
            }
          }
        } catch (error) {
          if (options.json) {
            this.formatter.outputJSON(null, `Form submit failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
          } else {
            this.formatter.output(null, `Form submit failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
          }
        }
      });
  }

  private registerWaitCommand(): void {
    this.program
      .command('wait')
      .description('Wait for a specified duration')
      .option('--ms <milliseconds>', 'duration to wait in milliseconds', '800')
      .action(async (options) => {
        try {
          const { waitIdle } = await import('../commands/wait.js');
          
          const milliseconds = parseInt(options.ms, 10);
          
          if (isNaN(milliseconds)) {
            this.formatter.output(null, 'Invalid milliseconds value. Must be a number.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await waitIdle({ milliseconds });
          
          if (result.success) {
            this.formatter.output(result.data, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
          
        } catch (error) {
          this.formatter.output(null, `Wait command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerNetlogCommands(): void {
    const netlogCmd = this.program
      .command('netlog')
      .description('Network monitoring and logging commands');

    netlogCmd
      .command('start')
      .description('Start network monitoring')
      .option('--max-events <number>', 'maximum number of events to store', '100')
      .option('--body-limit <bytes>', 'maximum body preview size in bytes', '2048')
      .action(async (options) => {
        try {
          const { startNetworkMonitoring } = await import('../commands/netlog.js');
          
          const maxEvents = parseInt(options.maxEvents as string, 10);
          const bodyPreviewLimit = parseInt(options.bodyLimit as string, 10);
          
          if (isNaN(maxEvents) || maxEvents < 1 || maxEvents > 10000) {
            this.formatter.output(null, 'Invalid max-events value. Must be between 1 and 10000', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          if (isNaN(bodyPreviewLimit) || bodyPreviewLimit < 100 || bodyPreviewLimit > 100000) {
            this.formatter.output(null, 'Invalid body-limit value. Must be between 100 and 100000 bytes', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await startNetworkMonitoring({ 
            maxEvents, 
            bodyPreviewLimit 
          });
          
          if (result.success) {
            this.formatter.output(`Network monitoring started (max events: ${maxEvents}, body limit: ${bodyPreviewLimit} bytes)`);
          } else {
            this.formatter.output(null, result.error || 'Failed to start network monitoring', ERROR_CODES.CHROME_NOT_FOUND);
          }
        } catch (error) {
          this.formatter.output(null, `Network monitoring start failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    netlogCmd
      .command('stop')
      .description('Stop network monitoring')
      .action(async () => {
        try {
          const { stopNetworkMonitoring } = await import('../commands/netlog.js');
          const result = await stopNetworkMonitoring();
          
          if (result.success) {
            this.formatter.output('Network monitoring stopped');
          } else {
            this.formatter.output(null, result.error || 'Failed to stop network monitoring', ERROR_CODES.CHROME_NOT_FOUND);
          }
        } catch (error) {
          this.formatter.output(null, `Network monitoring stop failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    netlogCmd
      .command('dump')
      .description('Dump captured network events')
      .option('--format <format>', 'output format (json|har)', 'json')
      .action(async (options) => {
        try {
          const { dumpNetworkLog, convertToHAR } = await import('../commands/netlog.js');
          
          if (!['json', 'har'].includes(options.format)) {
            this.formatter.output(null, 'Invalid format. Must be "json" or "har"', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await dumpNetworkLog();
          
          if (!result.success) {
            this.formatter.output(null, result.error || 'Failed to dump network log', ERROR_CODES.CHROME_NOT_FOUND);
            return;
          }
          
          if (!result.data) {
            this.formatter.output(null, 'No network log data available', ERROR_CODES.TARGET_NOT_FOUND);
            return;
          }
          
          if (options.format === 'har') {
            const harData = convertToHAR(result.data.events);
            this.formatter.output(harData);
          } else {
            this.formatter.output(result.data);
          }
        } catch (error) {
          this.formatter.output(null, `Network log dump failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    netlogCmd
      .command('clear')
      .description('Clear captured network events')
      .action(async () => {
        try {
          const { clearNetworkLog } = await import('../commands/netlog.js');
          const result = await clearNetworkLog();
          
          if (result.success) {
            this.formatter.output('Network log cleared');
          } else {
            this.formatter.output(null, result.error || 'Failed to clear network log', ERROR_CODES.CHROME_NOT_FOUND);
          }
        } catch (error) {
          this.formatter.output(null, `Network log clear failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerSnapshotCommands(): void {
    const snapshotCmd = this.program
      .command('snapshot')
      .description('Page structure extraction commands');

    snapshotCmd
      .command('outline')
      .description('Capture flat list of interactive elements')
      .option('--visible-only', 'only include visible elements')
      .action(async (options) => {
        try {
          const { captureOutline, formatSnapshotResult } = await import('../commands/snapshot.js');
          const result = await captureOutline({ visibleOnly: options.visibleOnly });
          const formattedResult = formatSnapshotResult(result);
          
          if ('ok' in formattedResult && formattedResult.ok) {
            this.formatter.output(formattedResult);
          } else {
            const error = 'error' in formattedResult ? formattedResult.error : 'Snapshot failed';
            const code = 'code' in formattedResult ? formattedResult.code : ERROR_CODES.UNKNOWN_ERROR;
            this.formatter.output(null, error || 'Snapshot failed', code);
          }
        } catch (error) {
          this.formatter.output(null, `Snapshot outline failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    snapshotCmd
      .command('dom-lite')
      .description('Capture pruned DOM hierarchy')
      .option('--max-depth <depth>', 'maximum traversal depth', '10')
      .option('--visible-only', 'only include visible elements')
      .option('--mode <mode>', 'dom-lite algorithm (full|simple)', 'full')
      .action(async (options) => {
        try {
          const { captureDomLite, formatSnapshotResult } = await import('../commands/snapshot.js');
          const maxDepth = parseInt(options.maxDepth, 10) || 10;
          const result = await captureDomLite({ 
            maxDepth, 
            visibleOnly: options.visibleOnly,
            mode: options.mode === 'simple' ? 'simple' : 'full'
          });
          const formattedResult = formatSnapshotResult(result);
          
          if ('ok' in formattedResult && formattedResult.ok) {
            this.formatter.output(formattedResult);
          } else {
            const error = 'error' in formattedResult ? formattedResult.error : 'Snapshot failed';
            const code = 'code' in formattedResult ? formattedResult.code : ERROR_CODES.UNKNOWN_ERROR;
            this.formatter.output(null, error || 'Snapshot failed', code);
          }
        } catch (error) {
          this.formatter.output(null, `Snapshot dom-lite failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerScrollCommands(): void {
    const scrollCmd = this.program
      .command('scroll')
      .description('Page scrolling commands');

    scrollCmd
      .command('to')
      .description('Scroll to element (centers in viewport)')
      .requiredOption('--selector <selector>', 'CSS selector for element')
      .option('--smooth', 'use smooth scrolling animation')
      .option('--tab <index>', 'tab index (1-based)', '1')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { scrollToElement } = await import('../commands/scroll.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const tabIndex = parseInt(options.tab, 10);
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(String(globalOpts.timeout || '30000'), 10);
          
          const result = await scrollToElement(
            options.selector,
            options.smooth || false,
            tabIndex,
            windowIndex,
            timeoutMs
          );
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Scroll command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    scrollCmd
      .command('by')
      .description('Scroll by pixel amount')
      .requiredOption('--px <pixels>', 'number of pixels to scroll')
      .option('--smooth', 'use smooth scrolling animation')
      .option('--horizontal', 'scroll horizontally instead of vertically')
      .option('--tab <index>', 'tab index (1-based)', '1')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { scrollByPixels } = await import('../commands/scroll.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const pixels = parseInt(options.px, 10);
          const tabIndex = parseInt(options.tab, 10);
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(String(globalOpts.timeout || '30000'), 10);
          const direction = options.horizontal ? 'horizontal' : 'vertical';
          
          if (isNaN(pixels)) {
            this.formatter.output(null, 'Invalid pixel value. Must be a number.', ERROR_CODES.INVALID_INPUT);
            return;
          }
          
          const result = await scrollByPixels(
            pixels,
            options.smooth || false,
            direction,
            tabIndex,
            windowIndex,
            timeoutMs
          );
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Scroll command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    scrollCmd
      .command('position')
      .description('Get current scroll position')
      .option('--tab <index>', 'tab index (1-based)', '1')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { getScrollPosition } = await import('../commands/scroll.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const tabIndex = parseInt(options.tab, 10);
          const windowIndex = parseInt(options.window, 10);
          const timeoutMs = parseInt(String(globalOpts.timeout || '30000'), 10);
          
          const result = await getScrollPosition(
            tabIndex,
            windowIndex,
            timeoutMs
          );
          
          if (result.success) {
            this.formatter.output(result.data);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Scroll command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerFilesCommands(): void {
    const filesCmd = this.program
      .command('files')
      .description('File upload and management commands');

    filesCmd
      .command('upload')
      .description('Upload files to a file input element')
      .requiredOption('--selector <selector>', 'CSS selector for file input element')
      .requiredOption('--path <path>', 'file path or comma-separated paths for multiple files')
      .option('--multiple', 'enable multiple file selection')
      .action(async (options) => {
        try {
          const globalOpts = this.program.opts() as GlobalOptions;
          const timeout = parseInt(String(globalOpts.timeout || '30000'), 10);
          
          const { uploadFiles } = await import('../commands/files.js');
          const result = await uploadFiles({
            selector: options.selector,
            path: options.path,
            multiple: options.multiple || false,
            timeout
          });
          
          if (result.success) {
            const message = `Successfully uploaded ${result.totalFiles} file(s): ${result.filesUploaded.join(', ')}`;
            this.formatter.output(message, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `File upload failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    filesCmd
      .command('dragdrop')
      .description('Simulate drag and drop file upload to a dropzone')
      .requiredOption('--selector <selector>', 'CSS selector for dropzone element')
      .requiredOption('--path <path>', 'file path or comma-separated paths for multiple files')
      .option('--multiple', 'enable multiple file selection')
      .action(async (options) => {
        try {
          const globalOpts = this.program.opts() as GlobalOptions;
          const timeout = parseInt(String(globalOpts.timeout || '30000'), 10);
          
          const { dragDropFiles } = await import('../commands/files.js');
          const result = await dragDropFiles({
            selector: options.selector,
            path: options.path,
            multiple: options.multiple || false,
            timeout
          });
          
          if (result.success) {
            const message = `Successfully simulated drag and drop for ${result.totalFiles} file(s): ${result.filesUploaded.join(', ')}`;
            this.formatter.output(message, undefined, result.code);
          } else {
            this.formatter.output(null, result.error, result.code);
          }
        } catch (error) {
          this.formatter.output(null, `Drag and drop operation failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerDomCommands(): void {
    const domCmd = this.program
      .command('dom')
      .description('DOM evaluation and JavaScript execution commands');

    domCmd
      .command('eval')
      .description('Execute JavaScript in the Chrome page context')
      .requiredOption('--js <javascript>', 'JavaScript code to execute')
      .option('--tab <index>', 'tab index (1-based)', '1')
      .option('--window <index>', 'Target window index', '1')
      .action(async (options) => {
        try {
          const { domEval, formatDomEvalResult } = await import('../commands/dom.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const tabIndex = parseInt(options.tab, 10);
          const windowIndex = parseInt(options.window, 10);
          const timeout = parseInt(String(globalOpts.timeout || '10000'), 10);
          
          const result = await domEval({
            js: options.js,
            tabIndex,
            windowIndex,
            timeout
          });
          
          const formattedResult = formatDomEvalResult(result);
          
          if (formattedResult.success && formattedResult.data) {
            const globalOpts = this.program.opts() as GlobalOptions;
            
            if (globalOpts.json) {
              this.formatter.output(formattedResult.data);
            } else {
              // Human-readable output
              const data = formattedResult.data;
              if (data.success) {
                console.log(`✅ JavaScript executed successfully (${data.meta.executionTimeMs}ms)`);
                console.log(`📊 Result size: ${data.meta.resultSize} bytes${data.meta.truncated ? ' (truncated)' : ''}`);
                
                if (data.result !== undefined) {
                  console.log('📄 Result:');
                  console.log(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2));
                }
                
                if (data.meta.serializationWarning) {
                  console.log(`⚠️ Serialization warning: ${data.meta.serializationWarning}`);
                }
              } else {
                console.log(`❌ JavaScript execution failed: ${data.error}`);
              }
            }
          } else {
            this.formatter.output(null, formattedResult.error || 'DOM evaluation failed', formattedResult.code);
          }
        } catch (error) {
          this.formatter.output(null, `DOM evaluation failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }

  private registerMetaCommands(): void {
    const metaCmd = this.program
      .command('meta')
      .description('CLI information and statistics commands');

    metaCmd
      .command('info')
      .description('Show CLI version, capabilities, and implementation status')
      .action(async () => {
        try {
          const { getMetaInfo, formatMetaOutput } = await import('../commands/meta.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const result = await getMetaInfo();
          
          if (globalOpts.json) {
            this.formatter.output(result.data, result.error, result.code);
          } else {
            if (result.success) {
              console.log(formatMetaOutput(result));
            } else {
              this.formatter.output(null, result.error || 'Failed to get meta information', result.code);
            }
          }
        } catch (error) {
          this.formatter.output(null, `Meta info command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    metaCmd
      .command('stats')
      .description('Show CLI runtime statistics and performance metrics')
      .action(async () => {
        try {
          const { getCliStats, formatStatsOutput } = await import('../commands/meta.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const result = await getCliStats();
          
          if (globalOpts.json) {
            this.formatter.output(result.data, result.error, result.code);
          } else {
            if (result.success) {
              console.log(formatStatsOutput(result));
            } else {
              this.formatter.output(null, result.error || 'Failed to get CLI statistics', result.code);
            }
          }
        } catch (error) {
          this.formatter.output(null, `Meta stats command failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    metaCmd
      .command('commands')
      .description('List all available commands with descriptions and status')
      .action(async () => {
        try {
          const { getCommands, formatCommandsOutput } = await import('../commands/meta.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const result = await getCommands();
          
          if (globalOpts.json) {
            this.formatter.output(result.data, result.error, result.code);
          } else {
            if (result.success) {
              console.log(formatCommandsOutput(result));
            } else {
              this.formatter.output(null, result.error || 'Failed to get command information', result.code);
            }
          }
        } catch (error) {
          this.formatter.output(null, `Meta commands failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    metaCmd
      .command('permissions')
      .description('Show permission requirements for all features')
      .action(async () => {
        try {
          const { getPermissions, formatPermissionsOutput } = await import('../commands/meta.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const result = await getPermissions();
          
          if (globalOpts.json) {
            this.formatter.output(result.data, result.error, result.code);
          } else {
            if (result.success) {
              console.log(formatPermissionsOutput(result));
            } else {
              this.formatter.output(null, result.error || 'Failed to get permission information', result.code);
            }
          }
        } catch (error) {
          this.formatter.output(null, `Meta permissions failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });

    metaCmd
      .command('performance')
      .description('Show performance statistics and optimization recommendations')
      .action(async () => {
        try {
          const { getPerformanceInfo } = await import('../commands/meta.js');
          const globalOpts = this.program.opts() as GlobalOptions;
          
          const result = await getPerformanceInfo();
          
          if (globalOpts.json) {
            this.formatter.output(result.data, result.error, result.code);
          } else {
            if (result.success && result.data) {
              const data = result.data;
              console.log('📊 Performance Statistics\n');
              
              console.log('💾 Cache Status:');
              console.log(`   Script Cache: ${data.stats.cacheStats.scriptCache.size}/${data.stats.cacheStats.scriptCache.maxSize} entries`);
              console.log(`   Coords Cache: ${data.stats.cacheStats.coordsCache.size}/${data.stats.cacheStats.coordsCache.maxSize} entries`);
              console.log();
              
              console.log('🔗 Connection Pool:');
              console.log(`   Active: ${data.stats.connectionPool.activeConnections}/${data.stats.connectionPool.maxConnections} connections`);
              console.log();
              
              console.log('💭 Memory Usage:');
              console.log(`   RSS: ${data.stats.memory.rss} MB`);
              console.log(`   Heap Used: ${data.stats.memory.heapUsed} MB`);
              console.log(`   Heap Total: ${data.stats.memory.heapTotal} MB`);
              console.log(`   External: ${data.stats.memory.external} MB`);
              console.log();
              
              console.log('💡 Recommendations:');
              data.recommendations.forEach((rec: string) => {
                console.log(`   • ${rec}`);
              });
            } else {
              this.formatter.output(null, result.error || 'Failed to get performance information', result.code);
            }
          }
        } catch (error) {
          this.formatter.output(null, `Meta performance failed: ${error}`, ERROR_CODES.UNKNOWN_ERROR);
        }
      });
  }


  private async registerBenchmarkCommand(): Promise<void> {
    // Add benchmark command
    try {
      const { createBenchmarkCommand } = await import('../commands/benchmark.js');
      this.program.addCommand(createBenchmarkCommand());
    } catch (error) {
      // Benchmark command is optional, don't fail if it can't be loaded
      console.warn('Warning: Benchmark command could not be loaded');
    }
  }

  private async executeScreenshotCommand(url: string | undefined, options: {
    out?: string;
    format: string;
    quality?: string;
    saveFile?: boolean;
    wait?: boolean;
    timeout: string;
    window: string;
    selector?: string;
    fullscreen?: boolean;
  }): Promise<void> {
    try {
      const windowIndex = parseInt(options.window, 10);
      const timeoutMs = parseInt(options.timeout, 10);
      
      if (isNaN(windowIndex) || windowIndex < 1) {
        this.formatter.output(null, 'Invalid window index. Must be a positive integer.', ErrorCode.INVALID_INPUT);
        return;
      }
      
      if (isNaN(timeoutMs) || timeoutMs < 1000) {
        this.formatter.output(null, 'Invalid timeout. Must be at least 1000ms.', ErrorCode.INVALID_INPUT);
        return;
      }

      // If URL provided, navigate first
      if (url) {
        const { NavigationCommand } = await import('../commands/navigation.js');
        const navCmd = new NavigationCommand();
        
        const navResult = await navCmd.go(url, {
          windowIndex,
          waitForLoad: options.wait,
          timeoutMs
        });
        
        if (!navResult.success) {
          this.formatter.output(null, `Navigation failed: ${navResult.error}`, navResult.code);
          return;
        }
      }

      // Take screenshot
      const { ScreenshotCommand } = await import('../commands/screenshot.js');
      const container = await this.getServiceContainer();
      const screenshotCmd = new ScreenshotCommand(container);
      
      const format = options.format as 'png' | 'jpg' | 'pdf';
      const screenshotOptions: ScreenshotOptions = {
        outputPath: options.out,
        format,
        windowIndex,
        saveFile: options.saveFile,
        ...(format === 'jpg' && options.quality && { quality: parseInt(options.quality, 10) })
      };
      
      let result;
      
      if (options.fullscreen) {
        result = await screenshotCmd.fullscreen(screenshotOptions);
      } else if (options.selector) {
        result = await screenshotCmd.element(options.selector, screenshotOptions);
      } else {
        result = await screenshotCmd.viewport(screenshotOptions);
      }
      
      if (result.success) {
        this.formatter.output(result.data);
      } else {
        this.formatter.output(null, result.error, result.code);
      }
    } catch (error) {
      this.formatter.output(null, `Screenshot command failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
    }
  }

  private async executeMouseCommand(selector: string, action: 'click' | 'doubleClick' | 'rightClick' | 'move', options: {
    button?: string;
    clickCount?: string;
    offsetX?: string;
    offsetY?: string;
    window: string;
  }): Promise<void> {
    try {
      const { MouseCommand } = await import('../commands/mouse.js');
      const mouseCommand = new MouseCommand();
      
      const mouseOptions: MouseOptions = {
        selector,
        ...(options.button && { button: options.button as 'left' | 'right' | 'middle' }),
        ...(options.clickCount && { clickCount: parseInt(options.clickCount, 10) }),
        ...(options.offsetX && { offsetX: parseFloat(options.offsetX) }),
        ...(options.offsetY && { offsetY: parseFloat(options.offsetY) }),
        windowIndex: parseInt(options.window, 10)
      };
      
      let result;
      
      switch (action) {
        case 'click':
          result = await mouseCommand.click(mouseOptions);
          break;
        case 'doubleClick':
          result = await mouseCommand.doubleClick(mouseOptions);
          break;
        case 'rightClick':
          result = await mouseCommand.rightClick(mouseOptions);
          break;
        case 'move':
          result = await mouseCommand.move(mouseOptions);
          break;
        default:
          this.formatter.output(null, `Unknown mouse action: ${action}`, ErrorCode.INVALID_INPUT);
          return;
      }
      
      if (result.success) {
        this.formatter.output(result.data);
      } else {
        this.formatter.output(null, result.error, result.code);
      }
    } catch (error) {
      this.formatter.output(null, `${action} command failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
    }
  }

  private async executeKeyboardCommand(action: 'type' | 'combo', options: {
    text?: string;
    combo?: string;
    speed?: string;
    clear?: boolean;
    repeat?: string;
  }): Promise<void> {
    try {
      const { KeyboardCommand } = await import('../commands/keyboard.js');
      const keyboardCommand = new KeyboardCommand();
      
      const keyboardOptions: KeyboardOptions = {
        ...(options.text && { text: options.text }),
        ...(options.combo && { combo: options.combo }),
        ...(options.speed && { speed: parseInt(options.speed, 10) }),
        ...(options.clear && { clear: options.clear }),
        ...(options.repeat && { repeat: parseInt(options.repeat, 10) })
      };
      
      let result;
      
      switch (action) {
        case 'type':
          result = await keyboardCommand.type(keyboardOptions);
          break;
        case 'combo':
          result = await keyboardCommand.combo(keyboardOptions);
          break;
        default:
          this.formatter.output(null, `Unknown keyboard action: ${action}`, ErrorCode.INVALID_INPUT);
          return;
      }
      
      if (result.success) {
        this.formatter.output(result.data);
      } else {
        this.formatter.output(null, result.error, result.code);
      }
    } catch (error) {
      this.formatter.output(null, `${action} command failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
    }
  }

  private async executeInputCommand(action: 'fill' | 'getValue', selector: string, value: string | undefined, options: {
    noClear?: boolean;
    method?: string;
    speed?: string;
    window: string;
    maskSecret?: boolean;
  }): Promise<void> {
    try {
      const { InputCommand } = await import('../commands/input.js');
      const inputCommand = new InputCommand();
      
      let result;
      
      switch (action) {
        case 'fill':
          if (!value) {
            this.formatter.output(null, 'Value is required for fill operation', ErrorCode.INVALID_INPUT);
            return;
          }
          
          const fillOptions: InputOptions = {
            selector,
            value,
            clear: !options.noClear,
            method: options.method as 'auto' | 'paste' | 'type' | 'js',
            speed: parseInt(options.speed || '50', 10),
            windowIndex: parseInt(options.window, 10),
            maskSecret: options.maskSecret
          };
          
          result = await inputCommand.fill(fillOptions);
          break;
          
        case 'getValue':
          const valueOptions: InputValueOptions = {
            selector,
            windowIndex: parseInt(options.window, 10)
          };
          
          result = await inputCommand.getValue(valueOptions);
          break;
          
        default:
          this.formatter.output(null, `Unknown input action: ${action}`, ErrorCode.INVALID_INPUT);
          return;
      }
      
      if (result.success) {
        this.formatter.output(result.data, undefined, result.code);
      } else {
        this.formatter.output(null, result.error, result.code);
      }
    } catch (error) {
      this.formatter.output(null, `${action} command failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
    }
  }

  private async executeGenericCommand<T, R>(
    commandModule: string,
    commandClass: string,
    method: string,
    options: T,
    actionName?: string
  ): Promise<void> {
    try {
      const module = await import(commandModule);
      const CommandClass = module[commandClass];
      const commandInstance = new CommandClass();
      
      const result: Result<R> = await commandInstance[method](options);
      
      if (result.success) {
        this.formatter.output(result.data, undefined, result.code);
      } else {
        this.formatter.output(null, result.error, result.code);
      }
    } catch (error) {
      const name = actionName || method;
      this.formatter.output(null, `${name} command failed: ${error}`, ErrorCode.UNKNOWN_ERROR);
    }
  }
}
