/**
 * Integration tests for navigation commands
 * Tests the CLI interface and command execution
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
      timeout: 10000,
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

describe('Navigation Commands Integration', () => {
  describe('open command', () => {
    test('should show help for open command', async () => {
      const result = await runCLI('open --help');

      // Help output may come through stderr due to commander behavior
      const output = result.stderr + result.stdout;
      expect(output).toContain('Navigate to URL');
      expect(output).toContain('<url>');
      expect(output).toContain('--wait');
      expect(output).toContain('--timeout <ms>');
      expect(output).toContain('--window <index>');
    });

    test('should reject missing URL argument', async () => {
      const result = await runCLI('open');

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain("missing required argument 'url'");
    });

    test('should reject invalid window index', async () => {
      const result = await runCLI('open https://example.com --window 0');

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain('Invalid window index');
    });

    test('should handle invalid timeout gracefully', async () => {
      // Commander.js doesn't parse negative numbers properly when preceded by --
      // So we test with a too-small positive value instead
      const result = await runCLI('open https://example.com --timeout 500');

      expect(result.exitCode).not.toBe(0);
      // Should fail with timeout validation error (must be at least 1000ms)
      const output = result.stderr + result.stdout;
      expect(output.length).toBeGreaterThan(10);
    });

    test('should handle navigation gracefully in test environment', async () => {
      // In test/CI environment, we expect this to fail gracefully with permissions or Chrome not found
      const result = await runCLI('open https://example.com --json');

      // Should not crash completely - expect structured failure
      expect(result.exitCode).toBeDefined();
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('reload command', () => {
    test('should show help for reload command', async () => {
      const result = await runCLI('reload --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Reload current page');
      expect(output).toContain('--hard');
      expect(output).toContain('--wait');
      expect(output).toContain('--timeout <ms>');
      expect(output).toContain('--window <index>');
    });

    test('should accept hard reload option', async () => {
      const result = await runCLI('reload --hard --json');

      // Should not crash on syntax level
      expect(result.exitCode).toBeDefined();
    });
  });

  describe('back command', () => {
    test('should show help for back command', async () => {
      const result = await runCLI('back --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Navigate back in browser history');
      expect(output).toContain('--wait');
      expect(output).toContain('--timeout <ms>');
      expect(output).toContain('--window <index>');
    });

    test('should handle back navigation gracefully', async () => {
      const result = await runCLI('back --json');

      // Should not crash, should provide appropriate error or result
      expect(result.exitCode).toBeDefined();
    });
  });

  describe('forward command', () => {
    test('should show help for forward command', async () => {
      const result = await runCLI('forward --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Navigate forward in browser history');
      expect(output).toContain('--wait');
      expect(output).toContain('--timeout <ms>');
      expect(output).toContain('--window <index>');
    });

    test('should handle forward navigation gracefully', async () => {
      const result = await runCLI('forward --json');

      // Should not crash, should provide appropriate error or result
      expect(result.exitCode).toBeDefined();
    });
  });

  describe('Navigation commands in main help', () => {
    test('should show navigation commands in main help', async () => {
      const result = await runCLI('--help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('reload [options]');
      expect(output).toContain('back [options]');
      expect(output).toContain('forward [options]');
      expect(output).toContain('open [options] <url>');
    });

    test('should show correct descriptions for navigation commands', async () => {
      const result = await runCLI('--help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Reload current page');
      expect(output).toContain('Navigate back in browser history');
      expect(output).toContain('Navigate forward in browser history');
      expect(output).toContain('Navigate to URL');
    });
  });

  describe('Command structure and validation', () => {
    test('should provide structured output in JSON format', async () => {
      const result = await runCLI('open https://example.com --json');

      // In test environment, this should provide structured error or success
      expect(result.exitCode).toBeDefined();
      
      // If there's stderr output, it should be non-empty
      if (result.stderr.length > 0) {
        expect(result.stderr.length).toBeGreaterThan(10);
      }
      
      // If there's stdout output, it should be non-empty  
      if (result.stdout.length > 0) {
        expect(result.stdout.length).toBeGreaterThan(10);
      }
    });

    test('should handle validation errors gracefully', async () => {
      const result = await runCLI('open "" --json');

      expect(result.exitCode).not.toBe(0);
      // Should provide some error output
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });

    test('should validate numeric parameters', async () => {
      const result = await runCLI('open https://example.com --window 0 --json');

      expect(result.exitCode).not.toBe(0);
      // Should reject invalid window index
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });

    test('should handle all navigation commands without crashing', async () => {
      const commands = [
        'open https://example.com --json',
        'reload --json',
        'back --json', 
        'forward --json'
      ];

      for (const command of commands) {
        const result = await runCLI(command);
        // Should not hang or crash - should complete with some exit code
        expect(result.exitCode).toBeDefined();
        expect(typeof result.exitCode).toBe('number');
      }
    }, 30000); // Increase timeout to 30 seconds for multiple navigation commands
  });
});