import { Command } from 'commander';
import { 
  getPerformanceStats, 
  clearPerformanceCaches,
  startBenchmark,
  endBenchmark,
  getPerformanceRecommendations,
  executeBatchOperations
} from '../lib/performance.js';
import { memoryMonitor, initializeMemoryMonitoring } from '../lib/MemoryMonitor.js';
import { mouseClick } from '../lib/mouse.js';
import { captureViewport } from '../lib/capture.js';
import { captureOutline } from './snapshot.js';
import { typeText } from '../lib/input.js';
import { formatJSONResult, ERROR_CODES } from '../lib/util.js';

export interface BenchmarkResult {
  operation: string;
  targetMs: number;
  actualMs: number;
  success: boolean;
  passed: boolean;
  metadata?: Record<string, any>;
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  overallPassed: boolean;
  totalDuration: number;
  cacheStats: ReturnType<typeof getPerformanceStats>;
}

/**
 * Performance targets from specification
 */
const PERFORMANCE_TARGETS = {
  'click-element': 500,     // <500ms target
  'type-50-chars': 1000,    // <1000ms target for 50 chars
  'screenshot-viewport': 600, // <600ms target
  'snapshot-outline': 300,   // <300ms target
} as const;

/**
 * Benchmark click element performance
 */
async function benchmarkClick(): Promise<BenchmarkResult> {
  const operation = 'click-element';
  const targetMs = PERFORMANCE_TARGETS[operation];
  
  const benchmarkId = startBenchmark(operation);
  
  try {
    // Click on document body as a test (always available)
    const result = await mouseClick({ selector: 'body' });
    
    const benchmark = endBenchmark(benchmarkId, result.success);
    const actualMs = benchmark?.duration || 0;
    
    return {
      operation,
      targetMs,
      actualMs,
      success: result.success,
      passed: result.success && actualMs < targetMs,
      metadata: {
        coordinates: result.success ? result.data.coordinates : undefined,
        element: result.success ? result.data.element : undefined
      }
    };
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    return {
      operation,
      targetMs,
      actualMs: 0,
      success: false,
      passed: false,
      metadata: { error: String(error) }
    };
  }
}

/**
 * Benchmark typing performance
 */
async function benchmarkTyping(): Promise<BenchmarkResult> {
  const operation = 'type-50-chars';
  const targetMs = PERFORMANCE_TARGETS[operation];
  
  const benchmarkId = startBenchmark(operation);
  
  try {
    // Type 50 characters of test text
    const testText = 'This is a 50-character test for typing benchmark!';
    const result = await typeText(testText);
    
    const benchmark = endBenchmark(benchmarkId, result.success);
    const actualMs = benchmark?.duration || 0;
    
    return {
      operation,
      targetMs,
      actualMs,
      success: result.success,
      passed: result.success && actualMs < targetMs,
      metadata: {
        textLength: testText.length,
        wpm: testText.length > 0 ? (testText.length / 5) / (actualMs / 60000) : 0
      }
    };
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    return {
      operation,
      targetMs,
      actualMs: 0,
      success: false,
      passed: false,
      metadata: { error: String(error) }
    };
  }
}

/**
 * Benchmark screenshot performance
 */
async function benchmarkScreenshot(): Promise<BenchmarkResult> {
  const operation = 'screenshot-viewport';
  const targetMs = PERFORMANCE_TARGETS[operation];
  
  const benchmarkId = startBenchmark(operation);
  
  try {
    // Capture viewport screenshot with preview generation
    const result = await captureViewport({ preview: true });
    
    const benchmark = endBenchmark(benchmarkId, result.success);
    const actualMs = benchmark?.duration || 0;
    
    return {
      operation,
      targetMs,
      actualMs,
      success: result.success,
      passed: result.success && actualMs < targetMs,
      metadata: {
        path: result.path,
        previewSize: result.preview?.size,
        dimensions: result.metadata
      }
    };
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    return {
      operation,
      targetMs,
      actualMs: 0,
      success: false,
      passed: false,
      metadata: { error: String(error) }
    };
  }
}

/**
 * Benchmark snapshot performance
 */
async function benchmarkSnapshot(): Promise<BenchmarkResult> {
  const operation = 'snapshot-outline';
  const targetMs = PERFORMANCE_TARGETS[operation];
  
  const benchmarkId = startBenchmark(operation);
  
  try {
    // Capture page outline snapshot
    const result = await captureOutline({ visibleOnly: true });
    
    const benchmark = endBenchmark(benchmarkId, result.success);
    const actualMs = benchmark?.duration || 0;
    
    const nodeCount = result.success ? result.data?.nodes?.length || 0 : 0;
    
    return {
      operation,
      targetMs,
      actualMs,
      success: result.success,
      passed: result.success && actualMs < targetMs,
      metadata: {
        nodeCount,
        nodesPerMs: actualMs > 0 ? nodeCount / actualMs : 0,
        url: result.success ? result.data?.meta?.url : undefined
      }
    };
    
  } catch (error) {
    endBenchmark(benchmarkId, false);
    return {
      operation,
      targetMs,
      actualMs: 0,
      success: false,
      passed: false,
      metadata: { error: String(error) }
    };
  }
}

/**
 * Run complete performance benchmark suite
 */
async function runBenchmarkSuite(iterations: number = 1): Promise<BenchmarkSuite> {
  const suiteName = `Performance Benchmark Suite (${iterations} iteration${iterations > 1 ? 's' : ''})`;
  const suiteStartTime = Date.now();
  
  console.log(`\nStarting ${suiteName}...`);
  console.log('Performance Targets:');
  Object.entries(PERFORMANCE_TARGETS).forEach(([op, target]) => {
    console.log(`  ${op}: <${target}ms`);
  });
  console.log('');
  
  const allResults: BenchmarkResult[] = [];
  
  for (let i = 0; i < iterations; i++) {
    if (iterations > 1) {
      console.log(`Iteration ${i + 1}/${iterations}:`);
    }
    
    // Clear caches between iterations for fair testing
    if (i > 0) {
      clearPerformanceCaches();
    }
    
    // Run benchmarks in sequence to avoid interference
    const clickResult = await benchmarkClick();
    console.log(`  Click element: ${clickResult.actualMs.toFixed(1)}ms (${clickResult.passed ? 'PASS' : 'FAIL'})`);
    allResults.push(clickResult);
    
    const typeResult = await benchmarkTyping();
    console.log(`  Type 50 chars: ${typeResult.actualMs.toFixed(1)}ms (${typeResult.passed ? 'PASS' : 'FAIL'})`);
    allResults.push(typeResult);
    
    const screenshotResult = await benchmarkScreenshot();
    console.log(`  Screenshot: ${screenshotResult.actualMs.toFixed(1)}ms (${screenshotResult.passed ? 'PASS' : 'FAIL'})`);
    allResults.push(screenshotResult);
    
    const snapshotResult = await benchmarkSnapshot();
    console.log(`  Snapshot: ${snapshotResult.actualMs.toFixed(1)}ms (${snapshotResult.passed ? 'PASS' : 'FAIL'})`);
    allResults.push(snapshotResult);
    
    if (iterations > 1) {
      console.log('');
    }
  }
  
  const totalDuration = Date.now() - suiteStartTime;
  const overallPassed = allResults.every(r => r.passed);
  const cacheStats = getPerformanceStats();
  
  // Calculate averages for multiple iterations
  const averageResults: BenchmarkResult[] = [];
  const operations = Object.keys(PERFORMANCE_TARGETS) as Array<keyof typeof PERFORMANCE_TARGETS>;
  
  for (const operation of operations) {
    const operationResults = allResults.filter(r => r.operation === operation);
    const avgActualMs = operationResults.reduce((sum, r) => sum + r.actualMs, 0) / operationResults.length;
    const allPassed = operationResults.every(r => r.passed);
    const allSucceeded = operationResults.every(r => r.success);
    
    averageResults.push({
      operation,
      targetMs: PERFORMANCE_TARGETS[operation],
      actualMs: avgActualMs,
      success: allSucceeded,
      passed: allPassed,
      metadata: {
        iterations: operationResults.length,
        min: Math.min(...operationResults.map(r => r.actualMs)),
        max: Math.max(...operationResults.map(r => r.actualMs)),
        stdDev: Math.sqrt(
          operationResults.reduce((sum, r) => sum + Math.pow(r.actualMs - avgActualMs, 2), 0) / operationResults.length
        )
      }
    });
  }
  
  return {
    name: suiteName,
    results: iterations > 1 ? averageResults : allResults,
    overallPassed,
    totalDuration,
    cacheStats
  };
}

/**
 * Show comprehensive performance statistics
 */
function showPerformanceStats(): void {
  const stats = getPerformanceStats();
  const memoryStats = memoryMonitor.getStats();
  const recommendations = getPerformanceRecommendations();
  
  console.log('\n=== Performance Statistics ===');
  
  console.log('\nCache Status:');
  console.log(`  Script Cache: ${stats.cacheStats.scriptCache.size}/${stats.cacheStats.scriptCache.maxSize} entries`);
  console.log(`  Coords Cache: ${stats.cacheStats.coordsCache.size}/${stats.cacheStats.coordsCache.maxSize} entries`);
  console.log(`  WebP Cache: ${stats.cacheStats.webpCache.size}/${stats.cacheStats.webpCache.maxSize} entries`);
  
  console.log('\nConnection Pool:');
  console.log(`  Active Connections: ${stats.connectionPool.activeConnections}/${stats.connectionPool.maxConnections}`);
  
  console.log('\nMemory Usage:');
  console.log(`  RSS: ${stats.memory.rss}MB`);
  console.log(`  Heap Used: ${stats.memory.heapUsed}MB`);
  console.log(`  Heap Total: ${stats.memory.heapTotal}MB`);
  console.log(`  External: ${stats.memory.external}MB`);
  console.log(`  Array Buffers: ${stats.memory.arrayBuffers}MB`);
  
  console.log('\nMemory Monitor:');
  console.log(`  Status: ${memoryStats.isActive ? 'Active' : 'Inactive'}`);
  console.log(`  Snapshots: ${memoryStats.snapshotCount}`);
  if (memoryStats.currentMemory) {
    const snapshot = memoryStats.currentMemory;
    console.log(`  Last Check: ${new Date(snapshot.timestamp).toLocaleTimeString()}`);
  }
  
  console.log('\nRecommendations:');
  recommendations.forEach(rec => console.log(`  - ${rec}`));
}

/**
 * Create benchmark command
 */
export function createBenchmarkCommand(): Command {
  const cmd = new Command('benchmark')
    .alias('bench')
    .description('Run performance benchmarks to validate optimization targets');
  
  cmd
    .command('run')
    .description('Run complete performance benchmark suite')
    .option('-i, --iterations <number>', 'Number of iterations to run', '1')
    .option('--json', 'Output results as JSON')
    .action(async (options) => {
      try {
        const iterations = parseInt(options.iterations);
        if (isNaN(iterations) || iterations < 1) {
          console.error('Error: iterations must be a positive number');
          process.exit(1);
        }
        
        const suite = await runBenchmarkSuite(iterations);
        
        if (options.json) {
          console.log(JSON.stringify(formatJSONResult(suite), null, 2));
        } else {
          console.log(`\n${suite.name} Results:`);
          console.log(`Overall: ${suite.overallPassed ? 'PASSED' : 'FAILED'}`);
          console.log(`Total Duration: ${suite.totalDuration}ms`);
          
          console.log('\nDetailed Results:');
          suite.results.forEach(result => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`  ${result.operation}: ${result.actualMs.toFixed(1)}ms / ${result.targetMs}ms ${status}`);
            
            if (result.metadata && Object.keys(result.metadata).length > 0) {
              Object.entries(result.metadata).forEach(([key, value]) => {
                if (key !== 'error') {
                  console.log(`    ${key}: ${JSON.stringify(value)}`);
                }
              });
            }
          });
          
          showPerformanceStats();
        }
        
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify(formatJSONResult(null, String(error), ERROR_CODES.UNKNOWN_ERROR), null, 2));
        } else {
          console.error(`Benchmark failed: ${error}`);
        }
        process.exit(1);
      }
    });
  
  cmd
    .command('stats')
    .description('Show current performance statistics')
    .option('--json', 'Output as JSON')
    .action((options) => {
      if (options.json) {
        console.log(JSON.stringify(formatJSONResult(getPerformanceStats()), null, 2));
      } else {
        showPerformanceStats();
      }
    });
  
  cmd
    .command('clear-cache')
    .description('Clear all performance caches')
    .action(() => {
      clearPerformanceCaches();
      console.log('Performance caches cleared');
    });

  cmd
    .command('memory')
    .description('Memory monitoring and analysis commands')
    .option('--start', 'Start memory monitoring')
    .option('--stop', 'Stop memory monitoring')
    .option('--status', 'Show memory monitoring status')
    .option('--history', 'Show memory usage history')
    .option('--cleanup', 'Execute memory cleanup')
    .option('--json', 'Output as JSON')
    .action((options) => {
      try {
        if (options.start) {
          if (!memoryMonitor.getStats().isActive) {
            initializeMemoryMonitoring();
            console.log('Memory monitoring started');
          } else {
            console.log('Memory monitoring is already active');
          }
        } else if (options.stop) {
          memoryMonitor.stop();
          console.log('Memory monitoring stopped');
        } else if (options.cleanup) {
          const initialMemory = memoryMonitor.getCurrentSnapshot();
          memoryMonitor.executeCleanup();
          
          setTimeout(() => {
            const finalMemory = memoryMonitor.getCurrentSnapshot();
            if (initialMemory && finalMemory) {
              const heapSaved = initialMemory.heapUsed - finalMemory.heapUsed;
              const rssSaved = initialMemory.rss - finalMemory.rss;
              console.log(`Memory cleanup completed:`);
              console.log(`  Heap memory saved: ${heapSaved.toFixed(1)}MB`);
              console.log(`  RSS memory saved: ${rssSaved.toFixed(1)}MB`);
            }
          }, 1000);
        } else if (options.history) {
          const snapshots = memoryMonitor.getAllSnapshots();
          
          if (options.json) {
            console.log(JSON.stringify({ snapshots }, null, 2));
          } else {
            console.log('\nMemory Usage History:');
            console.log('Time                 RSS(MB)  Heap(MB)  External(MB)');
            console.log('---------------------------------------------------');
            
            snapshots.slice(-10).forEach(snapshot => { // Show last 10 snapshots
              const time = new Date(snapshot.timestamp).toLocaleTimeString();
              console.log(`${time.padEnd(20)} ${snapshot.rss.toString().padStart(7)} ${snapshot.heapUsed.toString().padStart(9)} ${snapshot.external.toString().padStart(12)}`);
            });
            
            // Show potential leaks
            const leakDetection = memoryMonitor.detectPotentialLeaks();
            if (leakDetection?.potentialLeak) {
              console.log(`\n⚠️  Potential memory leak detected (${leakDetection.growthRate.toFixed(2)}MB/min growth)`);
              leakDetection.suggestions.forEach(suggestion => {
                console.log(`   - ${suggestion}`);
              });
            }
          }
        } else {
          // Default: show status
          const stats = memoryMonitor.getStats();
          
          if (options.json) {
            console.log(JSON.stringify(stats, null, 2));
          } else {
            console.log('\nMemory Monitor Status:');
            console.log(`  Active: ${stats.isActive}`);
            console.log(`  Snapshots: ${stats.snapshotCount}`);
            console.log(`  Interval: ${stats.config.interval}ms`);
            console.log(`  Growth Threshold: ${stats.config.growthThreshold}MB/min`);
            console.log(`  RSS Limit: ${stats.config.rssLimit}MB`);
            console.log(`  Heap Limit: ${stats.config.heapLimit}MB`);
            
            if (stats.currentMemory) {
              const current = stats.currentMemory;
              console.log('\nCurrent Memory Usage:');
              console.log(`  RSS: ${current.rss}MB`);
              console.log(`  Heap Used: ${current.heapUsed}MB`);
              console.log(`  Heap Total: ${current.heapTotal}MB`);
              console.log(`  External: ${current.external}MB`);
              console.log(`  Array Buffers: ${current.arrayBuffers}MB`);
              console.log(`  Last Updated: ${new Date(current.timestamp).toLocaleString()}`);
            }
          }
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ error: String(error) }, null, 2));
        } else {
          console.error(`Memory command failed: ${error}`);
        }
        process.exit(1);
      }
    });

  cmd
    .command('batch-test')
    .description('Test batch operation performance')
    .option('-c, --count <number>', 'Number of operations to batch', '10')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const count = parseInt(options.count);
        if (isNaN(count) || count < 1) {
          console.error('Error: count must be a positive number');
          process.exit(1);
        }

        console.log(`\nTesting batch operations with ${count} operations...`);
        
        // Create test operations (simple DOM queries)
        const operations = Array.from({ length: count }, (_, i) => 
          () => new Promise<string>(resolve => 
            setTimeout(() => resolve(`operation-${i}-result`), Math.random() * 100)
          )
        );

        // Test sequential execution
        const sequentialStart = performance.now();
        const sequentialResults = [];
        for (const op of operations) {
          sequentialResults.push(await op());
        }
        const sequentialTime = performance.now() - sequentialStart;

        // Test batch execution  
        const batchStart = performance.now();
        await executeBatchOperations(operations, {
          batchSize: 5,
          concurrency: 3,
          preserveOrder: true
        });
        const batchTime = performance.now() - batchStart;

        const speedup = (sequentialTime / batchTime).toFixed(2);
        
        if (options.json) {
          console.log(JSON.stringify({
            operationCount: count,
            sequentialTime: sequentialTime.toFixed(1),
            batchTime: batchTime.toFixed(1),
            speedup: parseFloat(speedup),
            memoryUsage: memoryMonitor.getCurrentSnapshot()
          }, null, 2));
        } else {
          console.log('\nBatch Operation Performance Test Results:');
          console.log(`  Operations: ${count}`);
          console.log(`  Sequential Time: ${sequentialTime.toFixed(1)}ms`);
          console.log(`  Batch Time: ${batchTime.toFixed(1)}ms`);
          console.log(`  Speedup: ${speedup}x`);
          
          const currentMemory = memoryMonitor.getCurrentSnapshot();
          if (currentMemory) {
            console.log(`  Memory Usage: ${currentMemory.heapUsed}MB heap, ${currentMemory.rss}MB RSS`);
          }
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ error: String(error) }, null, 2));
        } else {
          console.error(`Batch test failed: ${error}`);
        }
        process.exit(1);
      }
    });
  
  return cmd;
}