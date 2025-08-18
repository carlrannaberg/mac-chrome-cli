/**
 * Performance Service Interface
 * Provides performance monitoring and benchmark functionality
 */

export interface PerformanceBenchmark {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

export interface PerformanceStats {
  totalBenchmarks: number;
  activeBenchmarks: number;
  averageDuration: number;
  successRate: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface IPerformanceService {
  /**
   * Start a performance benchmark
   */
  startBenchmark(name: string, metadata?: Record<string, unknown>): string;
  
  /**
   * End a performance benchmark
   */
  endBenchmark(id: string, success?: boolean): PerformanceBenchmark | undefined;
  
  /**
   * Get benchmark by ID
   */
  getBenchmark(id: string): PerformanceBenchmark | undefined;
  
  /**
   * Get all benchmarks
   */
  getAllBenchmarks(): PerformanceBenchmark[];
  
  /**
   * Clear all benchmarks
   */
  clearBenchmarks(): void;
  
  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats;
  
  /**
   * Get memory usage information
   */
  getMemoryUsage(): NodeJS.MemoryUsage;
}
