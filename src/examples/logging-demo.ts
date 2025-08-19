#!/usr/bin/env ts-node

/**
 * Logging System Demonstration
 * 
 * This file demonstrates the new structured logging system capabilities.
 * Run with: npx ts-node src/examples/logging-demo.ts
 */

import { LoggerService } from '../di/services/LoggerService.js';
import { LogLevel } from '../di/ILoggerService.js';
import { 
  initializeLogger, 
  getLogger, 
  createCommandLogger, 
  logCommandStart, 
  logCommandEnd,
  logSecurityEvent,
  logPerformance 
} from '../lib/logger.js';

async function demonstrateLogging(): Promise<void> {
  console.log('=== Mac Chrome CLI Structured Logging Demo ===\n');
  
  // 1. Initialize a logger with different configurations
  console.log('1. Initializing logger with structured output...');
  const logger = new LoggerService({
    level: LogLevel.DEBUG,
    enableConsole: true,
    enableJson: false, // Set to true to see JSON output
    enableCorrelationIds: true,
    enablePerformanceLogging: true
  });
  
  initializeLogger(logger);
  
  // 2. Basic logging levels
  console.log('\n2. Demonstrating log levels:');
  const mainLogger = getLogger();
  
  mainLogger.debug('This is a debug message', 'demo', { userId: 'demo-user' });
  mainLogger.info('Application started successfully', 'startup', { 
    version: '1.0.0',
    environment: 'development'
  });
  mainLogger.warn('Configuration file not found, using defaults', 'config', {
    configPath: './config.json',
    fallbackUsed: true
  });
  
  // 3. Error logging with stack traces
  console.log('\n3. Error logging with context:');
  try {
    throw new Error('Simulated error for demonstration');
  } catch (error) {
    mainLogger.error(
      'Failed to process request', 
      error instanceof Error ? error : new Error(String(error)),
      'demo',
      { 
        operation: 'simulate-error',
        timestamp: Date.now()
      }
    );
  }
  
  // 4. Child loggers with inherited context
  console.log('\n4. Child loggers with context inheritance:');
  const commandLogger = mainLogger.child('command.screenshot', {
    commandId: 'cmd-001',
    userId: 'user-123'
  });
  
  commandLogger.info('Screenshot command started', undefined, {
    selector: '#main-content',
    format: 'png'
  });
  
  commandLogger.performance('capture-screenshot', 245, undefined, {
    fileSize: '1.2MB',
    resolution: '1920x1080'
  });
  
  // 5. Security event logging
  console.log('\n5. Security event logging:');
  logSecurityEvent('Path traversal attempt blocked', 'security.validation', {
    attemptedPath: '../../../etc/passwd',
    sourceIP: '192.168.1.100',
    blocked: true
  });
  
  // 6. Command execution tracking
  console.log('\n6. Command execution tracking:');
  const correlationId = logCommandStart('mouse.click', {
    selector: '#submit-button',
    coordinates: { x: 100, y: 200 }
  });
  
  // Simulate command execution
  await new Promise(resolve => setTimeout(resolve, 150));
  
  logCommandEnd('mouse.click', correlationId, true, 147);
  
  // 7. Performance metrics
  console.log('\n7. Performance logging:');
  logPerformance('dom-traversal', 89, 'snapshot', {
    nodeCount: 1250,
    depth: 8,
    complexity: 'O(n)'
  });
  
  // 8. JSON output demonstration
  console.log('\n8. JSON formatted output (when enabled):');
  const jsonLogger = new LoggerService({
    level: LogLevel.INFO,
    enableConsole: true,
    enableJson: true,
    enableCorrelationIds: true
  });
  
  jsonLogger.info('This message will be in JSON format', 'demo', {
    feature: 'json-logging',
    structured: true,
    parseable: true
  });
  
  // 9. Log entry retrieval
  console.log('\n9. Recent log entries:');
  const recentEntries = mainLogger.getEntries(3);
  console.log(`Retrieved ${recentEntries.length} recent log entries:`);
  recentEntries.forEach((entry, index) => {
    console.log(`  ${index + 1}. [${new Date(entry.timestamp).toISOString()}] ${entry.message}`);
  });
  
  console.log('\n=== Logging Demo Complete ===');
  console.log('\nKey features demonstrated:');
  console.log('• Structured logging with metadata');
  console.log('• Correlation IDs for request tracing');
  console.log('• Child loggers with context inheritance');
  console.log('• Performance metrics logging');
  console.log('• Security event logging');
  console.log('• Command execution tracking');
  console.log('• Both human-readable and JSON output formats');
  console.log('• Error logging with stack traces');
  console.log('• Log level filtering');
  console.log('• Log entry retrieval for debugging');
}

// Run the demonstration
if (require.main === module) {
  demonstrateLogging().catch(console.error);
}

export { demonstrateLogging };