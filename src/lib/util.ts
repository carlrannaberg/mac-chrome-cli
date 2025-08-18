import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

// Error codes as specified in the requirements
export const ERROR_CODES = {
  OK: 0,
  INVALID_INPUT: 10,
  TARGET_NOT_FOUND: 20,
  PERMISSION_DENIED: 30,
  TIMEOUT: 40,
  CHROME_NOT_FOUND: 50,
  UNKNOWN_ERROR: 99
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: ErrorCode;
  command?: string;
}

export interface JSONResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code: ErrorCode;
  timestamp: string;
}

/**
 * Execute a command with timeout and proper error handling
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

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      resolve({
        success: false,
        stdout: '',
        stderr: 'Command timed out',
        code: ERROR_CODES.TIMEOUT,
        command: `${command} ${args.join(' ')}`
      });
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
      
      const success = code === 0;
      resolve({
        success,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: success ? ERROR_CODES.OK : ERROR_CODES.UNKNOWN_ERROR,
        command: `${command} ${args.join(' ')}`
      });
    });

    child.on('error', (error) => {
      if (timedOut) return;
      
      clearTimeout(timeout);
      resolve({
        success: false,
        stdout: '',
        stderr: error.message,
        code: ERROR_CODES.UNKNOWN_ERROR,
        command: `${command} ${args.join(' ')}`
      });
    });
  });
}

/**
 * Format result as JSON with consistent structure
 */
export function formatJSONResult<T = unknown>(
  data?: T,
  error?: string,
  code: ErrorCode = ERROR_CODES.OK
): JSONResult<T> {
  const result: JSONResult<T> = {
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