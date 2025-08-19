/**
 * @fileoverview Rate limiter service interface for protecting system resources
 * 
 * This module defines the contract for rate limiting services that protect against
 * resource exhaustion by controlling the frequency of expensive operations.
 * Supports multiple algorithms including sliding window and token bucket patterns.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

/**
 * Rate limiting algorithm types supported by the service
 */
export type RateLimitAlgorithm = 
  | 'sliding_window'    // Time-based sliding window
  | 'token_bucket'      // Token bucket with burst support
  | 'fixed_window'      // Fixed time window counter
  | 'leaky_bucket';     // Leaky bucket algorithm

/**
 * Configuration for a specific rate limit rule
 */
export interface RateLimitRule {
  /** Maximum number of operations allowed */
  maxOperations: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Algorithm to use for this rule */
  algorithm: RateLimitAlgorithm;
  /** Burst allowance for token bucket (optional) */
  burstSize?: number;
  /** Custom identifier for this rule */
  ruleId?: string;
}

/**
 * Result of a rate limit check operation
 */
export interface RateLimitCheckResult {
  /** Whether the operation is allowed under current limits */
  allowed: boolean;
  /** Remaining operations in current window */
  remaining: number;
  /** Milliseconds until limit resets */
  resetTimeMs: number;
  /** Recommended retry delay if denied (milliseconds) */
  retryAfterMs?: number;
  /** Current limit rule that was applied */
  rule: RateLimitRule;
  /** Additional context about the limit check */
  metadata?: {
    /** Current window start time */
    windowStart: number;
    /** Total operations in current window */
    currentCount: number;
    /** Algorithm-specific state */
    algorithmState?: Record<string, unknown>;
  };
}

/**
 * Usage record for rate limit tracking
 */
export interface RateLimitUsage {
  /** Operation identifier */
  operation: string;
  /** Timestamp of the operation */
  timestamp: number;
  /** Weight/cost of the operation (default: 1) */
  weight?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Statistics for rate limiting monitoring
 */
export interface RateLimitStats {
  /** Total number of operations checked */
  totalChecked: number;
  /** Number of operations allowed */
  allowed: number;
  /** Number of operations denied */
  denied: number;
  /** Success rate (0-1) */
  allowRate: number;
  /** Average operations per second */
  operationsPerSecond: number;
  /** Peak operations in any window */
  peakOperations: number;
  /** Per-operation statistics */
  operationStats: Record<string, {
    checked: number;
    allowed: number;
    denied: number;
    avgWeight: number;
  }>;
  /** Memory usage of rate limiting data */
  memoryUsageKB: number;
}

/**
 * Rate limiter service interface providing comprehensive rate limiting capabilities.
 * 
 * This interface defines a contract for rate limiting implementations that support
 * multiple algorithms, per-operation limits, burst handling, and detailed monitoring.
 * 
 * @interface IRateLimiterService
 * @example
 * ```typescript
 * class MyRateLimiter implements IRateLimiterService {
 *   async checkLimit(operation: string): Promise<RateLimitCheckResult> {
 *     // Implementation
 *     return { allowed: true, remaining: 10, resetTimeMs: 60000, rule: {...} };
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface IRateLimiterService {
  /**
   * Checks if an operation is allowed under current rate limits.
   * Does not record usage - call recordUsage() separately if allowed.
   * 
   * @param operation - Operation identifier (e.g., 'screenshot.viewport')
   * @param weight - Operation weight/cost (default: 1)
   * @param metadata - Additional operation metadata
   * @returns Promise resolving to rate limit check result
   * 
   * @example
   * ```typescript
   * const check = await rateLimiter.checkLimit('screenshot.viewport');
   * if (check.allowed) {
   *   // Proceed with operation
   *   await performScreenshot();
   *   await rateLimiter.recordUsage('screenshot.viewport');
   * } else {
   *   throw new Error(`Rate limited. Retry in ${check.retryAfterMs}ms`);
   * }
   * ```
   */
  checkLimit(
    operation: string, 
    weight?: number, 
    metadata?: Record<string, unknown>
  ): Promise<RateLimitCheckResult>;

  /**
   * Records successful usage of an operation for rate limit tracking.
   * Should be called after operation completes successfully.
   * 
   * @param operation - Operation identifier
   * @param weight - Operation weight/cost (default: 1)
   * @param metadata - Additional operation metadata
   * 
   * @example
   * ```typescript
   * // After successful screenshot
   * await rateLimiter.recordUsage('screenshot.viewport', 1, {
   *   outputSize: fileSize,
   *   duration: operationTime
   * });
   * ```
   */
  recordUsage(
    operation: string, 
    weight?: number, 
    metadata?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Checks and records usage in a single atomic operation.
   * More efficient than separate checkLimit + recordUsage calls.
   * 
   * @param operation - Operation identifier
   * @param weight - Operation weight/cost (default: 1)
   * @param metadata - Additional operation metadata
   * @returns Promise resolving to rate limit check result
   * 
   * @example
   * ```typescript
   * const result = await rateLimiter.checkAndRecord('dom.snapshot');
   * if (!result.allowed) {
   *   throw new RateLimitError(`Rate limited: ${result.retryAfterMs}ms`);
   * }
   * ```
   */
  checkAndRecord(
    operation: string, 
    weight?: number, 
    metadata?: Record<string, unknown>
  ): Promise<RateLimitCheckResult>;

  /**
   * Configures rate limit rules for specific operations.
   * Existing rules for the same operation will be replaced.
   * 
   * @param operation - Operation identifier or pattern
   * @param rule - Rate limit rule configuration
   * 
   * @example
   * ```typescript
   * // Limit screenshots to 10 per minute with burst of 5
   * await rateLimiter.configureLimit('screenshot.*', {
   *   maxOperations: 10,
   *   windowMs: 60000,
   *   algorithm: 'token_bucket',
   *   burstSize: 5
   * });
   * 
   * // Global limit for all operations
   * await rateLimiter.configureLimit('*', {
   *   maxOperations: 100,
   *   windowMs: 60000,
   *   algorithm: 'sliding_window'
   * });
   * ```
   */
  configureLimit(operation: string, rule: RateLimitRule): Promise<void>;

  /**
   * Removes rate limit configuration for an operation.
   * 
   * @param operation - Operation identifier or pattern
   * @returns True if a rule was removed, false if none existed
   * 
   * @example
   * ```typescript
   * const removed = await rateLimiter.removeLimit('screenshot.element');
   * if (removed) {
   *   console.log('Rate limit removed for element screenshots');
   * }
   * ```
   */
  removeLimit(operation: string): Promise<boolean>;

  /**
   * Retrieves current rate limit configuration for an operation.
   * 
   * @param operation - Operation identifier
   * @returns The rate limit rule if configured, undefined otherwise
   * 
   * @example
   * ```typescript
   * const rule = await rateLimiter.getLimit('dom.snapshot');
   * if (rule) {
   *   console.log(`Limit: ${rule.maxOperations} per ${rule.windowMs}ms`);
   * }
   * ```
   */
  getLimit(operation: string): Promise<RateLimitRule | undefined>;

  /**
   * Lists all configured rate limit rules.
   * 
   * @returns Map of operation patterns to their rate limit rules
   * 
   * @example
   * ```typescript
   * const rules = await rateLimiter.getAllLimits();
   * for (const [pattern, rule] of rules) {
   *   console.log(`${pattern}: ${rule.maxOperations}/${rule.windowMs}ms`);
   * }
   * ```
   */
  getAllLimits(): Promise<Map<string, RateLimitRule>>;

  /**
   * Resets rate limit counters for a specific operation.
   * Useful for testing or manual limit reset.
   * 
   * @param operation - Operation identifier (optional, resets all if omitted)
   * 
   * @example
   * ```typescript
   * // Reset specific operation
   * await rateLimiter.reset('screenshot.viewport');
   * 
   * // Reset all operations
   * await rateLimiter.reset();
   * ```
   */
  reset(operation?: string): Promise<void>;

  /**
   * Retrieves comprehensive rate limiting statistics.
   * Useful for monitoring effectiveness and performance tuning.
   * 
   * @returns Current rate limiting statistics
   * 
   * @example
   * ```typescript
   * const stats = await rateLimiter.getStats();
   * console.log(`Allow rate: ${(stats.allowRate * 100).toFixed(1)}%`);
   * console.log(`Peak operations: ${stats.peakOperations}`);
   * ```
   */
  getStats(): Promise<RateLimitStats>;

  /**
   * Performs cleanup of expired rate limit data.
   * This is typically called automatically but can be triggered manually.
   * 
   * @returns Number of expired entries that were cleaned up
   * 
   * @example
   * ```typescript
   * const cleaned = await rateLimiter.cleanup();
   * console.log(`Cleaned up ${cleaned} expired rate limit entries`);
   * ```
   */
  cleanup(): Promise<number>;

  /**
   * Temporarily adjusts rate limits for an operation.
   * Useful for dynamic scaling based on system load.
   * 
   * @param operation - Operation identifier
   * @param multiplier - Rate limit multiplier (0.5 = halve limits, 2.0 = double)
   * @param durationMs - How long the adjustment lasts (default: 60000ms)
   * 
   * @example
   * ```typescript
   * // Reduce screenshot limits by 50% for 5 minutes due to high load
   * await rateLimiter.adjustLimit('screenshot.*', 0.5, 5 * 60 * 1000);
   * ```
   */
  adjustLimit(
    operation: string, 
    multiplier: number, 
    durationMs?: number
  ): Promise<void>;
}