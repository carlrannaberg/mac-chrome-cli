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
  try {
    const cli = new MacChromeCLI();
    await cli.run();
  } catch (error) {
    console.error('Fatal error starting CLI:', error);
    process.exit(1);
  }
}

// Run the CLI application
main();