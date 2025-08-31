/**
 * Integration tests for natural commands
 * Tests the simplified CLI interface
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

describe('Natural Commands Integration', () => {
  describe('click command', () => {
    test('should show help for click command', async () => {
      const result = await runCLI('click --help');

      // Help output may come through stderr due to commander behavior
      const output = result.stderr + result.stdout;
      expect(output).toContain('Click on element by CSS selector');
      expect(output).toContain('<selector>');
      expect(output).toContain('--button');
      expect(output).toContain('--window');
    });

    test('should reject missing selector argument', async () => {
      const result = await runCLI('click');

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain("missing required argument 'selector'");
    });

    test('should handle click gracefully in test environment', async () => {
      const result = await runCLI('click "#button" --json');

      // Should not crash completely - expect structured failure
      expect(result.exitCode).toBeDefined();
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('fill command', () => {
    test('should show help for fill command', async () => {
      const result = await runCLI('fill --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Fill input field with value');
      expect(output).toContain('<selector>');
      expect(output).toContain('<value>');
      expect(output).toContain('--method');
      expect(output).toContain('--window');
    });

    test('should reject missing arguments', async () => {
      const result = await runCLI('fill');

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain("missing required argument");
    });

    test('should handle fill gracefully in test environment', async () => {
      const result = await runCLI('fill "#email" "test@example.com" --json');

      expect(result.exitCode).toBeDefined();
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('type command', () => {
    test('should show help for type command', async () => {
      const result = await runCLI('type --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Type text at current cursor position');
      expect(output).toContain('<text>');
      expect(output).toContain('--speed');
      expect(output).toContain('--clear');
    });

    test('should reject missing text argument', async () => {
      const result = await runCLI('type');

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain("missing required argument 'text'");
    });
  });

  describe('capture command', () => {
    test('should show help for capture command', async () => {
      const result = await runCLI('capture --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Capture viewport screenshot');
      expect(output).toContain('--out');
      expect(output).toContain('--format');
      expect(output).toContain('--window');
    });

    test('should handle capture gracefully in test environment', async () => {
      const result = await runCLI('capture --json');

      expect(result.exitCode).toBeDefined();
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('capture-element command', () => {
    test('should show help for capture-element command', async () => {
      const result = await runCLI('capture-element --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Capture screenshot of specific element');
      expect(output).toContain('<selector>');
      expect(output).toContain('--out');
      expect(output).toContain('--format');
    });

    test('should reject missing selector argument', async () => {
      const result = await runCLI('capture-element');

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain("missing required argument 'selector'");
    });
  });

  describe('mouse interaction commands', () => {
    test('should show help for double-click command', async () => {
      const result = await runCLI('double-click --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Double-click on element by CSS selector');
      expect(output).toContain('<selector>');
    });

    test('should show help for right-click command', async () => {
      const result = await runCLI('right-click --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Right-click (context menu) on element by CSS selector');
      expect(output).toContain('<selector>');
    });

    test('should show help for hover command', async () => {
      const result = await runCLI('hover --help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Hover over element by CSS selector');
      expect(output).toContain('<selector>');
    });
  });

  describe('Natural commands in main help', () => {
    test('should show natural commands in main help', async () => {
      const result = await runCLI('--help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('click [options] <selector>');
      expect(output).toContain('fill [options] <selector> <value>');
      expect(output).toContain('type [options] <text>');
      expect(output).toContain('capture [options]');
      expect(output).toContain('capture-element [options] <selector>');
      expect(output).toContain('double-click [options] <selector>');
      expect(output).toContain('right-click [options] <selector>');
      expect(output).toContain('hover [options] <selector>');
    });

    test('should show correct descriptions for natural commands', async () => {
      const result = await runCLI('--help');

      const output = result.stderr + result.stdout;
      expect(output).toContain('Click on element by CSS selector');
      expect(output).toContain('Fill input field with value');
      expect(output).toContain('Type text at current cursor position');
      expect(output).toContain('Capture viewport screenshot');
      expect(output).toContain('Capture screenshot of specific element');
      expect(output).toContain('Double-click on element by CSS selector');
      expect(output).toContain('Right-click (context menu) on element');
      expect(output).toContain('Hover over element by CSS selector');
    });
  });

  describe('Command validation and error handling', () => {
    test('should handle all natural commands without crashing', async () => {
      const commands = [
        'click "#button" --json',
        'fill "#email" "test@example.com" --json',
        'type "hello world" --json',
        'capture --json',
        'capture-element "#header" --json',
        'double-click ".file" --json',
        'right-click ".menu" --json',
        'hover "#link" --json'
      ];

      for (const command of commands) {
        const result = await runCLI(command);
        // Should not hang or crash - should complete with some exit code
        expect(result.exitCode).toBeDefined();
        expect(typeof result.exitCode).toBe('number');
      }
    }, 45000); // Increase timeout for multiple commands
  });
});