import { formatJSONResult, ERROR_CODES, type JSONResult } from '../lib/util.js';

export interface WaitOptions {
  milliseconds?: number;
}

export interface WaitResult {
  success: boolean;
  cmd: string;
  durationMs: number;
  actualMs: number;
  timestamp: string;
}

/**
 * Default wait duration in milliseconds
 */
const DEFAULT_WAIT_MS = 800;

/**
 * Maximum allowed wait duration (10 minutes)
 */
const MAX_WAIT_MS = 10 * 60 * 1000;

/**
 * Minimum allowed wait duration
 */
const MIN_WAIT_MS = 1;

/**
 * Wait for the specified duration
 */
export async function waitIdle(options: WaitOptions = {}): Promise<JSONResult<WaitResult | null>> {
  const requestedMs = options.milliseconds ?? DEFAULT_WAIT_MS;
  
  // Validate input
  if (typeof requestedMs !== 'number' || isNaN(requestedMs)) {
    return formatJSONResult(
      null,
      'Invalid milliseconds value. Must be a number.',
      ERROR_CODES.INVALID_INPUT
    );
  }
  
  // Check for negative infinity specifically
  if (requestedMs === -Infinity) {
    return formatJSONResult(
      null,
      'Invalid milliseconds value. Must be a number.',
      ERROR_CODES.INVALID_INPUT
    );
  }
  
  if (requestedMs < MIN_WAIT_MS) {
    return formatJSONResult(
      null,
      `Wait duration too short. Minimum is ${MIN_WAIT_MS}ms.`,
      ERROR_CODES.INVALID_INPUT
    );
  }
  
  if (requestedMs > MAX_WAIT_MS || requestedMs === Infinity) {
    return formatJSONResult(
      null,
      `Wait duration too long. Maximum is ${MAX_WAIT_MS}ms (10 minutes).`,
      ERROR_CODES.INVALID_INPUT
    );
  }
  
  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();
  
  try {
    // Create a promise that resolves after the specified duration
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, requestedMs);
      
      // Handle process interruption signals
      const handleSignal = () => {
        clearTimeout(timeoutId);
        const actualMs = Date.now() - startTime;
        reject(new Error(`Wait interrupted after ${actualMs}ms`));
      };
      
      // Listen for common interrupt signals
      process.once('SIGINT', handleSignal);
      process.once('SIGTERM', handleSignal);
      
      // Clean up signal listeners after timeout completes
      setTimeout(() => {
        process.removeListener('SIGINT', handleSignal);
        process.removeListener('SIGTERM', handleSignal);
      }, requestedMs + 100); // Small buffer to ensure cleanup
    });
    
    const actualMs = Math.max(Date.now() - startTime, requestedMs);
    
    const result: WaitResult = {
      success: true,
      cmd: 'wait idle',
      durationMs: requestedMs,
      actualMs,
      timestamp: startTimestamp
    };
    
    return formatJSONResult(result, undefined, ERROR_CODES.OK);
    
  } catch (error) {
    const actualMs = Date.now() - startTime;
    
    // Check if it was an interruption
    if (error instanceof Error && error.message.includes('interrupted')) {
      const result: WaitResult = {
        success: false,
        cmd: 'wait idle',
        durationMs: requestedMs,
        actualMs,
        timestamp: startTimestamp
      };
      
      return formatJSONResult(
        result,
        error.message,
        ERROR_CODES.TIMEOUT // Use timeout code for interruptions
      );
    }
    
    return formatJSONResult(
      null,
      `Wait command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}