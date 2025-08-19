/**
 * @fileoverview Performance benchmarking utilities for snapshot optimization validation
 * 
 * This module provides tools to measure and validate the O(n) complexity improvements
 * in the DOM traversal algorithms. It includes both synthetic and real-world benchmarks.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { execChromeJS, type JavaScriptResult } from '../lib/apple.js';
import { captureOutline, captureDomLite, type SnapshotResult } from '../commands/snapshot.js';

/**
 * Results from a performance benchmark run
 */
export interface BenchmarkResult {
  /** Test name identifier */
  testName: string;
  /** Number of DOM nodes in the test */
  nodeCount: number;
  /** Total execution time in milliseconds */
  durationMs: number;
  /** Peak memory usage in MB */
  memoryPeakMB: number;
  /** Time per node in microseconds */
  timePerNodeUs: number;
  /** Memory per node in KB */
  memoryPerNodeKB: number;
  /** Algorithm complexity indicator */
  complexityIndicator: 'linear' | 'quadratic' | 'unknown';
  /** Whether the benchmark passed performance targets */
  passedTargets: boolean;
  /** Additional performance metadata */
  metadata?: Record<string, any>;
}

/**
 * Performance targets for different DOM sizes
 */
export const PERFORMANCE_TARGETS = {
  /** Small DOM (100-500 nodes) should complete in under 100ms */
  small: { maxDurationMs: 100, maxMemoryMB: 5 },
  /** Medium DOM (500-2000 nodes) should complete in under 250ms */
  medium: { maxDurationMs: 250, maxMemoryMB: 15 },
  /** Large DOM (2000+ nodes) should complete in under 500ms */
  large: { maxDurationMs: 500, maxMemoryMB: 30 }
} as const;

/**
 * Generates a synthetic HTML page with the specified number of interactive elements
 * for benchmarking purposes
 */
function generateSyntheticPage(nodeCount: number): string {
  const elements = [];
  
  // Create a balanced tree structure
  const depth = Math.ceil(Math.log2(nodeCount / 10));
  let elementId = 0;
  
  function generateLevel(level: number, parent: string, remaining: number): string {
    if (level >= depth || remaining <= 0) return '';
    
    const elementsAtLevel = Math.min(10, remaining);
    let levelHtml = '';
    
    for (let i = 0; i < elementsAtLevel; i++) {
      const id = `elem-${elementId++}`;
      const className = `level-${level} item-${i}`;
      
      levelHtml += `
        <div id=\"${id}\" class=\"${className}\" data-testid=\"test-${id}\">
          <button onclick=\"test()\" aria-label=\"Button ${id}\">Button ${id}</button>
          <input type=\"text\" placeholder=\"Input ${id}\" />
          <a href=\"#${id}\" role=\"link\">Link ${id}</a>
          ${generateLevel(level + 1, id, Math.floor(remaining / elementsAtLevel))}
        </div>
      `;
    }
    
    return levelHtml;
  }
  
  const bodyContent = generateLevel(0, 'root', Math.floor(nodeCount / 3));
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Synthetic Benchmark Page - ${nodeCount} nodes</title>
      <style>
        .level-0 { padding: 10px; border: 1px solid #ccc; margin: 5px; }
        .level-1 { padding: 8px; border: 1px solid #ddd; margin: 3px; }
        .level-2 { padding: 5px; border: 1px solid #eee; margin: 2px; }
        button { margin: 2px; padding: 5px 10px; }
        input { margin: 2px; padding: 5px; }
        a { margin: 2px; padding: 5px; display: inline-block; }
      </style>
    </head>
    <body>
      <h1>Synthetic Benchmark Page</h1>
      <p>This page contains approximately ${nodeCount} DOM nodes for performance testing.</p>
      <div id="content">
        ${bodyContent}
      </div>
      <script>
        function test() { console.log('Test interaction'); }
        window.benchmarkNodeCount = document.querySelectorAll('*').length;
      </script>
    </body>
    </html>
  `;
}

/**
 * Loads a synthetic page into Chrome for benchmarking
 */
export async function loadSyntheticPage(nodeCount: number): Promise<JavaScriptResult<{ actualNodeCount: number }>> {
  const htmlContent = generateSyntheticPage(nodeCount);
  
  // Create data URL to load the synthetic page
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  
  // Navigate to the synthetic page
  const navScript = `
    window.location.href = "${dataUrl}";
    
    // Wait for page to load and return actual node count
    new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve({ actualNodeCount: document.querySelectorAll('*').length });
      } else {
        window.addEventListener('load', () => {
          resolve({ actualNodeCount: document.querySelectorAll('*').length });
        });
      }
    });
  `;
  
  return execChromeJS<{ actualNodeCount: number }>(navScript, 1, 1, 10000);
}

/**
 * Runs a performance benchmark for the specified snapshot operation
 */
export async function runSnapshotBenchmark(
  testName: string,
  nodeCount: number,
  operation: 'outline' | 'dom-lite',
  options: { visibleOnly?: boolean; maxDepth?: number } = {}
): Promise<BenchmarkResult> {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  try {
    // Load synthetic page
    const pageResult = await loadSyntheticPage(nodeCount);
    if (!pageResult.success) {
      throw new Error(`Failed to load synthetic page: ${pageResult.error}`);
    }
    
    const actualNodeCount = pageResult.data?.actualNodeCount || nodeCount;
    
    // Run the snapshot operation
    let snapshotResult: JavaScriptResult<SnapshotResult>;
    if (operation === 'outline') {
      snapshotResult = await captureOutline(options);
    } else {
      snapshotResult = await captureDomLite(options);
    }
    
    if (!snapshotResult.success) {
      throw new Error(`Snapshot operation failed: ${snapshotResult.error}`);
    }
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    // Calculate performance metrics
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const memoryDeltaMB = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
    const timePerNodeUs = (durationMs * 1000) / actualNodeCount;
    const memoryPerNodeKB = (memoryDeltaMB * 1024) / actualNodeCount;
    
    // Determine complexity indicator based on time per node
    let complexityIndicator: 'linear' | 'quadratic' | 'unknown' = 'unknown';
    if (timePerNodeUs < 50) {
      complexityIndicator = 'linear';
    } else if (timePerNodeUs > 200) {
      complexityIndicator = 'quadratic';
    }
    
    // Check if targets are met
    const target = actualNodeCount < 500 ? PERFORMANCE_TARGETS.small :
                   actualNodeCount < 2000 ? PERFORMANCE_TARGETS.medium :
                   PERFORMANCE_TARGETS.large;
    
    const passedTargets = durationMs <= target.maxDurationMs && 
                         Math.abs(memoryDeltaMB) <= target.maxMemoryMB;
    
    return {
      testName,
      nodeCount: actualNodeCount,
      durationMs,
      memoryPeakMB: Math.max(0, memoryDeltaMB),
      timePerNodeUs,
      memoryPerNodeKB,
      complexityIndicator,
      passedTargets,
      metadata: {
        operation,
        options,
        snapshotMetadata: snapshotResult.data?.meta,
        processMemory: {
          before: startMemory,
          after: endMemory
        }
      }
    };
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    
    return {
      testName: `${testName} (FAILED)`,
      nodeCount,
      durationMs,
      memoryPeakMB: 0,
      timePerNodeUs: 0,
      memoryPerNodeKB: 0,
      complexityIndicator: 'unknown',
      passedTargets: false,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
        options
      }
    };
  }
}

/**
 * Runs a comprehensive benchmark suite across different DOM sizes
 */
export async function runBenchmarkSuite(): Promise<BenchmarkResult[]> {
  const testCases = [
    { name: 'Small DOM - Outline', nodeCount: 200, operation: 'outline' as const },
    { name: 'Small DOM - DOM-lite', nodeCount: 200, operation: 'dom-lite' as const },
    { name: 'Medium DOM - Outline', nodeCount: 1000, operation: 'outline' as const },
    { name: 'Medium DOM - DOM-lite', nodeCount: 1000, operation: 'dom-lite' as const },
    { name: 'Large DOM - Outline', nodeCount: 3000, operation: 'outline' as const },
    { name: 'Large DOM - DOM-lite', nodeCount: 3000, operation: 'dom-lite' as const },
    { name: 'Very Large DOM - Outline', nodeCount: 5000, operation: 'outline' as const },
    { name: 'Deep DOM - DOM-lite', nodeCount: 1000, operation: 'dom-lite' as const, options: { maxDepth: 15 } },
    { name: 'Visible Only - Outline', nodeCount: 2000, operation: 'outline' as const, options: { visibleOnly: true } }
  ];
  
  const results: BenchmarkResult[] = [];
  
  console.log('Running snapshot performance benchmark suite...');
  
  for (const testCase of testCases) {
    console.log(`\nRunning: ${testCase.name} (${testCase.nodeCount} nodes)`);
    
    const result = await runSnapshotBenchmark(
      testCase.name,
      testCase.nodeCount,
      testCase.operation,
      testCase.options || {}
    );
    
    results.push(result);
    
    // Log immediate results
    console.log(`  Duration: ${result.durationMs.toFixed(2)}ms`);
    console.log(`  Memory: ${result.memoryPeakMB.toFixed(2)}MB`);
    console.log(`  Complexity: ${result.complexityIndicator}`);
    console.log(`  Targets: ${result.passedTargets ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
  return results;
}

/**
 * Analyzes benchmark results to validate O(n) complexity
 */
export function analyzeBenchmarkResults(results: BenchmarkResult[]): {
  overallComplexity: 'linear' | 'quadratic' | 'mixed';
  passRate: number;
  recommendations: string[];
  detailedAnalysis: {
    linearityScore: number;
    averageTimePerNode: number;
    memoryEfficiency: number;
    scalingFactor: number;
  };
} {
  const passedResults = results.filter(r => r.passedTargets);
  const passRate = passedResults.length / results.length;
  
  // Analyze complexity by comparing time per node across different sizes
  const outlineResults = results.filter(r => r.metadata?.operation === 'outline');
  const timePerNodeVariance = calculateVariance(outlineResults.map(r => r.timePerNodeUs));
  
  // Calculate linearity score (lower variance = more linear)
  const linearityScore = Math.max(0, 100 - (timePerNodeVariance / 10));
  
  // Determine overall complexity
  const linearCount = results.filter(r => r.complexityIndicator === 'linear').length;
  const quadraticCount = results.filter(r => r.complexityIndicator === 'quadratic').length;
  
  let overallComplexity: 'linear' | 'quadratic' | 'mixed';
  if (linearCount > quadraticCount * 2) {
    overallComplexity = 'linear';
  } else if (quadraticCount > linearCount) {
    overallComplexity = 'quadratic';
  } else {
    overallComplexity = 'mixed';
  }
  
  // Calculate additional metrics
  const averageTimePerNode = results.reduce((sum, r) => sum + r.timePerNodeUs, 0) / results.length;
  const memoryEfficiency = results.reduce((sum, r) => sum + r.memoryPerNodeKB, 0) / results.length;
  
  // Calculate scaling factor by comparing largest to smallest test
  const sortedBySize = results.sort((a, b) => a.nodeCount - b.nodeCount);
  const smallest = sortedBySize[0];
  const largest = sortedBySize[sortedBySize.length - 1];
  const scalingFactor = (largest.durationMs / smallest.durationMs) / (largest.nodeCount / smallest.nodeCount);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (overallComplexity === 'quadratic') {
    recommendations.push('⚠️ Algorithm shows quadratic complexity - review selector generation and DOM queries');
  }
  
  if (passRate < 0.8) {
    recommendations.push('⚠️ Low pass rate - performance targets may need adjustment or further optimization required');
  }
  
  if (averageTimePerNode > 100) {
    recommendations.push('⚠️ High time per node - consider caching optimizations and batch operations');
  }
  
  if (memoryEfficiency > 5) {
    recommendations.push('⚠️ High memory usage per node - review memory management and object creation');
  }
  
  if (scalingFactor > 2) {
    recommendations.push('⚠️ Poor scaling characteristics - algorithm may not be truly O(n)');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All performance metrics look good - optimization successful');
  }
  
  return {
    overallComplexity,
    passRate,
    recommendations,
    detailedAnalysis: {
      linearityScore,
      averageTimePerNode,
      memoryEfficiency,
      scalingFactor
    }
  };
}

/**
 * Calculates the variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDifferences = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDifferences.reduce((sum, sq) => sum + sq, 0) / numbers.length;
}

/**
 * Exports benchmark results to JSON for analysis
 */
export function exportBenchmarkResults(
  results: BenchmarkResult[],
  analysis: ReturnType<typeof analyzeBenchmarkResults>
): string {
  const exportData = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    optimization: 'O(n) DOM traversal',
    summary: {
      totalTests: results.length,
      passedTests: results.filter(r => r.passedTargets).length,
      overallComplexity: analysis.overallComplexity,
      passRate: analysis.passRate,
      linearityScore: analysis.detailedAnalysis.linearityScore
    },
    results,
    analysis,
    performanceTargets: PERFORMANCE_TARGETS
  };
  
  return JSON.stringify(exportData, null, 2);
}