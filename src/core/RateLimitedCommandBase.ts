/**
 * @fileoverview Rate-limited command base classes with integrated resource protection
 * 
 * This module extends the existing command base classes to provide automatic rate limiting
 * for resource-intensive operations. Integrates seamlessly with the existing Result<T,E>
 * pattern and service-oriented architecture.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { Result, ok, error, withContext } from './Result.js';
import { ErrorCode } from './ErrorCodes.js';
import { CommandBase, BrowserCommandBase, type BaseCommandOptions } from './CommandBase.js';
import { ServiceAwareCommand } from '../di/ServiceAwareCommand.js';
import type { IServiceContainer } from '../di/ServiceContainer.js';
import type { IRateLimiterService } from '../di/IRateLimiterService.js';
import { SERVICE_TOKENS } from '../di/ServiceTokens.js';

/**
 * Options for rate-limited command execution
 */
export interface RateLimitedCommandOptions extends BaseCommandOptions {
  /** Skip rate limiting for this operation (use with caution) */
  skipRateLimit?: boolean;
  /** Custom operation weight for rate limiting (default: 1) */
  operationWeight?: number;
  /** Additional metadata for rate limiting context */
  rateLimitMetadata?: Record<string, unknown>;
}

/**
 * Rate-limited command execution result with limit information
 */
export interface RateLimitedResult<T> {
  /** The actual command result */
  result: Result<T, string>;
  /** Rate limit information */
  rateLimit?: {
    /** Operations remaining in current window */
    remaining: number;
    /** Time until rate limit resets (ms) */
    resetTimeMs: number;
    /** Whether rate limiting was applied */
    applied: boolean;
  };
}

/**
 * Enhanced command base with automatic rate limiting
 * 
 * Extends CommandBase to provide transparent rate limiting for all operations.
 * Rate limits are checked before execution and usage is recorded after success.
 */
export abstract class RateLimitedCommandBase extends ServiceAwareCommand {
  private rateLimiterService?: IRateLimiterService;
  
  protected constructor(container: IServiceContainer) {
    super(container);
  }
  
  /**
   * Get rate limiter service with lazy initialization
   */
  protected async getRateLimiterService(): Promise<IRateLimiterService> {
    if (!this.rateLimiterService) {
      const result = await this.container.resolve(SERVICE_TOKENS.RateLimiterService);
      if (!result.success) {
        throw new Error(`Failed to resolve RateLimiterService: ${result.error}`);
      }
      this.rateLimiterService = result.data;
    }
    return this.rateLimiterService;
  }
  
  /**
   * Execute operation with automatic rate limiting
   * 
   * @param operation - The operation to execute
   * @param operationId - Unique identifier for rate limiting (e.g., 'screenshot.viewport')
   * @param options - Rate limiting and command options
   * @returns Promise resolving to rate-limited result
   */
  protected async executeRateLimitedOperation<T>(
    operation: () => Promise<T>,
    operationId: string,
    options: RateLimitedCommandOptions = {}
  ): Promise<RateLimitedResult<T>> {
    const startTime = Date.now();
    
    try {
      // Skip rate limiting if requested
      if (options.skipRateLimit) {
        const result = await this.executeWithErrorHandling(operation, operationId, startTime);
        return {
          result,
          rateLimit: {
            remaining: Infinity,
            resetTimeMs: 0,
            applied: false
          }
        };
      }
      
      const rateLimiter = await this.getRateLimiterService();
      const weight = options.operationWeight || 1;
      
      // Check rate limits before execution
      const rateLimitCheck = await rateLimiter.checkLimit(
        operationId,
        weight,
        {
          ...options.rateLimitMetadata,
          tabIndex: options.tabIndex,
          windowIndex: options.windowIndex,
          timestamp: startTime
        }
      );
      
      // Return rate limit error if denied
      if (!rateLimitCheck.allowed) {
        const rateLimitError = error(
          `Rate limit exceeded for ${operationId}. Try again in ${rateLimitCheck.retryAfterMs || rateLimitCheck.resetTimeMs}ms`,
          ErrorCode.RATE_LIMITED,
          {
            recoveryHint: 'retry_with_delay',
            durationMs: Date.now() - startTime,
            metadata: {
              operation: operationId,
              retryAfterMs: rateLimitCheck.retryAfterMs,
              resetTimeMs: rateLimitCheck.resetTimeMs,
              remaining: rateLimitCheck.remaining,
              rule: rateLimitCheck.rule
            }
          }
        );
        
        return {
          result: rateLimitError,
          rateLimit: {
            remaining: rateLimitCheck.remaining,
            resetTimeMs: rateLimitCheck.resetTimeMs,
            applied: true
          }
        };
      }
      
      // Execute the operation
      const result = await this.executeWithErrorHandling(operation, operationId, startTime);
      
      // Record usage if operation succeeded
      if (result.success) {
        await rateLimiter.recordUsage(operationId, weight, {
          ...options.rateLimitMetadata,
          durationMs: Date.now() - startTime,
          tabIndex: options.tabIndex,
          windowIndex: options.windowIndex
        });
      }
      
      return {
        result,
        rateLimit: {
          remaining: rateLimitCheck.remaining - weight,
          resetTimeMs: rateLimitCheck.resetTimeMs,
          applied: true
        }
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        result: error(
          `Operation ${operationId} failed: ${errorMessage}`,
          ErrorCode.UNKNOWN_ERROR,
          {
            recoveryHint: 'retry',
            durationMs: Date.now() - startTime,
            metadata: { operation: operationId, error: errorMessage }
          }
        ),
        rateLimit: {
          remaining: 0,
          resetTimeMs: 0,
          applied: false
        }
      };
    }
  }
  
  /**
   * Execute operation with comprehensive error handling
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationId: string,
    startTime: number
  ): Promise<Result<T, string>> {
    try {
      const data = await operation();
      return withContext(
        ok(data),
        {
          durationMs: Date.now() - startTime,
          metadata: { operation: operationId }
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      let errorCode = ErrorCode.UNKNOWN_ERROR;
      let recoveryHint: 'retry' | 'permission' | 'check_target' | 'not_recoverable' = 'retry';
      
      // Map common error patterns to appropriate error codes
      if (errorMessage.toLowerCase().includes('permission')) {
        errorCode = ErrorCode.PERMISSION_DENIED;
        recoveryHint = 'permission';
      } else if (errorMessage.toLowerCase().includes('timeout')) {
        errorCode = ErrorCode.TIMEOUT;
        recoveryHint = 'retry';
      } else if (errorMessage.toLowerCase().includes('not found')) {
        errorCode = ErrorCode.TARGET_NOT_FOUND;
        recoveryHint = 'check_target';
      } else if (errorMessage.toLowerCase().includes('chrome')) {
        errorCode = ErrorCode.CHROME_NOT_RUNNING;
        recoveryHint = 'not_recoverable';
      }
      
      return error(
        errorMessage,
        errorCode,
        {
          recoveryHint,
          durationMs: Date.now() - startTime,
          metadata: { operation: operationId, originalError: errorMessage }
        }
      );
    }
  }
  
  /**
   * Configure rate limits for operations performed by this command
   * 
   * @param operationPattern - Operation pattern (e.g., 'screenshot.*')
   * @param maxOperations - Maximum operations per window
   * @param windowMs - Time window in milliseconds
   * @param algorithm - Rate limiting algorithm to use
   */
  public async configureRateLimit(
    operationPattern: string,
    maxOperations: number,
    windowMs: number,
    algorithm: 'sliding_window' | 'token_bucket' | 'fixed_window' | 'leaky_bucket' = 'sliding_window'
  ): Promise<void> {
    const rateLimiter = await this.getRateLimiterService();
    await rateLimiter.configureLimit(operationPattern, {
      maxOperations,
      windowMs,
      algorithm,
      ruleId: `${operationPattern}_${Date.now()}`
    });
  }
  
  /**
   * Get current rate limit statistics for monitoring
   */
  public async getRateLimitStats(): Promise<{
    totalChecked: number;
    allowed: number;
    denied: number;
    allowRate: number;
  }> {
    const rateLimiter = await this.getRateLimiterService();
    const stats = await rateLimiter.getStats();
    return {
      totalChecked: stats.totalChecked,
      allowed: stats.allowed,
      denied: stats.denied,
      allowRate: stats.allowRate
    };
  }
  
  /**
   * Temporarily adjust rate limits (e.g., during high load)
   */
  public async adjustRateLimit(
    operationPattern: string,
    multiplier: number,
    durationMs: number = 60000
  ): Promise<void> {
    const rateLimiter = await this.getRateLimiterService();
    await rateLimiter.adjustLimit(operationPattern, multiplier, durationMs);
  }
}

/**
 * Rate-limited browser command base with Chrome-specific functionality
 */
export abstract class RateLimitedBrowserCommandBase extends RateLimitedCommandBase {
  
  /**
   * Execute JavaScript with rate limiting and browser-specific error handling
   */
  protected async executeRateLimitedJavaScript<T>(
    javascript: string,
    operationId: string,
    options: RateLimitedCommandOptions = {}
  ): Promise<RateLimitedResult<T>> {
    const { tabIndex = 1, windowIndex = 1, timeoutMs = 30000 } = options;
    
    return this.executeRateLimitedOperation(
      async () => {
        const { execChromeJS } = await import('../lib/apple.js');
        const result = await execChromeJS<T>(javascript, tabIndex, windowIndex, timeoutMs);
        
        if (!result.success) {
          if (result.error?.includes('Element not found')) {
            throw new Error(`Element not found: ${result.error}`);
          }
          if (result.error?.includes('timeout')) {
            throw new Error(`Operation timed out: ${result.error}`);
          }
          throw new Error(result.error || 'JavaScript execution failed');
        }
        
        return result.data as T;
      },
      operationId,
      {
        ...options,
        rateLimitMetadata: {
          ...options.rateLimitMetadata,
          javascriptLength: javascript.length,
          timeout: timeoutMs
        }
      }
    );
  }
  
  /**
   * Execute AppleScript with rate limiting
   */
  protected async executeRateLimitedAppleScript<T>(
    script: string,
    operationId: string,
    options: RateLimitedCommandOptions = {}
  ): Promise<RateLimitedResult<T>> {
    return this.executeRateLimitedOperation(
      async () => {
        const appleScriptService = await this.getAppleScriptService();
        const result = await appleScriptService.executeScript(script);
        
        if (!result.success) {
          throw new Error(result.error || 'AppleScript execution failed');
        }
        
        return result.data as T;
      },
      operationId,
      {
        ...options,
        operationWeight: options.operationWeight || 2, // AppleScript is typically more expensive
        rateLimitMetadata: {
          ...options.rateLimitMetadata,
          scriptLength: script.length
        }
      }
    );
  }
}

/**
 * Utility functions for rate-limited operations
 */
export const RateLimitUtils = {
  /**
   * Generate operation ID from command and method
   */
  createOperationId(command: string, method: string, target?: string): string {
    const parts = [command, method];
    if (target) {
      parts.push(target.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
    }
    return parts.join('.');
  },
  
  /**
   * Extract retry information from rate limit error
   */
  extractRetryInfo(result: Result<unknown, string>): { retryAfterMs?: number; resetTimeMs?: number } | null {
    if (result.success || result.code !== ErrorCode.RATE_LIMITED) {
      return null;
    }
    
    return {
      retryAfterMs: result.context?.metadata?.retryAfterMs as number,
      resetTimeMs: result.context?.metadata?.resetTimeMs as number
    };
  },
  
  /**
   * Check if error is rate limit related
   */
  isRateLimitError(result: Result<unknown, string>): boolean {
    return !result.success && result.code === ErrorCode.RATE_LIMITED;
  },
  
  /**
   * Create rate limit configuration for resource-intensive operations
   */
  createResourceIntensiveConfig(operationType: 'screenshot' | 'snapshot' | 'file' | 'network') {
    const configs = {
      screenshot: { maxOperations: 10, windowMs: 60000, algorithm: 'token_bucket' as const, burstSize: 3 },
      snapshot: { maxOperations: 20, windowMs: 60000, algorithm: 'sliding_window' as const },
      file: { maxOperations: 5, windowMs: 60000, algorithm: 'fixed_window' as const },
      network: { maxOperations: 50, windowMs: 60000, algorithm: 'leaky_bucket' as const }
    };
    
    return configs[operationType];
  }
};