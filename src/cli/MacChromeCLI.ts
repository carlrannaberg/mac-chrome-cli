import { Command } from 'commander';
import { OutputFormatter, GlobalOptions } from './OutputFormatter.js';
import { CommandRegistry } from './CommandRegistry.js';
import { ErrorCode, error } from '../core/index.js';
import { createFormattedResponse, ErrorUtils } from '../core/ErrorUtils.js';

/**
 * Main CLI application class
 * Orchestrates the entire CLI application lifecycle
 */
export class MacChromeCLI {
  private program: Command;
  private formatter: OutputFormatter;
  private registry: CommandRegistry;

  constructor() {
    this.program = new Command();
    // Initialize formatter with dynamic global options access
    this.formatter = new OutputFormatter({}, () => this.program.opts() as GlobalOptions);
    this.registry = new CommandRegistry(this.program, this.formatter);
    
    this.setupProgram();
    this.setupGlobalOptions();
    this.setupErrorHandling();
  }

  /**
   * Configure the main program
   */
  private setupProgram(): void {
    this.program
      .name('mac-chrome-cli')
      .description('Command-line interface for controlling Google Chrome on macOS')
      .version('1.0.0');
  }

  /**
   * Set up global options
   */
  private setupGlobalOptions(): void {
    this.program
      .option('--json', 'output in JSON format')
      .option('--timeout <ms>', 'command timeout in milliseconds', '30000')
      .option('--preview-max <bytes>', 'maximum preview size in bytes', '1572864') // 1.5MB
      .option('--out <path>', 'output file path for screenshots/files');
  }

  /**
   * Set up error handling and unknown command handling
   */
  private setupErrorHandling(): void {
    // Handle unknown commands
    this.program.on('command:*', () => {
      const unknownCommand = this.program.args.join(' ');
      const errorResult = ErrorUtils.validationError(
        `Invalid command: ${unknownCommand}\nSee --help for a list of available commands.`,
        'command',
        unknownCommand
      );
      
      const globalOpts = this.program.opts() as GlobalOptions;
      const formatted = createFormattedResponse(errorResult, { json: globalOpts.json });
      
      if (formatted.isError) {
        console.error(formatted.output);
      } else {
        console.log(formatted.output);
      }
      
      process.exit(formatted.exitCode);
    });

    // Error handling
    this.program.exitOverride();
  }

  /**
   * Register all commands with the program
   */
  private async registerCommands(): Promise<void> {
    await this.registry.registerAll();
  }


  /**
   * Run the CLI application
   */
  async run(args?: string[]): Promise<void> {
    try {
      // Register all commands
      await this.registerCommands();
      
      // Parse arguments
      await this.program.parseAsync(args);
      
    } catch (err) {
      const errorResult = ErrorUtils.fromException(
        err,
        'cli-initialization',
        ErrorCode.INVALID_INPUT
      );
      
      const globalOpts = this.program.opts() as GlobalOptions;
      const formatted = createFormattedResponse(errorResult, { 
        json: globalOpts.json,
        detailed: true,
        includeRecovery: true
      });
      
      if (formatted.isError) {
        console.error(formatted.output);
      } else {
        console.log(formatted.output);
      }
      
      process.exit(formatted.exitCode);
    }
  }

  /**
   * Get the Commander program instance (for testing)
   */
  getProgram(): Command {
    return this.program;
  }

  /**
   * Get the output formatter instance (for testing)
   */
  getFormatter(): OutputFormatter {
    return this.formatter;
  }

  /**
   * Get the command registry instance (for testing)
   */
  getRegistry(): CommandRegistry {
    return this.registry;
  }
}
