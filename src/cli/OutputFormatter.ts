import { ErrorCode } from '../core/index.js';
import { createFormattedResponse, LegacyCompatibility } from '../core/ErrorUtils.js';

export interface GlobalOptions {
  json?: boolean;
  timeout?: number;
  previewMax?: number;
  out?: string;
}

export interface OutputFormatterOptions {
  json?: boolean;
}

/**
 * Unified output formatter for CLI results
 * Handles both JSON and human-readable output formats
 */
export class OutputFormatter {
  private options: OutputFormatterOptions;
  private getGlobalOptions: (() => GlobalOptions) | undefined;

  constructor(options: OutputFormatterOptions = {}, getGlobalOptions?: () => GlobalOptions) {
    this.options = options;
    this.getGlobalOptions = getGlobalOptions;
  }

  /**
   * Output a result with appropriate formatting
   * 
   * Enhanced with unified error handling and context tracking
   */
  output<T>(
    result: T,
    error?: string,
    code: ErrorCode = ErrorCode.OK
  ): void {
    // Convert to new Result format
    const resultData = code === ErrorCode.OK && !error ? 
      { success: true, data: result, code, timestamp: new Date().toISOString() } :
      { success: false, error: error || 'Unknown error', code, timestamp: new Date().toISOString() };
    
    const convertedResult = LegacyCompatibility.fromLegacyFormat(resultData);
    
    // Get the current formatting preference
    const shouldUseJson = this.shouldUseJson();
    
    const formatted = createFormattedResponse(convertedResult, { 
      json: shouldUseJson,
      detailed: !shouldUseJson,
      includeRecovery: !shouldUseJson
    });
    
    if (formatted.isError) {
      console.error(formatted.output);
    } else {
      console.log(formatted.output);
    }
    
    // Set exit code
    process.exitCode = formatted.exitCode;
  }

  /**
   * Output JSON result regardless of format setting
   */
  outputJSON<T>(
    result: T,
    error?: string,
    code: ErrorCode = ErrorCode.OK
  ): void {
    // Convert to new Result format
    const resultData = code === ErrorCode.OK && !error ? 
      { success: true, data: result, code, timestamp: new Date().toISOString() } :
      { success: false, error: error || 'Unknown error', code, timestamp: new Date().toISOString() };
    
    const convertedResult = LegacyCompatibility.fromLegacyFormat(resultData);
    
    const formatted = createFormattedResponse(convertedResult, { 
      json: true,
      detailed: true,
      includeRecovery: true,
      includeContext: true
    });
    
    console.log(formatted.output);
    process.exitCode = formatted.exitCode;
  }

  /**
   * Output human-readable result regardless of format setting
   */
  outputHuman(message: string, isError: boolean = false): void {
    if (isError) {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Create a new formatter with updated options
   */
  withOptions(options: Partial<OutputFormatterOptions>): OutputFormatter {
    return new OutputFormatter({ ...this.options, ...options }, this.getGlobalOptions);
  }

  /**
   * Determine if JSON output should be used
   */
  private shouldUseJson(): boolean {
    // If we have a dynamic global options getter, use that
    if (this.getGlobalOptions) {
      const globalOpts = this.getGlobalOptions();
      return globalOpts.json || false;
    }
    
    // Fall back to static options
    return this.options.json || false;
  }
}
