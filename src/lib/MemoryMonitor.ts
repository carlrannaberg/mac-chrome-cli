/**
 * Memory monitoring and leak prevention utilities
 * Provides proactive memory management and leak detection
 */

import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';
import { getMemoryUsage } from './performance.js';
import { getLogger } from './logger.js';

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  timestamp: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakDetection {
  potentialLeak: boolean;
  growthRate: number; // MB per minute
  suggestions: string[];
  snapshots: MemorySnapshot[];
}

/**
 * Memory monitoring configuration
 */
export interface MemoryMonitorConfig {
  /** Monitoring interval in milliseconds */
  interval: number;
  /** Maximum number of snapshots to keep */
  maxSnapshots: number;
  /** Memory growth threshold in MB per minute to trigger alerts */
  growthThreshold: number;
  /** RSS memory limit in MB to trigger cleanup */
  rssLimit: number;
  /** Heap used memory limit in MB to trigger cleanup */
  heapLimit: number;
}

/**
 * Default memory monitor configuration
 */
const DEFAULT_CONFIG: MemoryMonitorConfig = {
  interval: 30000, // 30 seconds
  maxSnapshots: 20, // Keep last 20 snapshots (10 minutes of data)
  growthThreshold: 5, // 5MB/minute growth triggers alert
  rssLimit: 200, // 200MB RSS limit
  heapLimit: 150, // 150MB heap limit
};

/**
 * Memory monitor class for proactive memory management
 */
export class MemoryMonitor extends EventEmitter {
  private config: MemoryMonitorConfig;
  private snapshots: LRUCache<number, MemorySnapshot>;
  private monitorInterval: NodeJS.Timeout | null = null;
  private cleanupCallbacks: Array<() => void> = [];
  private isActive = false;

  constructor(config: Partial<MemoryMonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.snapshots = new LRUCache<number, MemorySnapshot>({
      max: this.config.maxSnapshots,
      ttl: 1000 * 60 * 15, // 15 minute TTL
      allowStale: false
    });

    // Set up event handlers
    this.on('memoryWarning', this.handleMemoryWarning.bind(this));
    this.on('potentialLeak', this.handlePotentialLeak.bind(this));
  }

  /**
   * Start memory monitoring
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.takeSnapshot(); // Initial snapshot
    
    this.monitorInterval = setInterval(() => {
      this.takeSnapshot();
      this.checkMemoryLimits();
      this.detectPotentialLeaks();
    }, this.config.interval);

    this.emit('monitoringStarted');
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Take a memory usage snapshot
   */
  takeSnapshot(): MemorySnapshot {
    const usage = getMemoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      ...usage
    };

    this.snapshots.set(snapshot.timestamp, snapshot);
    this.emit('snapshotTaken', snapshot);
    
    return snapshot;
  }

  /**
   * Register a cleanup callback that will be called when memory limits are exceeded
   */
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Execute all registered cleanup callbacks
   */
  executeCleanup(): void {
    let cleanedItems = 0;
    
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
        cleanedItems++;
      } catch (error) {
        const logger = getLogger();
        logger.error('Memory cleanup callback failed', error, 'memory-monitor', {
          operation: 'cleanup',
          item: cleanedItems
        });
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.emit('cleanupExecuted', { cleanedItems });
  }

  /**
   * Check current memory usage against configured limits
   */
  private checkMemoryLimits(): void {
    const current = this.getCurrentSnapshot();
    if (!current) return;

    const warnings = [];

    if (current.rss > this.config.rssLimit) {
      warnings.push(`RSS memory usage (${current.rss}MB) exceeds limit (${this.config.rssLimit}MB)`);
    }

    if (current.heapUsed > this.config.heapLimit) {
      warnings.push(`Heap memory usage (${current.heapUsed}MB) exceeds limit (${this.config.heapLimit}MB)`);
    }

    if (warnings.length > 0) {
      this.emit('memoryWarning', { warnings, snapshot: current });
    }
  }

  /**
   * Detect potential memory leaks based on growth patterns
   */
  detectPotentialLeaks(): MemoryLeakDetection | null {
    const recentSnapshots = this.getRecentSnapshots(5); // Last 5 snapshots
    
    if (recentSnapshots.length < 3) {
      return null; // Need at least 3 data points
    }

    // Calculate memory growth rate
    const first = recentSnapshots[0];
    const last = recentSnapshots[recentSnapshots.length - 1];
    
    if (!first || !last) return null;
    
    const timeDiffMinutes = (last.timestamp - first.timestamp) / (1000 * 60);
    
    if (timeDiffMinutes === 0) return null;

    const heapGrowthRate = (last.heapUsed - first.heapUsed) / timeDiffMinutes;
    const rssGrowthRate = (last.rss - first.rss) / timeDiffMinutes;
    
    const maxGrowthRate = Math.max(heapGrowthRate, rssGrowthRate);
    const potentialLeak = maxGrowthRate > this.config.growthThreshold;

    const suggestions = [];
    if (heapGrowthRate > this.config.growthThreshold) {
      suggestions.push('Heap memory is growing rapidly - check for unclosed resources or cached data');
    }
    if (rssGrowthRate > this.config.growthThreshold) {
      suggestions.push('RSS memory is growing rapidly - check for memory-intensive operations');
    }
    if (potentialLeak) {
      suggestions.push('Consider calling clearPerformanceCaches() or executeCleanup()');
    }

    const detection: MemoryLeakDetection = {
      potentialLeak,
      growthRate: maxGrowthRate,
      suggestions,
      snapshots: recentSnapshots
    };

    if (potentialLeak) {
      this.emit('potentialLeak', detection);
    }

    return detection;
  }

  /**
   * Handle memory warning events
   */
  private handleMemoryWarning(data: { warnings: string[]; snapshot: MemorySnapshot }): void {
    const logger = getLogger();
    logger.warn('Memory usage warning detected', 'memory-monitor', {
      warnings: data.warnings,
      memorySnapshot: data.snapshot,
      operation: 'memory-warning'
    });
    
    // Attempt automatic cleanup
    this.executeCleanup();
  }

  /**
   * Handle potential leak detection
   */
  private handlePotentialLeak(detection: MemoryLeakDetection): void {
    const logger = getLogger();
    logger.security('Potential memory leak detected', 'memory-monitor', {
      growthRate: detection.growthRate,
      suggestions: detection.suggestions,
      snapshotCount: detection.snapshots.length,
      operation: 'leak-detection'
    });
  }

  /**
   * Get current memory snapshot
   */
  getCurrentSnapshot(): MemorySnapshot | null {
    const snapshots = [...this.snapshots.values()].sort((a, b) => b.timestamp - a.timestamp);
    return snapshots[0] || null;
  }

  /**
   * Get recent snapshots
   */
  getRecentSnapshots(count: number): MemorySnapshot[] {
    return [...this.snapshots.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
      .reverse(); // Return in chronological order
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): MemorySnapshot[] {
    return [...this.snapshots.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all monitoring data
   */
  clearHistory(): void {
    this.snapshots.clear();
    this.emit('historyCleared');
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    isActive: boolean;
    snapshotCount: number;
    currentMemory: MemorySnapshot | null;
    config: MemoryMonitorConfig;
  } {
    return {
      isActive: this.isActive,
      snapshotCount: this.snapshots.size,
      currentMemory: this.getCurrentSnapshot(),
      config: this.config
    };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MemoryMonitorConfig>): void {
    const wasActive = this.isActive;
    
    if (wasActive) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasActive) {
      this.start();
    }

    this.emit('configUpdated', this.config);
  }
}

/**
 * Global memory monitor instance
 */
export const memoryMonitor = new MemoryMonitor();

/**
 * Initialize memory monitoring with cleanup callbacks
 */
export function initializeMemoryMonitoring(): void {
  // Import cleanup functions dynamically to avoid circular imports
  import('./performance.js').then(({ clearPerformanceCaches }) => {
    memoryMonitor.registerCleanupCallback(clearPerformanceCaches);
  });

  import('../services/AppleScriptService.js').then(({ appleScriptService }) => {
    memoryMonitor.registerCleanupCallback(() => {
      appleScriptService.clearCaches();
    });
  });

  // Start monitoring
  memoryMonitor.start();
  
  console.log('Memory monitoring initialized');
}

/**
 * Graceful shutdown memory monitoring
 */
export function shutdownMemoryMonitoring(): void {
  memoryMonitor.stop();
  console.log('Memory monitoring shutdown');
}