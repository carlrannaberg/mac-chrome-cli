import { uploadFiles, dragDropFiles } from '../files.js';
import { SecurePathValidator } from '../../security/PathValidator.js';
import { ERROR_CODES } from '../../lib/util.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock external dependencies
jest.mock('../../lib/apple.js', () => ({
  execChromeJS: jest.fn(),
  escapeAppleScriptString: jest.fn((str: string) => str.replace(/"/g, '\\"'))
}));

jest.mock('../../lib/util.js', () => ({
  ...jest.requireActual('../../lib/util.js'),
  execWithTimeout: jest.fn(),
  sleep: jest.fn(() => Promise.resolve())
}));

import { execChromeJS } from '../../lib/apple.js';
import { execWithTimeout } from '../../lib/util.js';

const mockExecChromeJS = execChromeJS as jest.MockedFunction<typeof execChromeJS>;
const mockExecWithTimeout = execWithTimeout as jest.MockedFunction<typeof execWithTimeout>;

describe('Files Command Integration Tests', () => {
  let tempDir: string;
  let validFiles: { [key: string]: string };
  let pathValidator: SecurePathValidator;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join('/tmp', 'files-integration-test-'));
    pathValidator = new SecurePathValidator();
    
    // Create valid test files
    validFiles = {
      txt: path.join(tempDir, 'document.txt'),
      pdf: path.join(tempDir, 'report.pdf'),
      jpg: path.join(tempDir, 'image.jpg'),
      doc: path.join(tempDir, 'contract.doc'),
      csv: path.join(tempDir, 'data.csv')
    };

    Object.values(validFiles).forEach(filePath => {
      fs.writeFileSync(filePath, `Test content for ${path.basename(filePath)}`);
    });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFiles', () => {
    describe('security validation integration', () => {
      test('should block directory traversal attacks', async () => {
        const maliciousPath = '../../../etc/passwd';
        
        const result = await uploadFiles({
          selector: '#file-input',
          path: maliciousPath
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('Path traversal detected');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
        expect(result.filesUploaded).toEqual([]);
      });

      test('should block null byte injection', async () => {
        const maliciousPath = `/tmp/test.txt\0.exe`;
        
        const result = await uploadFiles({
          selector: '#file-input',
          path: maliciousPath
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('Null byte injection detected');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should block files outside allowed directories', async () => {
        const systemPath = '/etc/hosts';
        
        const result = await uploadFiles({
          selector: '#file-input',
          path: systemPath
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('Path outside allowed directories');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should block dangerous file extensions', async () => {
        const executablePath = path.join(tempDir, 'malware.exe');
        fs.writeFileSync(executablePath, 'fake executable');
        
        try {
          const result = await uploadFiles({
            selector: '#file-input',
            path: executablePath
          });

          expect(result.success).toBe(false);
          expect(result.error).toContain('Security validation failed');
          expect(result.error).toContain('File type .exe not allowed');
          expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
        } finally {
          fs.unlinkSync(executablePath);
        }
      });

      test('should block non-existent files', async () => {
        const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');
        
        const result = await uploadFiles({
          selector: '#file-input',
          path: nonExistentPath
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('File does not exist');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should accept valid files in allowed directories', async () => {
        // Mock successful file input verification
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: { exists: true }
        });

        // Mock successful file input click
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: true,
          code: ERROR_CODES.OK,
          timestamp: '2024-01-01T00:00:00.000Z'
        });

        // Mock successful AppleScript execution
        mockExecWithTimeout.mockResolvedValueOnce({
          success: true,
          data: {
            stdout: 'SUCCESS',
            stderr: '',
            command: 'osascript -e test'
          },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        });

        // Mock successful file verification
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: {
            fileCount: 1,
            files: ['document.txt']
          },
          code: ERROR_CODES.OK,
          timestamp: '2024-01-01T00:00:00.000Z'
        });

        const result = await uploadFiles({
          selector: '#file-input',
          path: validFiles.txt
        });

        expect(result.success).toBe(true);
        expect(result.filesUploaded).toEqual(['document.txt']);
        expect(result.totalFiles).toBe(1);
        expect(result.code).toBe(ERROR_CODES.OK);
      });
    });

    describe('multiple file security validation', () => {
      test('should reject if any file in multiple selection is malicious', async () => {
        const mixedPaths = `${validFiles.txt},../../../etc/passwd`;
        
        const result = await uploadFiles({
          selector: '#file-input',
          path: mixedPaths,
          multiple: true
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('Path traversal detected');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should reject if any file has dangerous extension', async () => {
        const malwareFile = path.join(tempDir, 'virus.exe');
        fs.writeFileSync(malwareFile, 'fake virus');
        
        try {
          const mixedPaths = `${validFiles.txt},${malwareFile}`;
          
          const result = await uploadFiles({
            selector: '#file-input',
            path: mixedPaths,
            multiple: true
          });

          expect(result.success).toBe(false);
          expect(result.error).toContain('Security validation failed');
          expect(result.error).toContain('File type .exe not allowed');
          expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
        } finally {
          fs.unlinkSync(malwareFile);
        }
      });

      test('should accept multiple valid files', async () => {
        // Mock successful file input verification
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: { exists: true }
        });

        // Mock successful file input click
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: true,
          code: ERROR_CODES.OK,
          timestamp: '2024-01-01T00:00:00.000Z'
        });

        // Mock successful AppleScript executions for each file
        const successResult = {
          success: true,
          data: {
            stdout: 'SUCCESS',
            stderr: '',
            command: 'osascript -e test'
          },
          code: ERROR_CODES.OK,
          error: '',
          context: {}
        };
        mockExecWithTimeout
          .mockResolvedValueOnce(successResult)
          .mockResolvedValueOnce(successResult)
          .mockResolvedValueOnce(successResult);

        // Mock successful file verification
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: {
            fileCount: 2,
            files: ['document.txt', 'report.pdf']
          },
          code: ERROR_CODES.OK,
          timestamp: '2024-01-01T00:00:00.000Z'
        });

        const multiplePaths = `${validFiles.txt},${validFiles.pdf}`;
        
        const result = await uploadFiles({
          selector: '#file-input',
          path: multiplePaths,
          multiple: true
        });

        expect(result.success).toBe(true);
        expect(result.filesUploaded).toEqual(['document.txt', 'report.pdf']);
        expect(result.totalFiles).toBe(2);
        expect(result.code).toBe(ERROR_CODES.OK);
      });
    });

    describe('input validation', () => {
      test('should reject empty selector', async () => {
        const result = await uploadFiles({
          selector: '',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('CSS selector is required');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should reject empty path', async () => {
        const result = await uploadFiles({
          selector: '#file-input',
          path: ''
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File path is required and must be a non-empty string');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should handle tilde expansion in paths', async () => {
        const homeFile = path.join(os.homedir(), 'test-upload.txt');
        fs.writeFileSync(homeFile, 'test content');
        
        try {
          // Mock successful operations for this test
          mockExecChromeJS
            .mockResolvedValueOnce({ success: true, data: { exists: true }, code: ERROR_CODES.OK, timestamp: '2024-01-01T00:00:00.000Z' })
            .mockResolvedValueOnce({ success: true, data: true, code: ERROR_CODES.OK, timestamp: '2024-01-01T00:00:00.000Z' })
            .mockResolvedValueOnce({
              success: true,
              data: { fileCount: 1, files: ['test-upload.txt'] }
            });
          mockExecWithTimeout.mockResolvedValueOnce({
            success: true,
            data: {
              stdout: 'SUCCESS',
              stderr: '',
              command: 'osascript -e test'
            },
            code: ERROR_CODES.OK,
            error: '',
            context: {}
          });

          const result = await uploadFiles({
            selector: '#file-input',
            path: '~/test-upload.txt'
          });

          expect(result.success).toBe(true);
        } finally {
          fs.unlinkSync(homeFile);
        }
      });
    });

    describe('file input element verification', () => {
      test('should fail if element is not found', async () => {
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: { exists: false, error: 'Element not found' },
          code: ERROR_CODES.OK,
          timestamp: '2024-01-01T00:00:00.000Z'
        });

        const result = await uploadFiles({
          selector: '#non-existent-input',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File input validation failed');
        expect(result.error).toContain('Element not found');
        expect(result.code).toBe(ERROR_CODES.TARGET_NOT_FOUND);
      });

      test('should fail if element is not a file input', async () => {
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: { exists: false, error: 'Element is not a file input' }
        });

        const result = await uploadFiles({
          selector: '#text-input',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File input validation failed');
        expect(result.error).toContain('Element is not a file input');
        expect(result.code).toBe(ERROR_CODES.TARGET_NOT_FOUND);
      });

      test('should fail if element is hidden', async () => {
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: { exists: false, error: 'File input is hidden' }
        });

        const result = await uploadFiles({
          selector: '#hidden-input',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File input validation failed');
        expect(result.error).toContain('File input is hidden');
        expect(result.code).toBe(ERROR_CODES.TARGET_NOT_FOUND);
      });
    });

    describe('AppleScript execution failures', () => {
      test('should handle AppleScript permission errors', async () => {
        mockExecChromeJS
          .mockResolvedValueOnce({ success: true, data: { exists: true }, code: ERROR_CODES.OK, timestamp: '2024-01-01T00:00:00.000Z' })
          .mockResolvedValueOnce({ success: true, data: true, code: ERROR_CODES.OK, timestamp: '2024-01-01T00:00:00.000Z' });
        
        mockExecWithTimeout.mockResolvedValueOnce({
          success: false,
          error: 'not authorized to send Apple events',
          code: ERROR_CODES.UNKNOWN_ERROR,
          data: undefined,
          context: {}
        });

        const result = await uploadFiles({
          selector: '#file-input',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('AppleScript automation permission denied');
        expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      });

      test('should handle AppleScript execution errors', async () => {
        mockExecChromeJS
          .mockResolvedValueOnce({ success: true, data: { exists: true }, code: ERROR_CODES.OK, timestamp: '2024-01-01T00:00:00.000Z' })
          .mockResolvedValueOnce({ success: true, data: true, code: ERROR_CODES.OK, timestamp: '2024-01-01T00:00:00.000Z' });
        
        mockExecWithTimeout.mockResolvedValueOnce({
          success: false,
          error: 'execution error',
          code: ERROR_CODES.UNKNOWN_ERROR,
          data: undefined,
          context: {}
        });

        const result = await uploadFiles({
          selector: '#file-input',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File upload failed at file 1');
        expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      });
    });
  });

  describe('dragDropFiles', () => {
    describe('security validation integration', () => {
      test('should block directory traversal attacks', async () => {
        const maliciousPath = '../../../etc/passwd';
        
        const result = await dragDropFiles({
          selector: '.dropzone',
          path: maliciousPath
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('Path traversal detected');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should block null byte injection', async () => {
        const maliciousPath = `/tmp/test.txt\0.exe`;
        
        const result = await dragDropFiles({
          selector: '.dropzone',
          path: maliciousPath
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.error).toContain('Null byte injection detected');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      });

      test('should accept valid files for drag and drop', async () => {
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: {
            success: true,
            files: ['document.txt'],
            message: 'Drag and drop events dispatched'
          }
        });

        const result = await dragDropFiles({
          selector: '.dropzone',
          path: validFiles.txt
        });

        expect(result.success).toBe(true);
        expect(result.filesUploaded).toEqual(['document.txt']);
        expect(result.code).toBe(ERROR_CODES.OK);
      });

      test('should validate multiple files in drag and drop', async () => {
        const malwareFile = path.join(tempDir, 'script.bat');
        fs.writeFileSync(malwareFile, 'malicious script');
        
        try {
          const mixedPaths = `${validFiles.txt},${malwareFile}`;
          
          const result = await dragDropFiles({
            selector: '.dropzone',
            path: mixedPaths,
            multiple: true
          });

          expect(result.success).toBe(false);
          expect(result.error).toContain('Security validation failed');
          expect(result.error).toContain('File type .bat not allowed');
          expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
        } finally {
          fs.unlinkSync(malwareFile);
        }
      });
    });

    describe('dropzone element validation', () => {
      test('should fail if dropzone element is not found', async () => {
        mockExecChromeJS.mockResolvedValueOnce({
          success: true,
          data: { success: false, error: 'Dropzone element not found' }
        });

        const result = await dragDropFiles({
          selector: '.non-existent-dropzone',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Dropzone element not found');
        expect(result.code).toBe(ERROR_CODES.TARGET_NOT_FOUND);
      });

      test('should handle JavaScript execution errors', async () => {
        mockExecChromeJS.mockResolvedValueOnce({
          success: false,
          error: 'JavaScript execution failed'
        });

        const result = await dragDropFiles({
          selector: '.dropzone',
          path: validFiles.txt
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('JavaScript execution failed');
        expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      });
    });
  });

  describe('path expansion and validation integration', () => {
    test('should properly expand and validate home directory paths', async () => {
      const homeTestFile = path.join(os.homedir(), 'security-test.txt');
      fs.writeFileSync(homeTestFile, 'test content');
      
      try {
        const tildeResult = await uploadFiles({
          selector: '#file-input',
          path: '~/security-test.txt'
        });

        expect(tildeResult.success).toBe(false); // Will fail at file input verification, but path validation should pass
        expect(tildeResult.error).not.toContain('Security validation failed');
      } finally {
        fs.unlinkSync(homeTestFile);
      }
    });

    test('should validate paths after expansion', async () => {
      // Test that path validation happens after tilde expansion
      const result = await uploadFiles({
        selector: '#file-input',
        path: '~/../../../../etc/passwd'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security validation failed');
    });
  });

  describe('comprehensive security integration', () => {
    test('should maintain security through entire upload pipeline', async () => {
      const attackVectors = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '/tmp/test.txt\0.exe',
        '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts'
      ];

      for (const attack of attackVectors) {
        const result = await uploadFiles({
          selector: '#file-input',
          path: attack
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security validation failed');
        expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
        expect(result.filesUploaded).toEqual([]);
      }
    });

    test('should block all dangerous file extensions', async () => {
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar'];
      
      for (const ext of dangerousExtensions) {
        const maliciousFile = path.join(tempDir, `malware${ext}`);
        fs.writeFileSync(maliciousFile, 'malicious content');
        
        try {
          const result = await uploadFiles({
            selector: '#file-input',
            path: maliciousFile
          });

          expect(result.success).toBe(false);
          expect(result.error).toContain('Security validation failed');
          expect(result.error).toContain(`File type ${ext} not allowed`);
          expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
        } finally {
          if (fs.existsSync(maliciousFile)) {
            fs.unlinkSync(maliciousFile);
          }
        }
      }
    });

    test('should allow all whitelisted extensions', async () => {
      const validator = new SecurePathValidator();
      const allowedExtensions = validator.getAllowedExtensions();
      
      // Test a subset of allowed extensions to avoid test complexity
      const testExtensions = ['.txt', '.pdf', '.jpg', '.doc', '.csv'];
      
      for (const ext of testExtensions) {
        expect(allowedExtensions).toContain(ext);
        
        const testFile = path.join(tempDir, `test${ext}`);
        if (!fs.existsSync(testFile)) {
          fs.writeFileSync(testFile, 'test content');
        }
        
        // The upload will fail at browser interaction, but security validation should pass
        const result = await uploadFiles({
          selector: '#file-input',
          path: testFile
        });

        // Should not fail due to security validation
        if (result.error && result.error.includes('Security validation failed')) {
          fail(`Extension ${ext} should be allowed but was rejected: ${result.error}`);
        }
      }
    });
  });
});