import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { Result, ok, error, type ResultContext } from '../core/Result.js';
import { ErrorCode, ERROR_CODES } from '../core/ErrorCodes.js';

// Re-export core types for backward compatibility
export { ErrorCode, ERROR_CODES } from '../core/ErrorCodes.js';
export type { Result, ResultContext } from '../core/Result.js';

// Legacy type alias for backward compatibility
/** @deprecated Use ErrorCode from core/ErrorCodes.js instead */
export type LegacyErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Process execution data
 */
export interface ExecData {
  stdout: string;
  stderr: string;
  command?: string;
}

/**
 * Process execution result using unified Result<T,E> pattern
 */
export type ExecResult = Result<ExecData, string>;

/**
 * Legacy ExecResult interface for backward compatibility
 * @deprecated Use ExecResult (Result<ExecData, string>) instead
 */
export interface LegacyExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: ErrorCode;
  command?: string;
}

/**
 * JSON output result using unified Result<T,E> pattern
 */
export type JSONResult<T = unknown> = Result<T, string>;

/**
 * Legacy JSONResult interface for backward compatibility
 * @deprecated Use JSONResult (Result<T, string>) instead
 */
export interface LegacyJSONResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code: ErrorCode;
  timestamp: string;
}

/**
 * Execute a command with timeout and proper error handling using unified Result<T,E> pattern
 * 
 * @param command Command to execute
 * @param args Command arguments array
 * @param timeoutMs Timeout in milliseconds (default: 30000)
 * @returns Promise resolving to execution result
 * 
 * @throws {ErrorCode.INVALID_INPUT} When command is empty or arguments are malformed
 * @throws {ErrorCode.TIMEOUT} When command execution exceeds timeout
 * @throws {ErrorCode.PROCESS_FAILED} When command fails to start or execute
 * @throws {ErrorCode.PERMISSION_DENIED} When insufficient permissions to execute command
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent execution
 * @throws {ErrorCode.UNKNOWN_ERROR} When unexpected errors occur during execution
 */
export async function execWithTimeout(
  command: string,
  args: string[] = [],
  timeoutMs: number = 30000
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const startTime = Date.now();
    const fullCommand = `${command} ${args.join(' ')}`;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      resolve(error('Command timed out', ErrorCode.TIMEOUT, {
        durationMs: Date.now() - startTime,
        recoveryHint: 'retry',
        metadata: { command: fullCommand, timeoutMs }
      }));
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (timedOut) return;
      
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      const execData: ExecData = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command: fullCommand
      };
      
      const context: ResultContext = {
        durationMs: duration,
        metadata: { exitCode: code, command: fullCommand }
      };
      
      if (code === 0) {
        resolve(ok(execData, ErrorCode.OK, context));
      } else {
        // Use stderr content as the error message if available, otherwise use generic message
        const errorMessage = stderr.trim() || `Process exited with code ${code}`;
        resolve(error(errorMessage, ErrorCode.UNKNOWN_ERROR, {
          ...context,
          recoveryHint: 'check_target',
          metadata: { 
            ...context.metadata, 
            originalStderr: stderr.trim(),
            originalStdout: stdout.trim()
          }
        }));
      }
    });

    child.on('error', (err) => {
      if (timedOut) return;
      
      clearTimeout(timeout);
      resolve(error(err.message, ErrorCode.PROCESS_FAILED, {
        durationMs: Date.now() - startTime,
        recoveryHint: 'retry',
        metadata: { command: fullCommand, originalError: err.message }
      }));
    });
  });
}

/**
 * Legacy execWithTimeout function that maintains backward compatibility with tests
 * This wraps the new Result<T,E> version to provide the old interface structure
 * @deprecated Use the main execWithTimeout function and handle Result<T,E> properly
 */
export async function execWithTimeoutLegacy(
  command: string,
  args: string[] = [],
  timeoutMs: number = 30000
): Promise<LegacyExecResult> {
  const result = await execWithTimeout(command, args, timeoutMs);
  
  if (result.success) {
    return {
      success: true,
      stdout: result.data.stdout,
      stderr: result.data.stderr,
      code: result.code,
      ...(result.data.command !== undefined && { command: result.data.command })
    };
  } else {
    // For compatibility, use the original error message when available
    // Check if we have metadata with original stderr or original error
    const originalStderr = result.context?.metadata?.originalStderr as string;
    const originalError = result.context?.metadata?.originalError as string;
    const stderr = originalStderr || originalError || result.error;
    
    // Map new error codes to legacy codes for compatibility
    let legacyCode = result.code;
    if (result.code === ErrorCode.PROCESS_FAILED) {
      legacyCode = ERROR_CODES.UNKNOWN_ERROR; // Map PROCESS_FAILED (83) to UNKNOWN_ERROR (99)
    }
    
    return {
      success: false,
      stdout: result.context?.metadata?.originalStdout as string || '',
      stderr,
      code: legacyCode,
      command: `${command} ${args.join(' ')}`
    };
  }
}

/**
 * Format result as JSON with consistent structure using unified Result<T,E> pattern
 */
export function formatJSONResult<T = unknown>(
  data?: T,
  errorMessage?: string,
  code: ErrorCode = ERROR_CODES.OK
): JSONResult<T> {
  if (code === ERROR_CODES.OK && data !== undefined) {
    return ok(data, code);
  } else if (code !== ERROR_CODES.OK && errorMessage) {
    return error(errorMessage, code);
  } else if (code === ERROR_CODES.OK) {
    // Handle case where data is undefined but operation succeeded
    return ok(undefined as T, code);
  } else {
    return error('Unknown error occurred', code);
  }
}

/**
 * Temporary backward compatibility adapter for existing code
 * @deprecated This is a temporary adapter for migration - use Result<T,E> directly
 */
export function formatJSONResultLegacy<T = unknown>(
  data?: T,
  errorMessage?: string,
  code: ErrorCode = ERROR_CODES.OK
): LegacyJSONResult<T> {
  return {
    success: code === ERROR_CODES.OK,
    code,
    timestamp: new Date().toISOString(),
    ...(code === ERROR_CODES.OK && data !== undefined && { data }),
    ...(code !== ERROR_CODES.OK && errorMessage && { error: errorMessage })
  };
}

/**
 * Legacy formatJSONResult function for backward compatibility
 * @deprecated Use formatJSONResult with Result<T,E> pattern instead
 */
export function formatLegacyJSONResult<T = unknown>(
  data?: T,
  error?: string,
  code: ErrorCode = ERROR_CODES.OK
): LegacyJSONResult<T> {
  const result: LegacyJSONResult<T> = {
    success: code === ERROR_CODES.OK,
    code,
    timestamp: new Date().toISOString()
  };
  
  if (code === ERROR_CODES.OK && data !== undefined) {
    result.data = data;
  }
  
  if (code !== ERROR_CODES.OK && error !== undefined) {
    result.error = error;
  }
  
  return result;
}

/**
 * Create WebP preview with size constraints (optimized version)
 * 
 * Note: This function is a placeholder for future WebP optimization functionality.
 * The Sharp library dependency provides WebP capabilities but requires additional
 * implementation for the mac-chrome-cli specific use case.
 * 
 * @param imagePath - Path to the source image
 * @param maxSizeBytes - Maximum file size in bytes (default: 1.5MB)
 * @param maxWidth - Maximum width in pixels (default: 1200px)
 * @returns Promise resolving to WebP buffer, base64 string, and size info
 * @throws Error indicating this feature is not yet implemented
 */
export async function createWebPPreview(
  imagePath: string,
  maxSizeBytes: number = 1.5 * 1024 * 1024, // 1.5MB default
  maxWidth: number = 1200
): Promise<{ buffer: Buffer; base64: string; size: number }> {
  try {
    const sharp = (await import('sharp')).default;
    
    // Read the input image
    const input = await sharp(imagePath);
    const metadata = await input.metadata();
    
    // Calculate resize dimensions if needed
    let resizeWidth: number | undefined;
    if (metadata.width && metadata.width > maxWidth) {
      resizeWidth = maxWidth;
    }
    
    // Start with high quality and reduce if needed
    let quality = 90;
    let buffer: Buffer;
    let attempts = 0;
    const maxAttempts = 5;
    
    do {
      buffer = await input
        .resize(resizeWidth ? { width: resizeWidth, withoutEnlargement: true } : undefined)
        .webp({ quality })
        .toBuffer();
      
      if (buffer.length <= maxSizeBytes) {
        break;
      }
      
      // Reduce quality for next attempt
      quality = Math.max(30, quality - 15);
      attempts++;
    } while (attempts < maxAttempts && buffer!.length > maxSizeBytes);
    
    return {
      buffer: buffer!,
      base64: buffer!.toString('base64'),
      size: buffer!.length
    };
  } catch (error) {
    // Fallback: return empty preview if Sharp is not available or image processing fails
    // This allows the CLI to continue functioning even without preview generation
    return {
      buffer: Buffer.from(''),
      base64: '',
      size: 0
    };
  }
}

/**
 * Expand tilde in file paths
 */
export function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * Validate and normalize input parameters
 */
export function validateInput(value: unknown, type: 'string' | 'number' | 'boolean' | 'object', required: boolean = true): boolean {
  if (required && (value === undefined || value === null)) {
    return false;
  }
  
  if (value === undefined || value === null) {
    return true; // Optional parameter
  }
  
  switch (type) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0;
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null;
    default:
      return false;
  }
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape CSS selector for safe use in JavaScript template literals
 */
export function escapeCSSSelector(selector: string): string {
  return selector
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'");   // Then escape single quotes
}