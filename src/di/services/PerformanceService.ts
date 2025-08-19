/**
 * Performance Service Implementation
 * Provides benchmarking and performance monitoring
 */

import { randomUUID } from 'crypto';
import type { IPerformanceService, PerformanceBenchmark, PerformanceStats } from '../IPerformanceService.js';

export class PerformanceService implements IPerformanceService {
  private readonly benchmarks = new Map<string, PerformanceBenchmark>();
  private readonly maxBenchmarks: number;

  constructor(options: { maxBenchmarks?: number } = {}) {
    this.maxBenchmarks = options.maxBenchmarks || 1000;
  }

  /**
   * Start a performance benchmark
   */
  startBenchmark(name: string, metadata?: Record<string, unknown>): string {
    const id = randomUUID();
    const benchmark: PerformanceBenchmark = {
      id,
      name,
      startTime: Date.now(),
      ...(metadata && { metadata })
    };
    
    // Prevent memory leaks by limiting benchmark count
    if (this.benchmarks.size >= this.maxBenchmarks) {
      // Remove oldest benchmark
      const oldestId = this.benchmarks.keys().next().value;
      if (oldestId !== undefined) {
        this.benchmarks.delete(oldestId);
      }
    }
    
    this.benchmarks.set(id, benchmark);
    return id;
  }

  /**
   * End a performance benchmark
   */
  endBenchmark(id: string, success: boolean = true): PerformanceBenchmark | undefined {
    const benchmark = this.benchmarks.get(id);
    if (!benchmark || benchmark.endTime) {
      return undefined;
    }
    
    const endTime = Date.now();
    benchmark.endTime = endTime;
    benchmark.duration = endTime - benchmark.startTime;
    benchmark.success = success;
    
    return benchmark;
  }

  /**
   * Get benchmark by ID
   */
  getBenchmark(id: string): PerformanceBenchmark | undefined {
    return this.benchmarks.get(id);
  }

  /**
   * Get all benchmarks
   */
  getAllBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Clear all benchmarks
   */
  clearBenchmarks(): void {
    this.benchmarks.clear();
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const benchmarks = Array.from(this.benchmarks.values());
    const completed = benchmarks.filter(b => b.endTime !== undefined);
    const successful = completed.filter(b => b.success === true);
    
    const totalDuration = completed.reduce((sum, b) => sum + (b.duration || 0), 0);
    const averageDuration = completed.length > 0 ? totalDuration / completed.length : 0;
    const successRate = completed.length > 0 ? successful.length / completed.length : 0;
    
    const memoryUsage = this.getMemoryUsage();
    
    return {
      totalBenchmarks: benchmarks.length,
      activeBenchmarks: benchmarks.filter(b => b.endTime === undefined).length,
      averageDuration,
      successRate,
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100, // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
      }
    };
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
}
