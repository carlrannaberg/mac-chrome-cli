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
import type { IDisposable } from '../ServiceContainer.js';

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
  /** Last activity timestamp for cleanup purposes */
  lastActivity: number;
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
export class RateLimiterService implements IRateLimiterService, IDisposable {
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
    cleanupIntervalMs: 15000, // More frequent cleanup - every 15 seconds
    maxWindowHistory: 500, // Reduced from 1000 to prevent memory growth
    maxMemoryLimitKB: 10 * 1024, // Reduced from 50MB to 10MB
    memoryWarningThresholdKB: 8 * 1024, // Warning at 8MB
    maxWindowsPerOperation: 10 // Limit windows per operation pattern
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
    
    // Restart cleanup timer to adapt to new load
    this.startCleanupTimer();
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
      for (const key of Array.from(this.windows.keys())) {
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
    
    for (const [op, stats] of Array.from(this.stats.operationStats)) {
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
    for (const window of Array.from(this.windows.values())) {
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

  /**
   * Get detailed memory statistics for monitoring
   */
  public getMemoryStats(): {
    memoryUsageKB: number;
    windowCount: number;
    totalOperations: number;
    averageOperationsPerWindow: number;
  } {
    const memoryUsageKB = this.estimateMemoryUsage();
    const windowCount = this.windows.size;
    let totalOperations = 0;
    
    for (const window of Array.from(this.windows.values())) {
      totalOperations += window.operations.length;
    }
    
    return {
      memoryUsageKB,
      windowCount,
      totalOperations,
      averageOperationsPerWindow: windowCount > 0 ? totalOperations / windowCount : 0
    };
  }
  
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    
    // Use the new comprehensive cleanup and track cleaned count
    cleanedCount += this.cleanupExpiredWindows();
    
    // Clean up orphaned token buckets
    for (const operation of Array.from(this.tokenBuckets.keys())) {
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
    window.lastActivity = now;
    
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
    
    window.lastActivity = now;
    
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
    window.lastActivity = now;
    
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
    
    await this.recordOperation(operation, rule, weight, now, metadata);
  }

  /**
   * Record an operation with memory-safe handling
   */
  private async recordOperation(
    operation: string,
    rule: RateLimitRule,
    weight: number = 1,
    now: number = Date.now(),
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const window = this.getOrCreateWindow(operation, now);
    
    // Add operation
    window.operations.push({
      timestamp: now,
      weight,
      metadata
    });
    window.count++;
    window.totalWeight += weight;
    window.lastActivity = now;
    
    // Limit operations array size to prevent memory growth
    const MAX_OPERATIONS_PER_WINDOW = 10000;
    if (window.operations.length > MAX_OPERATIONS_PER_WINDOW) {
      // Keep only recent operations within the window
      const cutoff = now - rule.windowMs;
      window.operations = window.operations
        .filter(op => op.timestamp >= cutoff)
        .slice(-MAX_OPERATIONS_PER_WINDOW);
      
      // Recalculate window stats after cleanup
      window.count = window.operations.length;
      window.totalWeight = window.operations.reduce((sum, op) => sum + op.weight, 0);
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
        totalWeight: 0,
        lastActivity: now
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
    for (const operation of Array.from(this.windows.keys())) {
      if (this.matchesPattern(operation, pattern)) {
        this.windows.delete(operation);
      }
    }
  }
  
  /**
   * Start automatic cleanup timer with adaptive scheduling
   */
  private startCleanupTimer(): void {
    // Run cleanup more frequently under high load
    const baseInterval = 60000; // 1 minute
    const loadFactor = Math.min(this.windows.size / 100, 10); // Scale with load
    const cleanupInterval = Math.max(baseInterval / (1 + loadFactor), 10000); // Min 10s
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredWindows();
      this.enforceMemoryLimit(); // Add memory pressure relief
    }, cleanupInterval);
  }

  /**
   * Clean up expired windows with lastActivity tracking
   */
  private cleanupExpiredWindows(): number {
    const now = Date.now();
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;
    
    for (const [operation, window] of Array.from(this.windows.entries())) {
      const rule = this.findApplicableRule(operation);
      if (!rule) {
        this.windows.delete(operation);
        cleanedCount++;
        continue;
      }
      
      // Remove if no activity for too long
      if (now - window.lastActivity > maxIdleTime) {
        this.windows.delete(operation);
        cleanedCount++;
        continue;
      }
      
      // Clean expired operations
      const windowStart = now - rule.windowMs;
      const beforeCount = window.operations.length;
      window.operations = window.operations.filter(op => op.timestamp > windowStart);
      
      // Update window stats
      window.count = window.operations.length;
      window.totalWeight = window.operations.reduce((sum, op) => sum + op.weight, 0);
      
      // Count cleaned operations
      cleanedCount += beforeCount - window.operations.length;
      
      // Remove empty windows
      if (window.operations.length === 0) {
        this.windows.delete(operation);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Enforce memory limits and perform emergency cleanup if needed
   */
  private enforceMemoryLimit(): void {
    const currentMemoryKB = this.estimateMemoryUsage();
    const memoryLimitKB = this.defaults.maxMemoryLimitKB;
    const memoryWarningKB = this.defaults.memoryWarningThresholdKB;
    
    if (currentMemoryKB > memoryWarningKB) {
      // Progressive cleanup based on memory pressure
      const overageRatio = currentMemoryKB / memoryLimitKB;
      let cleanupRatio = 0.2; // Start with 20% cleanup
      
      if (overageRatio > 1.2) {
        cleanupRatio = 0.5; // 50% cleanup for severe overage
      } else if (overageRatio > 1.0) {
        cleanupRatio = 0.3; // 30% cleanup for mild overage
      }
      
      // Sort windows by activity and memory impact
      const sortedWindows = Array.from(this.windows.entries())
        .sort((a, b) => {
          const aScore = a[1].lastActivity + (a[1].operations.length * 1000);
          const bScore = b[1].lastActivity + (b[1].operations.length * 1000);
          return aScore - bScore; // Oldest and largest first
        });
      
      const targetCleanupCount = Math.floor(sortedWindows.length * cleanupRatio);
      let cleanedCount = 0;
      
      for (let i = 0; i < targetCleanupCount && i < sortedWindows.length; i++) {
        this.windows.delete(sortedWindows[i][0]);
        cleanedCount++;
      }
      
      // Also cleanup operation stats for removed operations
      for (const [operation] of sortedWindows.slice(0, targetCleanupCount)) {
        this.stats.operationStats.delete(operation);
      }
      
      if (currentMemoryKB > memoryLimitKB) {
        console.warn(`Rate limiter memory limit exceeded (${currentMemoryKB}KB). Emergency cleanup: removed ${cleanedCount} windows.`);
      } else {
        console.info(`Rate limiter memory warning (${currentMemoryKB}KB). Preventive cleanup: removed ${cleanedCount} windows.`);
      }
    }
    
    // Enforce per-operation window limits
    this.enforcePerOperationLimits();
  }
  
  /**
   * Estimate memory usage of rate limiting data with improved accuracy
   */
  private estimateMemoryUsage(): number {
    let sizeBytes = 0;
    
    // More accurate estimation based on actual object sizes
    // Rule object: ~300 bytes per rule (was 200)
    sizeBytes += this.rules.size * 300;
    
    for (const window of Array.from(this.windows.values())) {
      // Base window object: ~150 bytes (was 100)
      sizeBytes += 150;
      
      // Each operation: ~80 bytes base (was 50)
      sizeBytes += window.operations.length * 80;
      
      // Account for metadata objects which can be large
      const metadataSize = window.operations.reduce((sum, op) => {
        if (op.metadata) {
          // Estimate metadata size more accurately
          const metadataStr = JSON.stringify(op.metadata);
          return sum + metadataStr.length * 2; // 2 bytes per char in memory
        }
        return sum;
      }, 0);
      sizeBytes += metadataSize;
    }
    
    // Token buckets map
    sizeBytes += this.tokenBuckets.size * 100; // Per bucket
    
    // Stats
    sizeBytes += this.stats.operationStats.size * 80; // Per operation stats
    
    // Add 20% buffer for object overhead and growth
    sizeBytes = Math.ceil(sizeBytes * 1.2);
    
    // Convert to KB
    return Math.ceil(sizeBytes / 1024);
  }
  
  /**
   * Enforce per-operation window limits to prevent runaway memory growth
   */
  private enforcePerOperationLimits(): void {
    const maxWindowsPerOp = this.defaults.maxWindowsPerOperation;
    
    // Group windows by operation pattern
    const operationGroups = new Map<string, string[]>();
    
    for (const [operation] of this.windows.entries()) {
      // Extract base pattern (remove specific IDs, timestamps, etc.)
      const basePattern = this.extractBasePattern(operation);
      
      if (!operationGroups.has(basePattern)) {
        operationGroups.set(basePattern, []);
      }
      operationGroups.get(basePattern)!.push(operation);
    }
    
    // Remove excess windows for each operation pattern
    for (const [pattern, operations] of operationGroups.entries()) {
      if (operations.length > maxWindowsPerOp) {
        // Sort by last activity and keep only the most recent
        const sortedOps = operations
          .map(op => ({ op, activity: this.windows.get(op)?.lastActivity || 0 }))
          .sort((a, b) => b.activity - a.activity)
          .slice(maxWindowsPerOp); // Remove excess
        
        for (const { op } of sortedOps) {
          this.windows.delete(op);
        }
      }
    }
  }
  
  /**
   * Extract base operation pattern for grouping related operations
   */
  private extractBasePattern(operation: string): string {
    // Remove common variable parts like IDs, timestamps, etc.
    return operation
      .replace(/\b\d{10,}\b/g, '{timestamp}') // Timestamps
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/g, '{uuid}') // UUIDs
      .replace(/\b\d+\b/g, '{id}') // Generic IDs
      .replace(/\{[^}]+\}/g, '{var}'); // Already parameterized variables
  }
  
  /**
   * Cleanup resources when service is destroyed
   */
  destroy(): void {
    this.dispose();
  }

  /**
   * Dispose of the service and clean up all resources
   * Implements IDisposable interface for proper lifecycle management
   */
  dispose(): void {
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