import { Command } from 'commander';
import { OutputFormatter, GlobalOptions } from './OutputFormatter.js';
import { CommandRegistry } from './CommandRegistry.js';
import { ErrorCode } from '../core/index.js';
import { createFormattedResponse, ErrorUtils } from '../core/ErrorUtils.js';
import { createServiceContainer } from '../di/ServiceRegistry.js';
import { SERVICE_TOKENS } from '../di/ServiceTokens.js';
import { initializeLogger } from '../lib/logger.js';
import type { IServiceContainer, ServiceContainer } from '../di/ServiceContainer.js';

/**
 * Main CLI application class
 * Orchestrates the entire CLI application lifecycle
 */
export class MacChromeCLI {
  private program: Command;
  private formatter: OutputFormatter;
  private registry: CommandRegistry;
  private serviceContainer?: IServiceContainer;

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
      const formatted = createFormattedResponse(errorResult, { json: globalOpts.json ?? false });
      
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
   * Initialize service container and global services
   */
  private async initializeServices(): Promise<void> {
    try {
      this.serviceContainer = await createServiceContainer();
      
      // Initialize global logger
      const loggerResult = await this.serviceContainer.resolve(SERVICE_TOKENS.LoggerService);
      if (loggerResult.success) {
        initializeLogger(loggerResult.data);
      }
    } catch (error) {
      // If service initialization fails, continue without DI services
      // The logger utility will fall back to a basic logger
      console.warn('Warning: Failed to initialize services, falling back to basic logging');
    }
  }

  /**
   * Register all commands with the program
   */
  private async registerCommands(): Promise<void> {
    // Pass service container to registry if available
    if (this.serviceContainer) {
      this.registry.setServiceContainer(this.serviceContainer);
    }
    await this.registry.registerAll();
  }


  /**
   * Run the CLI application
   */
  async run(args?: string[]): Promise<void> {
    try {
      // Initialize services first
      await this.initializeServices();
      
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
        json: globalOpts.json ?? false,
        detailed: true,
        includeRecovery: true
      });
      
      if (formatted.isError) {
        console.error(formatted.output);
      } else {
        console.log(formatted.output);
      }
      
      process.exit(formatted.exitCode);
    } finally {
      // Ensure cleanup always happens
      await this.cleanup();
    }
  }

  /**
   * Cleanup method to dispose of services and resources
   */
  private async cleanup(): Promise<void> {
    if (this.serviceContainer && 'dispose' in this.serviceContainer) {
      (this.serviceContainer as ServiceContainer).dispose();
    }
  }

  /**
   * Handle process termination gracefully
   * @throws {Error} When service container cleanup fails
   */
  public async shutdown(): Promise<void> {
    await this.cleanup();
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

  /**
   * Get the service container instance (for testing and command access)
   */
  getServiceContainer(): IServiceContainer | undefined {
    return this.serviceContainer;
  }
}
