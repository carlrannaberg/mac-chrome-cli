import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { execWithTimeout, ERROR_CODES, type ExecResult } from './util.js';

/**
 * Performance optimization utilities for mac-chrome-cli
 * Includes AppleScript caching, WebP optimization, and batching
 */

// AppleScript compilation cache
const scriptCache = new LRUCache<string, string>({
  max: 50, // Cache up to 50 compiled scripts
  ttl: 1000 * 60 * 15, // 15 minute TTL
  allowStale: false
});

// Coordinate calculation cache
const coordsCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 30, // 30 second TTL for coordinates
  allowStale: false
});

// WebP generation settings optimized for performance
export const WEBP_SETTINGS = {
  quality: 85,
  effort: 3, // Balance between compression and speed (0-6, 3 is good middle ground)
  smartSubsample: true,
  preset: 'default' as const
};

// Performance benchmarks
export interface PerformanceBenchmark {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

const activeBenchmarks = new Map<string, PerformanceBenchmark>();

/**
 * Start performance benchmark
 */
export function startBenchmark(operation: string, metadata?: Record<string, any>): string {
  const id = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  activeBenchmarks.set(id, {
    operation,
    startTime: performance.now(),
    success: false,
    metadata: metadata || {}
  });
  return id;
}

/**
 * End performance benchmark
 */
export function endBenchmark(id: string, success: boolean = true): PerformanceBenchmark | null {
  const benchmark = activeBenchmarks.get(id);
  if (!benchmark) return null;
  
  benchmark.endTime = performance.now();
  benchmark.duration = benchmark.endTime - benchmark.startTime;
  benchmark.success = success;
  
  activeBenchmarks.delete(id);
  return benchmark;
}

/**
 * Generate cache key for AppleScript
 */
function generateScriptCacheKey(script: string, tabIndex: number, windowIndex: number): string {
  const scriptHash = createHash('md5').update(script).digest('hex').substring(0, 8);
  return `${scriptHash}-${tabIndex}-${windowIndex}`;
}

/**
 * Optimized AppleScript execution with caching
 */
export async function execCachedAppleScript(
  script: string,
  tabIndex: number = 1,
  windowIndex: number = 1,
  timeoutMs: number = 10000
): Promise<ExecResult> {
  const benchmarkId = startBenchmark('applescript-exec', { 
    scriptLength: script.length,
    tabIndex,
    windowIndex
  });

  try {
    const cacheKey = generateScriptCacheKey(script, tabIndex, windowIndex);
    
    // Check if we have a cached result for this exact script combination
    let cachedScript = scriptCache.get(cacheKey);
    
    if (!cachedScript) {
      // Compile and cache the script template
      cachedScript = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    set targetWindow to window ${windowIndex}
    set targetTab to tab ${tabIndex} of targetWindow
    set jsResult to execute javascript "${script}" in targetTab
    return jsResult as string
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;
      
      scriptCache.set(cacheKey, cachedScript);
    }
    
    const result = await execWithTimeout('osascript', ['-e', cachedScript], timeoutMs);
    endBenchmark(benchmarkId, result.success);
    return result;
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    throw error;
  }
}

/**
 * Batch multiple AppleScript operations
 */
export async function execBatchAppleScript(
  operations: Array<{
    script: string;
    tabIndex?: number;
    windowIndex?: number;
  }>,
  timeoutMs: number = 15000
): Promise<ExecResult[]> {
  const benchmarkId = startBenchmark('applescript-batch', { 
    operationCount: operations.length 
  });

  try {
    // Build combined AppleScript that executes all operations
    const batchScript = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  set results to {}
  
  ${operations.map((op, index) => {
    const tabIndex = op.tabIndex || 1;
    const windowIndex = op.windowIndex || 1;
    return `
  try
    set targetWindow${index} to window ${windowIndex}
    set targetTab${index} to tab ${tabIndex} of targetWindow${index}
    set jsResult${index} to execute javascript "${op.script.replace(/"/g, '\\"')}" in targetTab${index}
    set end of results to (jsResult${index} as string)
  on error errorMessage${index}
    set end of results to ("ERROR: " & errorMessage${index})
  end try`;
  }).join('')}
  
  return results
end tell`;

    const result = await execWithTimeout('osascript', ['-e', batchScript], timeoutMs);
    
    if (result.success) {
      // Parse batch results and convert to individual ExecResult objects
      const outputs = result.stdout.split('\n').filter(line => line.trim());
      const results = operations.map((_, index) => ({
        success: !outputs[index]?.startsWith('ERROR:'),
        stdout: outputs[index] || '',
        stderr: outputs[index]?.startsWith('ERROR:') ? outputs[index].substring(6) : '',
        code: !outputs[index]?.startsWith('ERROR:') ? ERROR_CODES.OK : ERROR_CODES.UNKNOWN_ERROR,
        command: `batch-operation-${index}`
      }));
      
      endBenchmark(benchmarkId, true);
      return results;
    } else {
      // If batch fails, fall back to individual execution
      const results = await Promise.all(
        operations.map(op => execCachedAppleScript(op.script, op.tabIndex, op.windowIndex))
      );
      
      endBenchmark(benchmarkId, false);
      return results;
    }
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    throw error;
  }
}

/**
 * Optimized WebP creation with streaming and caching
 */
export async function createOptimizedWebP(
  imagePath: string,
  maxSizeBytes: number = 1.5 * 1024 * 1024,
  maxWidth: number = 1200
): Promise<{ buffer: Buffer; base64: string; size: number }> {
  const benchmarkId = startBenchmark('webp-creation', { 
    maxSizeBytes,
    maxWidth 
  });

  try {
    // Create optimized pipeline
    let pipeline = sharp(imagePath, {
      failOn: 'warning', // Don't fail on minor issues
      limitInputPixels: 268402689 // ~16MP limit for safety
    });
    
    // Get metadata once
    const metadata = await pipeline.metadata();
    
    // Calculate optimal resize dimensions
    let targetWidth = maxWidth;
    if (metadata.width && metadata.width <= maxWidth) {
      targetWidth = metadata.width; // Don't upscale
    }
    
    // Single pipeline for resize and conversion
    pipeline = pipeline
      .resize(targetWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
        kernel: 'lanczos3' // Good quality vs speed balance
      })
      .webp({
        ...WEBP_SETTINGS,
        quality: WEBP_SETTINGS.quality
      });
    
    let buffer = await pipeline.toBuffer();
    
    // If still too large, reduce quality iteratively
    if (buffer.length > maxSizeBytes) {
      let quality = 75;
      while (buffer.length > maxSizeBytes && quality >= 30) {
        pipeline = sharp(imagePath)
          .resize(targetWidth, null, {
            withoutEnlargement: true,
            fit: 'inside',
            kernel: 'lanczos3'
          })
          .webp({
            ...WEBP_SETTINGS,
            quality
          });
        
        buffer = await pipeline.toBuffer();
        quality -= 15;
      }
    }
    
    const result = {
      buffer,
      base64: buffer.toString('base64'),
      size: buffer.length
    };
    
    endBenchmark(benchmarkId, true);
    return result;
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    throw new Error(`Optimized WebP creation failed: ${error}`);
  }
}

/**
 * Cache coordinate calculations
 */
export function getCachedCoordinates(
  cacheKey: string,
  calculator: () => Promise<any>
): Promise<any> {
  const cached = coordsCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }
  
  return calculator().then(result => {
    if (result.success) {
      coordsCache.set(cacheKey, result);
    }
    return result;
  });
}

/**
 * Generate coordinate cache key
 */
export function generateCoordsCacheKey(
  selector?: string,
  x?: number,
  y?: number,
  windowIndex: number = 1
): string {
  if (selector) {
    return `sel-${selector}-${windowIndex}`;
  } else if (x !== undefined && y !== undefined) {
    return `xy-${x}-${y}-${windowIndex}`;
  }
  return `unknown-${Date.now()}`;
}

/**
 * Connection pool for Chrome operations
 */
class ChromeConnectionPool {
  private connections = new Map<string, { lastUsed: number; windowIndex: number }>();
  private maxConnections = 5;
  private connectionTTL = 30000; // 30 seconds
  
  getConnection(windowIndex: number = 1): string {
    const connectionId = `chrome-${windowIndex}`;
    const connection = this.connections.get(connectionId);
    
    if (connection && Date.now() - connection.lastUsed < this.connectionTTL) {
      connection.lastUsed = Date.now();
      return connectionId;
    }
    
    // Clean up old connections
    this.cleanup();
    
    // Create new connection
    this.connections.set(connectionId, {
      lastUsed: Date.now(),
      windowIndex
    });
    
    return connectionId;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [id, connection] of this.connections) {
      if (now - connection.lastUsed > this.connectionTTL) {
        this.connections.delete(id);
      }
    }
  }
  
  getStats(): { activeConnections: number; maxConnections: number } {
    this.cleanup();
    return {
      activeConnections: this.connections.size,
      maxConnections: this.maxConnections
    };
  }
}

export const chromeConnectionPool = new ChromeConnectionPool();

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
} {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
  };
}

/**
 * Performance statistics
 */
export function getPerformanceStats(): {
  cacheStats: {
    scriptCache: { size: number; maxSize: number };
    coordsCache: { size: number; maxSize: number };
  };
  connectionPool: { activeConnections: number; maxConnections: number };
  memory: ReturnType<typeof getMemoryUsage>;
} {
  return {
    cacheStats: {
      scriptCache: { size: scriptCache.size, maxSize: 50 },
      coordsCache: { size: coordsCache.size, maxSize: 100 }
    },
    connectionPool: chromeConnectionPool.getStats(),
    memory: getMemoryUsage()
  };
}

/**
 * Clear all performance caches
 */
export function clearPerformanceCaches(): void {
  scriptCache.clear();
  coordsCache.clear();
}

/**
 * Get performance recommendations based on current statistics
 */
export function getPerformanceRecommendations(): string[] {
  const stats = getPerformanceStats();
  const recommendations: string[] = [];
  
  // Cache hit rate recommendations
  const scriptCacheUsage = stats.cacheStats.scriptCache.size / stats.cacheStats.scriptCache.maxSize;
  const coordsCacheUsage = stats.cacheStats.coordsCache.size / stats.cacheStats.coordsCache.maxSize;
  
  if (scriptCacheUsage > 0.8) {
    recommendations.push('Consider increasing script cache size for high-frequency operations');
  }
  
  if (coordsCacheUsage > 0.8) {
    recommendations.push('Consider increasing coordinates cache size for repeated DOM queries');
  }
  
  // Memory usage recommendations
  if (stats.memory.heapUsed > 100) {
    recommendations.push('High memory usage detected - consider clearing caches or optimizing operations');
  }
  
  // Connection pool recommendations
  if (stats.connectionPool.activeConnections === stats.connectionPool.maxConnections) {
    recommendations.push('Connection pool at maximum capacity - consider increasing pool size');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance is optimal - no recommendations at this time');
  }
  
  return recommendations;
}
