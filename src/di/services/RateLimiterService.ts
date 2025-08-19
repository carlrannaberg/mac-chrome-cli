/**
 * @fileoverview Rate limiter service implementation with multiple algorithms
 * 
 * This module provides a comprehensive rate limiting implementation that supports
 * sliding window, token bucket, fixed window, and leaky bucket algorithms.
 * Designed to protect system resources while maintaining high performance.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import type {
  IRateLimiterService,
  RateLimitRule,
  RateLimitCheckResult,
  RateLimitStats,
  RateLimitAlgorithm
} from '../IRateLimiterService.js';

/**
 * Internal rate limit window data for tracking operations
 */
interface RateLimitWindow {
  /** Window start timestamp */
  startTime: number;
  /** Operations in this window */
  operations: Array<{ timestamp: number; weight: number; metadata?: Record<string, unknown> }>;
  /** Current operation count */
  count: number;
  /** Total weight in window */
  totalWeight: number;
}

/**
 * Token bucket state for token bucket algorithm
 */
interface TokenBucketState {
  /** Current number of tokens */
  tokens: number;
  /** Last refill timestamp */
  lastRefill: number;
  /** Tokens added per millisecond */
  refillRate: number;
}

/**
 * Comprehensive rate limiter service implementation.
 * 
 * Features:
 * - Multiple algorithms (sliding window, token bucket, fixed window, leaky bucket)
 * - Per-operation and global rate limiting
 * - Pattern matching for operation groups
 * - Burst handling with token bucket
 * - Automatic cleanup of expired data
 * - Comprehensive statistics and monitoring
 * - Memory-efficient storage with automatic pruning
 */
export class RateLimiterService implements IRateLimiterService {
  /** Rate limit rules indexed by operation pattern */
  private rules = new Map<string, RateLimitRule>();
  
  /** Active rate limit windows indexed by operation */
  private windows = new Map<string, RateLimitWindow>();
  
  /** Token bucket states for applicable rules */
  private tokenBuckets = new Map<string, TokenBucketState>();
  
  /** Global statistics tracking */
  private stats = {
    totalChecked: 0,
    allowed: 0,
    denied: 0,
    operationStats: new Map<string, { checked: number; allowed: number; denied: number; totalWeight: number }>()
  };
  
  /** Default configuration */
  private readonly defaults = {
    globalMaxOperations: 100,
    globalWindowMs: 60000,
    defaultAlgorithm: 'sliding_window' as RateLimitAlgorithm,
    cleanupIntervalMs: 30000,
    maxWindowHistory: 1000
  };
  
  /** Cleanup timer for expired data */
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor() {
    // Set up default global rate limit
    this.rules.set('*', {
      maxOperations: this.defaults.globalMaxOperations,
      windowMs: this.defaults.globalWindowMs,
      algorithm: this.defaults.defaultAlgorithm,
      ruleId: 'global_default'
    });
    
    // Start automatic cleanup
    this.startCleanupTimer();
    
    // Set up default operation limits based on resource intensity
    this.initializeDefaultLimits();
  }
  
  /**
   * Initialize default rate limits for resource-intensive operations
   */
  private async initializeDefaultLimits(): Promise<void> {
    // Screenshot operations - high resource usage
    await this.configureLimit('screenshot.*', {
      maxOperations: 10,
      windowMs: 60000,
      algorithm: 'token_bucket',
      burstSize: 15,
      ruleId: 'screenshot_limits'
    });
    
    // DOM snapshot operations - moderate resource usage
    await this.configureLimit('snapshot.*', {
      maxOperations: 20,
      windowMs: 60000,
      algorithm: 'sliding_window',
      ruleId: 'snapshot_limits'
    });
    
    // AppleScript operations - high latency
    await this.configureLimit('applescript.*', {
      maxOperations: 30,
      windowMs: 60000,
      algorithm: 'leaky_bucket',
      ruleId: 'applescript_limits'
    });
    
    // File operations - moderate resource usage
    await this.configureLimit('files.*', {
      maxOperations: 5,
      windowMs: 60000,
      algorithm: 'fixed_window',
      ruleId: 'file_limits'
    });
  }
  
  async checkLimit(
    operation: string, 
    weight: number = 1, 
    metadata?: Record<string, unknown>
  ): Promise<RateLimitCheckResult> {
    const rule = this.findApplicableRule(operation);
    if (!rule) {
      // No limits configured - allow operation
      return {
        allowed: true,
        remaining: Infinity,
        resetTimeMs: 0,
        rule: {
          maxOperations: Infinity,
          windowMs: 0,
          algorithm: 'sliding_window'
        }
      };
    }
    
    this.stats.totalChecked++;
    this.updateOperationStats(operation, 'checked', weight);
    
    const now = Date.now();
    const result = await this.checkLimitWithRule(operation, rule, weight, now, metadata);
    
    if (result.allowed) {
      this.stats.allowed++;
      this.updateOperationStats(operation, 'allowed', weight);
    } else {
      this.stats.denied++;
      this.updateOperationStats(operation, 'denied', weight);
    }
    
    return result;
  }
  
  async recordUsage(
    operation: string, 
    weight: number = 1, 
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const rule = this.findApplicableRule(operation);
    if (!rule) return;
    
    const now = Date.now();
    await this.recordUsageWithRule(operation, rule, weight, now, metadata);
  }
  
  async checkAndRecord(
    operation: string, 
    weight: number = 1, 
    metadata?: Record<string, unknown>
  ): Promise<RateLimitCheckResult> {
    const result = await this.checkLimit(operation, weight, metadata);
    
    if (result.allowed) {
      await this.recordUsage(operation, weight, metadata);
      // Update remaining to reflect post-operation state
      return {
        ...result,
        remaining: Math.max(0, result.remaining - weight)
      };
    }
    
    return result;
  }
  
  async configureLimit(operation: string, rule: RateLimitRule): Promise<void> {
    // Validate rule configuration
    this.validateRule(rule);
    
    // Store the rule
    this.rules.set(operation, { ...rule });
    
    // Initialize token bucket state if needed
    if (rule.algorithm === 'token_bucket') {
      this.initializeTokenBucket(operation, rule);
    }
    
    // Clean up existing windows for this operation pattern
    this.cleanupOperationWindows(operation);
  }
  
  async removeLimit(operation: string): Promise<boolean> {
    const existed = this.rules.has(operation);
    
    if (existed) {
      this.rules.delete(operation);
      this.tokenBuckets.delete(operation);
      this.cleanupOperationWindows(operation);
    }
    
    return existed;
  }
  
  async getLimit(operation: string): Promise<RateLimitRule | undefined> {
    // Return only explicitly configured rules, not global defaults
    return this.rules.get(operation);
  }
  
  async getAllLimits(): Promise<Map<string, RateLimitRule>> {
    return new Map(this.rules);
  }
  
  async reset(operation?: string): Promise<void> {
    if (operation) {
      // Reset specific operation
      this.windows.delete(operation);
      this.tokenBuckets.delete(operation);
      
      // Reset pattern-matched operations
      for (const key of this.windows.keys()) {
        if (this.matchesPattern(key, operation)) {
          this.windows.delete(key);
        }
      }
    } else {
      // Reset all operations
      this.windows.clear();
      this.tokenBuckets.clear();
      this.stats.totalChecked = 0;
      this.stats.allowed = 0;
      this.stats.denied = 0;
      this.stats.operationStats.clear();
    }
  }
  
  async getStats(): Promise<RateLimitStats> {
    const operationStats: Record<string, { checked: number; allowed: number; denied: number; avgWeight: number }> = {};
    
    for (const [op, stats] of this.stats.operationStats) {
      operationStats[op] = {
        checked: stats.checked,
        allowed: stats.allowed,
        denied: stats.denied,
        avgWeight: stats.totalWeight / Math.max(stats.checked, 1)
      };
    }
    
    // Calculate memory usage estimate
    const memoryUsageKB = this.estimateMemoryUsage();
    
    // Calculate peak operations
    let peakOperations = 0;
    for (const window of this.windows.values()) {
      peakOperations = Math.max(peakOperations, window.count);
    }
    
    // Calculate operations per second
    const totalOperations = this.stats.allowed;
    const uptimeSeconds = process.uptime();
    const operationsPerSecond = totalOperations / Math.max(uptimeSeconds, 1);
    
    return {
      totalChecked: this.stats.totalChecked,
      allowed: this.stats.allowed,
      denied: this.stats.denied,
      allowRate: this.stats.totalChecked > 0 ? this.stats.allowed / this.stats.totalChecked : 1,
      operationsPerSecond,
      peakOperations,
      operationStats,
      memoryUsageKB
    };
  }
  
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean up expired windows
    for (const [operation, window] of this.windows.entries()) {
      const rule = this.findApplicableRule(operation);
      if (!rule) continue;
      
      const windowStart = now - rule.windowMs;
      
      // Remove expired operations from window
      const beforeCount = window.operations.length;
      window.operations = window.operations.filter(op => op.timestamp > windowStart);
      
      // Update window stats
      window.count = window.operations.length;
      window.totalWeight = window.operations.reduce((sum, op) => sum + op.weight, 0);
      
      cleanedCount += beforeCount - window.operations.length;
      
      // Remove empty windows
      if (window.operations.length === 0) {
        this.windows.delete(operation);
      }
    }
    
    // Clean up orphaned token buckets
    for (const operation of this.tokenBuckets.keys()) {
      if (!this.findApplicableRule(operation)) {
        this.tokenBuckets.delete(operation);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
  
  async adjustLimit(
    operation: string, 
    multiplier: number, 
    durationMs: number = 60000
  ): Promise<void> {
    const rule = this.findApplicableRule(operation);
    if (!rule) return;
    
    // Create temporary adjusted rule
    const adjustedRule: RateLimitRule = {
      ...rule,
      maxOperations: Math.max(1, Math.floor(rule.maxOperations * multiplier)),
      ruleId: `${rule.ruleId || operation}_adjusted_${Date.now()}`
    };
    
    // Apply the adjustment
    await this.configureLimit(operation, adjustedRule);
    
    // Schedule restoration of original rule
    setTimeout(async () => {
      await this.configureLimit(operation, rule);
    }, durationMs);
  }
  
  /**
   * Find the most specific applicable rule for an operation
   */
  private findApplicableRule(operation: string): RateLimitRule | undefined {
    // First, try exact match
    if (this.rules.has(operation)) {
      return this.rules.get(operation);
    }
    
    // Then try pattern matching, prefer more specific patterns
    const patterns = Array.from(this.rules.keys())
      .filter(pattern => this.matchesPattern(operation, pattern))
      .sort((a, b) => b.length - a.length); // More specific (longer) patterns first
    
    return patterns.length > 0 ? this.rules.get(patterns[0]) : undefined;
  }
  
  /**
   * Check if an operation matches a pattern (supports wildcards)
   */
  private matchesPattern(operation: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === operation) return true;
    
    // Convert pattern to regex (simple wildcard support)
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
      .replace(/\*/g, '.*'); // Convert * to .*
    
    return new RegExp(`^${regexPattern}$`).test(operation);
  }
  
  /**
   * Check rate limit using specific rule and algorithm
   */
  private async checkLimitWithRule(
    operation: string,
    rule: RateLimitRule,
    weight: number,
    now: number,
    metadata?: Record<string, unknown>
  ): Promise<RateLimitCheckResult> {
    switch (rule.algorithm) {
      case 'sliding_window':
        return this.checkSlidingWindow(operation, rule, weight, now, metadata);
      case 'token_bucket':
        return this.checkTokenBucket(operation, rule, weight, now, metadata);
      case 'fixed_window':
        return this.checkFixedWindow(operation, rule, weight, now, metadata);
      case 'leaky_bucket':
        return this.checkLeakyBucket(operation, rule, weight, now, metadata);
      default:
        // Fallback to sliding window
        return this.checkSlidingWindow(operation, rule, weight, now, metadata);
    }
  }
  
  /**
   * Sliding window rate limiting implementation
   */
  private checkSlidingWindow(
    operation: string,
    rule: RateLimitRule,
    weight: number,
    now: number,
    metadata?: Record<string, unknown>
  ): RateLimitCheckResult {
    const window = this.getOrCreateWindow(operation, now);
    const windowStart = now - rule.windowMs;
    
    // Clean expired operations
    window.operations = window.operations.filter(op => op.timestamp > windowStart);
    window.count = window.operations.length;
    window.totalWeight = window.operations.reduce((sum, op) => sum + op.weight, 0);
    
    // Check if adding this operation would exceed limits
    const newTotal = window.totalWeight + weight;
    const allowed = newTotal <= rule.maxOperations;
    
    return {
      allowed,
      remaining: Math.max(0, rule.maxOperations - window.totalWeight),
      resetTimeMs: rule.windowMs,
      rule,
      metadata: {
        windowStart,
        currentCount: window.count,
        algorithmState: { totalWeight: window.totalWeight, newTotal }
      }
    };
  }
  
  /**
   * Token bucket rate limiting implementation
   */
  private checkTokenBucket(
    operation: string,
    rule: RateLimitRule,
    weight: number,
    now: number,
    metadata?: Record<string, unknown>
  ): RateLimitCheckResult {
    const bucket = this.getOrCreateTokenBucket(operation, rule, now);
    
    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(rule.burstSize || rule.maxOperations, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if enough tokens available
    const allowed = bucket.tokens >= weight;
    
    if (allowed) {
      bucket.tokens -= weight;
    }
    
    const retryAfterMs = allowed ? undefined : Math.ceil((weight - bucket.tokens) / bucket.refillRate);
    
    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetTimeMs: rule.windowMs,
      retryAfterMs,
      rule,
      metadata: {
        windowStart: now,
        currentCount: Math.floor(rule.maxOperations - bucket.tokens),
        algorithmState: { tokens: bucket.tokens, refillRate: bucket.refillRate }
      }
    };
  }
  
  /**
   * Fixed window rate limiting implementation
   */
  private checkFixedWindow(
    operation: string,
    rule: RateLimitRule,
    weight: number,
    now: number,
    metadata?: Record<string, unknown>
  ): RateLimitCheckResult {
    // Calculate current window start
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    const window = this.getOrCreateWindow(operation, windowStart);
    
    // Reset if window has expired
    if (window.startTime < windowStart) {
      window.operations = [];
      window.count = 0;
      window.totalWeight = 0;
      window.startTime = windowStart;
    }
    
    // Check if adding this operation would exceed limits
    const newTotal = window.totalWeight + weight;
    const allowed = newTotal <= rule.maxOperations;
    
    const resetTimeMs = (windowStart + rule.windowMs) - now;
    
    return {
      allowed,
      remaining: Math.max(0, rule.maxOperations - window.totalWeight),
      resetTimeMs,
      rule,
      metadata: {
        windowStart,
        currentCount: window.count,
        algorithmState: { totalWeight: window.totalWeight, newTotal }
      }
    };
  }
  
  /**
   * Leaky bucket rate limiting implementation
   */
  private checkLeakyBucket(
    operation: string,
    rule: RateLimitRule,
    weight: number,
    now: number,
    metadata?: Record<string, unknown>
  ): RateLimitCheckResult {
    const window = this.getOrCreateWindow(operation, now);
    const leakRate = rule.maxOperations / rule.windowMs; // Operations per ms
    
    // Leak operations based on time elapsed
    const elapsed = now - window.startTime;
    const leaked = elapsed * leakRate;
    window.totalWeight = Math.max(0, window.totalWeight - leaked);
    window.startTime = now;
    
    // Remove leaked operations from the front of the queue
    let remainingLeak = leaked;
    while (remainingLeak > 0 && window.operations.length > 0) {
      const op = window.operations[0];
      if (remainingLeak >= op.weight) {
        remainingLeak -= op.weight;
        window.operations.shift();
        window.count--;
      } else {
        break;
      }
    }
    
    // Check if bucket has capacity
    const newTotal = window.totalWeight + weight;
    const allowed = newTotal <= rule.maxOperations;
    
    const retryAfterMs = allowed ? undefined : Math.ceil((newTotal - rule.maxOperations) / leakRate);
    
    return {
      allowed,
      remaining: Math.max(0, rule.maxOperations - window.totalWeight),
      resetTimeMs: Math.ceil(window.totalWeight / leakRate),
      retryAfterMs,
      rule,
      metadata: {
        windowStart: window.startTime,
        currentCount: window.count,
        algorithmState: { totalWeight: window.totalWeight, leakRate }
      }
    };
  }
  
  /**
   * Record usage with specific rule
   */
  private async recordUsageWithRule(
    operation: string,
    rule: RateLimitRule,
    weight: number,
    now: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (rule.algorithm === 'token_bucket') {
      // Token bucket already recorded usage in checkTokenBucket
      return;
    }
    
    const window = this.getOrCreateWindow(operation, now);
    
    // Add operation to window
    window.operations.push({ timestamp: now, weight, metadata });
    window.count++;
    window.totalWeight += weight;
    
    // Limit window history size to prevent memory growth
    if (window.operations.length > this.defaults.maxWindowHistory) {
      const excess = window.operations.length - this.defaults.maxWindowHistory;
      const removed = window.operations.splice(0, excess);
      window.count -= excess;
      window.totalWeight -= removed.reduce((sum, op) => sum + op.weight, 0);
    }
  }
  
  /**
   * Get or create a rate limit window for an operation
   */
  private getOrCreateWindow(operation: string, now: number): RateLimitWindow {
    if (!this.windows.has(operation)) {
      this.windows.set(operation, {
        startTime: now,
        operations: [],
        count: 0,
        totalWeight: 0
      });
    }
    return this.windows.get(operation)!;
  }
  
  /**
   * Get or create a token bucket for an operation
   */
  private getOrCreateTokenBucket(operation: string, rule: RateLimitRule, now: number): TokenBucketState {
    if (!this.tokenBuckets.has(operation)) {
      this.initializeTokenBucket(operation, rule);
    }
    return this.tokenBuckets.get(operation)!;
  }
  
  /**
   * Initialize token bucket state for an operation
   */
  private initializeTokenBucket(operation: string, rule: RateLimitRule): void {
    const refillRate = rule.maxOperations / rule.windowMs; // Tokens per millisecond
    this.tokenBuckets.set(operation, {
      tokens: rule.burstSize || rule.maxOperations,
      lastRefill: Date.now(),
      refillRate
    });
  }
  
  /**
   * Update operation statistics
   */
  private updateOperationStats(operation: string, type: 'checked' | 'allowed' | 'denied', weight: number): void {
    if (!this.stats.operationStats.has(operation)) {
      this.stats.operationStats.set(operation, {
        checked: 0,
        allowed: 0,
        denied: 0,
        totalWeight: 0
      });
    }
    
    const stats = this.stats.operationStats.get(operation)!;
    stats[type]++;
    stats.totalWeight += weight;
  }
  
  /**
   * Validate rate limit rule configuration
   */
  private validateRule(rule: RateLimitRule): void {
    if (rule.maxOperations <= 0) {
      throw new Error('maxOperations must be positive');
    }
    if (rule.windowMs <= 0) {
      throw new Error('windowMs must be positive');
    }
    if (rule.burstSize && rule.burstSize < rule.maxOperations) {
      throw new Error('burstSize must be >= maxOperations');
    }
  }
  
  /**
   * Clean up windows for operations matching a pattern
   */
  private cleanupOperationWindows(pattern: string): void {
    for (const operation of this.windows.keys()) {
      if (this.matchesPattern(operation, pattern)) {
        this.windows.delete(operation);
      }
    }
  }
  
  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, this.defaults.cleanupIntervalMs);
  }
  
  /**
   * Estimate memory usage of rate limiting data
   */
  private estimateMemoryUsage(): number {
    let sizeBytes = 0;
    
    // Rules map
    sizeBytes += this.rules.size * 200; // Estimate per rule
    
    // Windows map
    for (const window of this.windows.values()) {
      sizeBytes += 100; // Base window size
      sizeBytes += window.operations.length * 50; // Per operation
    }
    
    // Token buckets map
    sizeBytes += this.tokenBuckets.size * 100; // Per bucket
    
    // Stats
    sizeBytes += this.stats.operationStats.size * 80; // Per operation stats
    
    return Math.ceil(sizeBytes / 1024); // Convert to KB
  }
  
  /**
   * Cleanup resources when service is destroyed
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.windows.clear();
    this.tokenBuckets.clear();
    this.rules.clear();
    this.stats.operationStats.clear();
  }
}