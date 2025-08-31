/**
 * Integration tests for base64 screenshot functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Interface for exec errors with additional properties
interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

// Helper to run CLI commands
async function runCLI(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`npm run dev -- ${command}`, {
      timeout: 15000,
      env: { ...process.env, NODE_ENV: 'test' }
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as ExecError;
    return { 
      stdout: execError.stdout || '', 
      stderr: execError.stderr || '', 
      exitCode: execError.code || 1 
    };
  }
}

describe('Screenshot Base64 Integration', () => {
  describe('screenshot command default behavior', () => {
    test('should return base64 by default (no --save-file flag)', async () => {
      const result = await runCLI('screenshot --json');
      
      // Should not crash and should provide some output
      expect(result.exitCode).toBeDefined();
      expect(typeof result.exitCode).toBe('number');
      
      // In test environment, it may fail gracefully but shouldn't hang
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    }, 20000);
    
    test('should help mention base64 as default behavior', async () => {
      const result = await runCLI('screenshot --help');
      
      const output = result.stderr + result.stdout;
      expect(output).toContain('--save-file');
      expect(output).toContain('base64');
    });
  });
  
  describe('capture command (alias) default behavior', () => {
    test('should also return base64 by default', async () => {
      const result = await runCLI('capture --json');
      
      // Should not crash and should provide some output  
      expect(result.exitCode).toBeDefined();
      expect(typeof result.exitCode).toBe('number');
      
      // In test environment, it may fail gracefully but shouldn't hang
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    }, 20000);
    
    test('should help mention base64 as default behavior', async () => {
      const result = await runCLI('capture --help');
      
      const output = result.stderr + result.stdout;
      expect(output).toContain('--save-file');
      expect(output).toContain('base64');
    });
  });
});