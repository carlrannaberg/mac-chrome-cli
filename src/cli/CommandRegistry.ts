import { Command } from 'commander';
import { OutputFormatter, GlobalOptions } from './OutputFormatter.js';
import { ERROR_CODES } from '../lib/util.js';

/**
 * Central registry for all CLI commands
 * Handles command registration and execution
 */
export class CommandRegistry {
  private program: Command;
  private formatter: OutputFormatter;

  constructor(program: Command, formatter: OutputFormatter) {
    this.program = program;
    this.formatter = formatter;
  }

  /**
   * Register all CLI commands
   */
  async registerAll(): Promise<void> {
    this.registerTestCommand();
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

  private registerTestCommand(): void {
    this.program
      .command('test')
      .description('Test command to verify CLI is working')
      .action(() => {
        this.formatter.output('mac-chrome-cli is working! 🚀');
      });
  }

  private registerDoctorCommand(): void {
    this.program
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
  }

  private registerNavigationCommands(): void {
    const navCmd = this.program
      .command('nav')
      .description('Navigation and page control commands');

    navCmd
      .command('go')
      .description('Navigate to URL')
      .requiredOption('--url <url>', 'URL to navigate to')
      .action(async () => {
        this.formatter.output(null, 'Navigation commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    navCmd
      .command('reload')
      .description('Reload current page')
      .option('--hard', 'perform hard reload (bypass cache)')
      .action(async () => {
        this.formatter.output(null, 'Navigation commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    navCmd
      .command('back')
      .description('Navigate back in history')
      .action(async () => {
        this.formatter.output(null, 'Navigation commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    navCmd
      .command('forward')
      .description('Navigate forward in history')
      .action(async () => {
        this.formatter.output(null, 'Navigation commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });
  }

  private registerTabCommands(): void {
    const tabCmd = this.program
      .command('tab')
      .description('Tab management commands');

    tabCmd
      .command('focus')
      .description('Focus tab by match criteria')
      .option('--match <pattern>', 'pattern to match tab title or URL')
      .action(async () => {
        this.formatter.output(null, 'Tab commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });
  }

  private registerScreenshotCommands(): void {
    const shotCmd = this.program
      .command('shot')
      .description('Screenshot capture commands');

    shotCmd
      .command('viewport')
      .description('Capture viewport screenshot')
      .action(async () => {
        this.formatter.output(null, 'Screenshot commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    shotCmd
      .command('window')
      .description('Capture window screenshot')
      .action(async () => {
        this.formatter.output(null, 'Screenshot commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    shotCmd
      .command('element')
      .description('Capture element screenshot')
      .requiredOption('--selector <selector>', 'CSS selector for element')
      .action(async () => {
        this.formatter.output(null, 'Screenshot commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });
  }

  private registerMouseCommands(): void {
    const mouseCmd = this.program
      .command('mouse')
      .description('Mouse interaction commands');

    mouseCmd
      .command('click')
      .description('Click at coordinates or element')
      .option('--selector <selector>', 'CSS selector for element')
      .option('--x <x>', 'X coordinate')
      .option('--y <y>', 'Y coordinate')
      .option('--button <button>', 'mouse button (left|right|middle)', 'left')
      .action(async () => {
        this.formatter.output(null, 'Mouse commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    mouseCmd
      .command('move')
      .description('Move mouse to coordinates or element')
      .option('--selector <selector>', 'CSS selector for element')
      .option('--x <x>', 'X coordinate')
      .option('--y <y>', 'Y coordinate')
      .action(async () => {
        this.formatter.output(null, 'Mouse commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });
  }

  private registerKeyboardCommands(): void {
    const keyboardCmd = this.program
      .command('keyboard')
      .description('Keyboard input commands');

    keyboardCmd
      .command('type')
      .description('Type text')
      .requiredOption('--text <text>', 'text to type')
      .option('--speed <ms>', 'delay between characters in ms', '50')
      .action(async () => {
        this.formatter.output(null, 'Keyboard commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });

    keyboardCmd
      .command('keys')
      .description('Send key combination')
      .requiredOption('--combo <combo>', 'key combination (e.g., cmd+shift+r)')
      .action(async () => {
        this.formatter.output(null, 'Keyboard commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
      });
  }

  private registerInputCommands(): void {
    const inputCmd = this.program
      .command('input')
      .description('Form input commands');

    inputCmd
      .command('fill')
      .description('Fill input field')
      .requiredOption('--selector <selector>', 'CSS selector for input')
      .requiredOption('--value <value>', 'value to fill')
      .option('--clear', 'clear field before filling')
      .action(async () => {
        this.formatter.output(null, 'Input commands not yet implemented', ERROR_CODES.UNKNOWN_ERROR);
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
      .action(async (options) => {
        try {
          const { captureDomLite, formatSnapshotResult } = await import('../commands/snapshot.js');
          const maxDepth = parseInt(options.maxDepth, 10) || 10;
          const result = await captureDomLite({ 
            maxDepth, 
            visibleOnly: options.visibleOnly 
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
      .option('--window <index>', 'window index (1-based)', '1')
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
      .option('--window <index>', 'window index (1-based)', '1')
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
      .option('--window <index>', 'window index (1-based)', '1')
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
      .option('--window <index>', 'window index (1-based)', '1')
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
}
