#!/usr/bin/env node

/**
 * Mac Chrome CLI - Main Entry Point
 * 
 * This is the main entry point for the mac-chrome-cli application.
 * It bootstraps the CLI application using a modular architecture.
 */

import { MacChromeCLI } from './cli/MacChromeCLI.js';

/**
 * Main function to bootstrap and run the CLI application
 */
async function main(): Promise<void> {
  const cli = new MacChromeCLI();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await cli.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cli.shutdown();
    process.exit(0);
  });

  process.on('exit', () => {
    // Synchronous cleanup if needed - dispose is synchronous
    // This is a safety net for any missed cleanup
  });

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await cli.shutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    await cli.shutdown();
    process.exit(1);
  });

  try {
    await cli.run();
  } catch (error) {
    // Fatal startup error - use console.error as logger may not be available
    console.error('Fatal error starting CLI:', error);
    await cli.shutdown();
    process.exit(1);
  }
}

// Run the CLI application
main();