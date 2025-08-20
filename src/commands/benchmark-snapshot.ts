/**
 * @fileoverview CLI command for running snapshot performance benchmarks
 * 
 * This command provides tools to validate the O(n) complexity improvements
 * in the DOM traversal algorithms and ensure performance targets are met.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { Command } from 'commander';
import { 
  runBenchmarkSuite, 
  runSnapshotBenchmark, 
  analyzeBenchmarkResults,
  exportBenchmarkResults,
  type BenchmarkResult
} from '../performance/SnapshotBenchmark.js';

/**
 * Options for the benchmark command
 */
interface BenchmarkOptions {
  /** Run full benchmark suite */
  suite?: boolean;
  /** Number of DOM nodes for single test */
  nodes?: number;
  /** Operation type to benchmark */
  operation?: 'outline' | 'dom-lite';
  /** Only capture visible elements */
  visibleOnly?: boolean;
  /** Maximum depth for DOM-lite mode */
  maxDepth?: number;
  /** Export results to file */
  export?: string;
  /** Output format */
  format?: 'json' | 'table';
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Formats benchmark results for display
 */
function formatBenchmarkResults(results: BenchmarkResult[], options: BenchmarkOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(results, null, 2);
  }
  
  // Table format
  let output = '\n📊 Snapshot Performance Benchmark Results\n';
  output += '=' .repeat(60) + '\n\n';
  
  // Summary table
  const passedCount = results.filter(r => r.passedTargets).length;
  const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / results.length;
  const avgTimePerNode = results.reduce((sum, r) => sum + r.timePerNodeUs, 0) / results.length;
  
  output += `📈 Summary:\n`;
  output += `   Tests Run: ${results.length}\n`;
  output += `   Passed: ${passedCount}/${results.length} (${(passedCount/results.length*100).toFixed(1)}%)\n`;
  output += `   Avg Duration: ${avgDuration.toFixed(2)}ms\n`;
  output += `   Avg Time/Node: ${avgTimePerNode.toFixed(2)}μs\n\n`;
  
  // Detailed results table
  output += '| Test Name'.padEnd(25) + '| Nodes'.padEnd(8) + '| Duration'.padEnd(12) + '| Memory'.padEnd(10) + '| Complexity'.padEnd(12) + '| Status |\n';
  output += '|' + '-'.repeat(24) + '|' + '-'.repeat(7) + '|' + '-'.repeat(11) + '|' + '-'.repeat(9) + '|' + '-'.repeat(11) + '|' + '-'.repeat(8) + '|\n';
  
  for (const result of results) {
    const name = result.testName.length > 23 ? result.testName.substring(0, 20) + '...' : result.testName;
    const nodes = result.nodeCount.toString();
    const duration = `${result.durationMs.toFixed(1)}ms`;
    const memory = `${result.memoryPeakMB.toFixed(1)}MB`;
    const complexity = result.complexityIndicator;
    const status = result.passedTargets ? '✅ PASS' : '❌ FAIL';
    
    output += `| ${name.padEnd(23)} | ${nodes.padEnd(6)} | ${duration.padEnd(10)} | ${memory.padEnd(8)} | ${complexity.padEnd(10)} | ${status} |\n`;
  }
  
  output += '\n';
  
  // Performance analysis
  const analysis = analyzeBenchmarkResults(results);
  
  output += '🔍 Performance Analysis:\n';
  output += `   Overall Complexity: ${analysis.overallComplexity}\n`;
  output += `   Linearity Score: ${analysis.detailedAnalysis.linearityScore.toFixed(1)}/100\n`;
  output += `   Scaling Factor: ${analysis.detailedAnalysis.scalingFactor.toFixed(2)}x\n`;
  output += `   Memory Efficiency: ${analysis.detailedAnalysis.memoryEfficiency.toFixed(2)}KB/node\n\n`;
  
  // Recommendations
  output += '💡 Recommendations:\n';
  for (const recommendation of analysis.recommendations) {
    output += `   ${recommendation}\n`;
  }
  
  if (options.verbose) {
    output += '\n🔬 Verbose Details:\n';
    for (const result of results) {
      output += `\n   ${result.testName}:\n`;
      output += `     Time per node: ${result.timePerNodeUs.toFixed(2)}μs\n`;
      output += `     Memory per node: ${result.memoryPerNodeKB.toFixed(2)}KB\n`;
      
      if (result.metadata?.snapshotMetadata?.performance) {
        const perf = result.metadata.snapshotMetadata.performance;
        output += `     Algorithm: ${perf.algorithm}\n`;
        output += `     Processing time: ${perf.processingMs}ms\n`;
        if (perf.traversalMs) {
          output += `     Traversal time: ${perf.traversalMs}ms\n`;
        }
        if (perf.algorithmsUsed) {
          output += `     Optimizations: ${perf.algorithmsUsed.join(', ')}\n`;
        }
      }
    }
  }
  
  return output;
}

/**
 * Runs a single benchmark test
 */
async function runSingleBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult> {
  const nodeCount = options.nodes || 1000;
  const operation = options.operation || 'outline';
  const testName = `Custom ${operation} test`;
  
  const benchmarkOptions: { visibleOnly?: boolean; maxDepth?: number } = {};
  if (options.visibleOnly) benchmarkOptions.visibleOnly = true;
  if (options.maxDepth) benchmarkOptions.maxDepth = options.maxDepth;
  
  console.log(`Running single benchmark: ${operation} with ${nodeCount} nodes...`);
  
  return runSnapshotBenchmark(testName, nodeCount, operation, benchmarkOptions);
}

/**
 * Main benchmark command implementation
 */
export async function runBenchmarkCommand(options: BenchmarkOptions): Promise<void> {
  try {
    let results: BenchmarkResult[];
    
    if (options.suite) {
      console.log('Running comprehensive benchmark suite...');
      results = await runBenchmarkSuite();
    } else {
      const singleResult = await runSingleBenchmark(options);
      results = [singleResult];
    }
    
    // Format and display results
    const formattedOutput = formatBenchmarkResults(results, options);
    console.log(formattedOutput);
    
    // Export results if requested
    if (options.export) {
      const analysis = analyzeBenchmarkResults(results);
      const exportData = exportBenchmarkResults(results, analysis);
      
      const fs = await import('fs/promises');
      await fs.writeFile(options.export, exportData, 'utf8');
      console.log(`\n📁 Results exported to: ${options.export}`);
    }
    
    // Exit with appropriate code
    const allPassed = results.every(r => r.passedTargets);
    if (!allPassed) {
      console.log('\n⚠️  Some performance targets were not met.');
      process.exit(1);
    } else {
      console.log('\n✅ All performance targets met!');
    }
  } catch (error) {
    console.error('❌ Benchmark failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Creates the CLI command for snapshot benchmarking
 */
export function createBenchmarkCommand(): Command {
  const command = new Command('benchmark-snapshot')
    .description('Run performance benchmarks for snapshot operations')
    .option('-s, --suite', 'Run full benchmark suite across different DOM sizes')
    .option('-n, --nodes <number>', 'Number of DOM nodes for single test', parseInt)
    .option('-o, --operation <type>', 'Operation type to benchmark', 'outline')
    .option('--visible-only', 'Only capture visible elements')
    .option('--max-depth <number>', 'Maximum depth for DOM-lite mode', parseInt)
    .option('-e, --export <file>', 'Export results to JSON file')
    .option('-f, --format <type>', 'Output format (json|table)', 'table')
    .option('-v, --verbose', 'Verbose output with detailed metrics')
    .action(async (options: BenchmarkOptions) => {
      await runBenchmarkCommand(options);
    });
  
  // Add examples to help
  command.addHelpText('after', `
Examples:
  # Run full benchmark suite
  mac-chrome-cli benchmark-snapshot --suite
  
  # Test specific configuration
  mac-chrome-cli benchmark-snapshot --nodes 2000 --operation dom-lite --max-depth 8
  
  # Export results for analysis
  mac-chrome-cli benchmark-snapshot --suite --export benchmark-results.json
  
  # Verbose output with optimization details
  mac-chrome-cli benchmark-snapshot --suite --verbose
`);
  
  return command;
}

// Export for use in main CLI
export default createBenchmarkCommand;