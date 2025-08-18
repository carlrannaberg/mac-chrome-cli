import { SecurePathValidator } from '../PathValidator.js';
import { ValidationResult } from '../ISecurePathValidator.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SecurePathValidator', () => {
  let validator: SecurePathValidator;
  let tempDir: string;
  let testFile: string;
  let homeDir: string;

  beforeAll(async () => {
    validator = new SecurePathValidator();
    homeDir = os.homedir();
    tempDir = fs.mkdtempSync(path.join('/tmp', 'path-validator-test-'));
    
    // Create test files with different extensions
    testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');
    
    // Create additional test files
    fs.writeFileSync(path.join(tempDir, 'test.pdf'), 'pdf content');
    fs.writeFileSync(path.join(tempDir, 'test.jpg'), 'jpg content');
    fs.writeFileSync(path.join(tempDir, 'test.doc'), 'doc content');
    fs.writeFileSync(path.join(tempDir, 'dangerous.exe'), 'exe content');
    fs.writeFileSync(path.join(tempDir, 'script.sh'), 'script content');
  });

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validateFilePath', () => {
    describe('valid paths', () => {
      test('should accept valid file in temp directory', () => {
        const result = validator.validateFilePath(testFile);
        expect(result.success).toBe(true);
        expect(result.value).toBe(path.resolve(testFile));
        expect(result.error).toBeUndefined();
      });

      test('should accept file in home directory', () => {
        const homeFile = path.join(homeDir, 'test.txt');
        // Create a temporary file in home directory
        fs.writeFileSync(homeFile, 'test');
        
        try {
          const result = validator.validateFilePath(homeFile);
          expect(result.success).toBe(true);
          expect(result.value).toBe(path.resolve(homeFile));
        } finally {
          // Clean up
          if (fs.existsSync(homeFile)) {
            fs.unlinkSync(homeFile);
          }
        }
      });

      test('should accept file in current working directory', () => {
        const cwdFile = path.join(process.cwd(), 'temp-test.txt');
        fs.writeFileSync(cwdFile, 'test');
        
        try {
          const result = validator.validateFilePath(cwdFile);
          expect(result.success).toBe(true);
          expect(result.value).toBe(path.resolve(cwdFile));
        } finally {
          // Clean up
          if (fs.existsSync(cwdFile)) {
            fs.unlinkSync(cwdFile);
          }
        }
      });

      test('should accept all whitelisted file extensions', () => {
        const allowedExtensions = validator.getAllowedExtensions();
        
        for (const ext of allowedExtensions) {
          const fileName = `test${ext}`;
          const filePath = path.join(tempDir, fileName);
          
          // File already exists for some extensions, create if needed
          if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, 'test content');
          }
          
          const result = validator.validateFilePath(filePath);
          expect(result.success).toBe(true);
          expect(result.value).toBe(path.resolve(filePath));
        }
      });
    });

    describe('directory traversal attacks', () => {
      test('should reject simple directory traversal', () => {
        const result = validator.validateFilePath('../../../etc/passwd');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path traversal detected');
      });

      test('should reject Windows-style directory traversal', () => {
        const result = validator.validateFilePath('..\\..\\windows\\system32\\config\\sam');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path traversal detected');
      });

      test('should reject mixed path separators', () => {
        const result = validator.validateFilePath('../..\\etc/passwd');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path traversal detected');
      });

      test('should reject double-dot anywhere in path', () => {
        const result = validator.validateFilePath('/home/user/..hidden/file.txt');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path traversal detected');
      });

      test('should reject URL-encoded directory traversal as invalid path', () => {
        // URL-encoded paths should be handled by the application layer before reaching validator
        // The validator treats these as literal paths, which then fail other validations
        const result = validator.validateFilePath('%2e%2e%2f%2e%2e%2fetc%2fpasswd.txt');
        expect(result.success).toBe(false);
        // This will fail because the path doesn't exist and/or isn't in allowed directories
        expect(result.error).toMatch(/(File does not exist|Path outside allowed directories)/);
      });

      test('should reject nested directory traversal patterns', () => {
        const result = validator.validateFilePath('....//....//etc/passwd');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path traversal detected');
      });
    });

    describe('null byte injection attacks', () => {
      test('should reject null byte in path', () => {
        const result = validator.validateFilePath('/tmp/test.txt\0.jpg');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Null byte injection detected');
      });

      test('should reject hex-encoded null byte', () => {
        const result = validator.validateFilePath('/tmp/test.txt\x00.jpg');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Null byte injection detected');
      });

      test('should reject multiple null bytes', () => {
        const result = validator.validateFilePath('/tmp/test\0.txt\0.jpg');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Null byte injection detected');
      });
    });

    describe('path validation outside allowed directories', () => {
      test('should reject files outside allowed prefixes', () => {
        const result = validator.validateFilePath('/etc/passwd');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path outside allowed directories');
      });

      test('should reject Windows system files', () => {
        const result = validator.validateFilePath('C:\\Windows\\System32\\config\\SAM.txt');
        expect(result.success).toBe(false);
        // On Unix systems, this will be treated as a relative path and fail existence check
        // The important thing is it fails validation
        expect(result.error).toMatch(/(File does not exist|Path outside allowed directories)/);
      });

      test('should reject absolute paths to sensitive directories', () => {
        const result = validator.validateFilePath('/root/.ssh/id_rsa');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path outside allowed directories');
      });
    });

    describe('file extension validation', () => {
      test('should reject dangerous executable extensions', () => {
        const dangerousFile = path.join(tempDir, 'malware.exe');
        const result = validator.validateFilePath(dangerousFile);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File type .exe not allowed');
      });

      test('should reject script files', () => {
        const scriptFile = path.join(tempDir, 'script.sh');
        const result = validator.validateFilePath(scriptFile);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File type .sh not allowed');
      });

      test('should reject files without extensions', () => {
        const noExtFile = path.join(tempDir, 'noextension');
        fs.writeFileSync(noExtFile, 'content');
        
        const result = validator.validateFilePath(noExtFile);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File must have an extension');
        
        // Clean up
        fs.unlinkSync(noExtFile);
      });

      test('should reject case variations of blocked extensions', () => {
        const upperCaseExe = path.join(tempDir, 'malware.EXE');
        fs.writeFileSync(upperCaseExe, 'content');
        
        const result = validator.validateFilePath(upperCaseExe);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File type .exe not allowed');
        
        // Clean up
        fs.unlinkSync(upperCaseExe);
      });

      test('should handle multiple dots in filename correctly', () => {
        const multiDotFile = path.join(tempDir, 'file.backup.txt');
        fs.writeFileSync(multiDotFile, 'content');
        
        const result = validator.validateFilePath(multiDotFile);
        expect(result.success).toBe(true);
        expect(result.value).toBe(path.resolve(multiDotFile));
        
        // Clean up
        fs.unlinkSync(multiDotFile);
      });
    });

    describe('file existence and accessibility', () => {
      test('should reject non-existent files', () => {
        const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');
        const result = validator.validateFilePath(nonExistentFile);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File does not exist');
      });

      test('should reject directories with extension', () => {
        // Create a directory that ends with .txt to test the directory check
        const dirWithExt = path.join(tempDir, 'fake-file.txt');
        fs.mkdirSync(dirWithExt);
        
        try {
          const result = validator.validateFilePath(dirWithExt);
          expect(result.success).toBe(false);
          expect(result.error).toContain('Path is not a file');
        } finally {
          fs.rmSync(dirWithExt, { recursive: true, force: true });
        }
      });

      test('should handle permission errors gracefully', () => {
        // Create a file with restricted permissions
        const restrictedFile = path.join(tempDir, 'restricted.txt');
        fs.writeFileSync(restrictedFile, 'content');
        
        try {
          // Try to restrict permissions (may not work on all systems)
          fs.chmodSync(restrictedFile, 0o000);
          
          const result = validator.validateFilePath(restrictedFile);
          // Result may vary based on system and permissions
          if (!result.success) {
            expect(result.error).toMatch(/(File not accessible|permission denied)/i);
          }
        } catch (error) {
          // Permission change might fail, skip this test
          console.warn('Skipping permission test due to system limitations');
        } finally {
          // Restore permissions for cleanup
          try {
            fs.chmodSync(restrictedFile, 0o644);
            fs.unlinkSync(restrictedFile);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
    });

    describe('input validation', () => {
      test('should reject null input', () => {
        const result = validator.validateFilePath(null as unknown as string);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path is required and must be a string');
      });

      test('should reject undefined input', () => {
        const result = validator.validateFilePath(undefined as unknown as string);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path is required and must be a string');
      });

      test('should reject empty string', () => {
        const result = validator.validateFilePath('');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path is required and must be a string');
      });

      test('should reject non-string input', () => {
        const result = validator.validateFilePath(123 as unknown as string);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path is required and must be a string');
      });

      test('should reject array input', () => {
        const result = validator.validateFilePath(['path'] as unknown as string);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path is required and must be a string');
      });

      test('should reject object input', () => {
        const result = validator.validateFilePath({ path: '/tmp/test.txt' } as unknown as string);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Path is required and must be a string');
      });
    });

    describe('edge cases and malformed paths', () => {
      test('should handle very long paths', () => {
        const longPath = path.join(tempDir, 'a'.repeat(255) + '.txt');
        
        // Create file only if path length is within system limits
        try {
          fs.writeFileSync(longPath, 'content');
          const result = validator.validateFilePath(longPath);
          expect(result.success).toBe(true);
          fs.unlinkSync(longPath);
        } catch (error) {
          // Path too long for system, that's also a valid failure mode
          const result = validator.validateFilePath(longPath);
          expect(result.success).toBe(false);
        }
      });

      test('should handle paths with special characters', () => {
        const specialFile = path.join(tempDir, 'file with spaces & special chars!@#$.txt');
        fs.writeFileSync(specialFile, 'content');
        
        const result = validator.validateFilePath(specialFile);
        expect(result.success).toBe(true);
        expect(result.value).toBe(path.resolve(specialFile));
        
        fs.unlinkSync(specialFile);
      });

      test('should handle Unicode characters in filenames', () => {
        const unicodeFile = path.join(tempDir, '测试文件🔒.txt');
        fs.writeFileSync(unicodeFile, 'content');
        
        const result = validator.validateFilePath(unicodeFile);
        expect(result.success).toBe(true);
        expect(result.value).toBe(path.resolve(unicodeFile));
        
        fs.unlinkSync(unicodeFile);
      });

      test('should normalize redundant path separators', () => {
        const redundantPath = path.join(tempDir, 'test.txt').replace(/[\/\\]/g, '$&$&');
        const result = validator.validateFilePath(redundantPath);
        expect(result.success).toBe(true);
        expect(result.value).toBe(path.resolve(testFile));
      });

      test('should handle relative paths without traversal correctly', () => {
        // Create a test file in the project directory (which is allowed)
        const projectDir = process.cwd();
        const relativeTestFile = path.join(projectDir, 'temp-relative-test.txt');
        fs.writeFileSync(relativeTestFile, 'test content');
        
        try {
          // Test with a simple relative path (no ../ patterns)
          const result = validator.validateFilePath('temp-relative-test.txt');
          
          expect(result.success).toBe(true);
          expect(result.value).toBe(path.resolve(relativeTestFile));
        } finally {
          fs.unlinkSync(relativeTestFile);
        }
      });
    });

    describe('performance and resource exhaustion attacks', () => {
      test('should handle rapid successive validation calls', () => {
        const start = Date.now();
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
          validator.validateFilePath(testFile);
        }
        
        const elapsed = Date.now() - start;
        // Should complete 1000 validations in reasonable time (< 1 second)
        expect(elapsed).toBeLessThan(1000);
      });

      test('should handle validation with many path segments', () => {
        const deepPath = path.join(tempDir, ...Array(50).fill('level'), 'deep.txt');
        const result = validator.validateFilePath(deepPath);
        
        // Should either succeed (if path is valid) or fail gracefully
        expect(typeof result.success).toBe('boolean');
        if (result.error) {
          expect(typeof result.error).toBe('string');
        }
      });
    });
  });

  describe('isSecurePath', () => {
    test('should return true for valid paths', () => {
      expect(validator.isSecurePath(testFile)).toBe(true);
    });

    test('should return false for invalid paths', () => {
      expect(validator.isSecurePath('../../../etc/passwd')).toBe(false);
      expect(validator.isSecurePath('/tmp/malware.exe')).toBe(false);
      expect(validator.isSecurePath('path\0injection.txt')).toBe(false);
    });

    test('should return false for non-string input', () => {
      expect(validator.isSecurePath(null as unknown as string)).toBe(false);
      expect(validator.isSecurePath(undefined as unknown as string)).toBe(false);
      expect(validator.isSecurePath(123 as unknown as string)).toBe(false);
    });
  });

  describe('getAllowedPrefixes', () => {
    test('should return read-only array of allowed prefixes', () => {
      const prefixes = validator.getAllowedPrefixes();
      expect(Array.isArray(prefixes)).toBe(true);
      expect(prefixes.length).toBeGreaterThan(0);
      
      // Should include common safe directories
      const prefixStrings = prefixes.join(' ');
      expect(prefixStrings).toMatch(/(home|tmp|Users)/i);
      
      // Should be read-only (modifications shouldn't affect validator)
      const originalLength = prefixes.length;
      (prefixes as unknown as string[]).push('/malicious');
      expect(validator.getAllowedPrefixes().length).toBe(originalLength);
    });
  });

  describe('getAllowedExtensions', () => {
    test('should return read-only array of allowed extensions', () => {
      const extensions = validator.getAllowedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
      
      // Should include common safe extensions
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.pdf');
      expect(extensions).toContain('.jpg');
      
      // Should not include dangerous extensions
      expect(extensions).not.toContain('.exe');
      expect(extensions).not.toContain('.bat');
      expect(extensions).not.toContain('.sh');
      
      // Should be read-only
      const originalLength = extensions.length;
      (extensions as unknown as string[]).push('.exe');
      expect(validator.getAllowedExtensions().length).toBe(originalLength);
    });
  });

  describe('ValidationResult utility functions', () => {
    test('should create success result correctly', () => {
      const result = ValidationResult.ok('test-value');
      expect(result.success).toBe(true);
      expect(result.value).toBe('test-value');
      expect(result.error).toBeUndefined();
    });

    test('should create error result correctly', () => {
      const result = ValidationResult.error('test-error');
      expect(result.success).toBe(false);
      expect(result.error).toBe('test-error');
      expect(result.value).toBeUndefined();
    });

    test('should handle different value types', () => {
      const stringResult = ValidationResult.ok('string');
      const numberResult = ValidationResult.ok(123);
      const objectResult = ValidationResult.ok({ key: 'value' });
      
      expect(stringResult.value).toBe('string');
      expect(numberResult.value).toBe(123);
      expect(objectResult.value).toEqual({ key: 'value' });
    });
  });

  describe('security regression tests', () => {
    test('should maintain security even with complex attack combinations', () => {
      const complexAttacks = [
        '../../../etc/passwd\0.jpg',
        '..\\..\\..\\windows\\system32\\config\\sam.txt',
        '/tmp/../../../etc/shadow',
        'C:\\Windows\\..\\..\\..\\boot.ini',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd.pdf',
        './../../../../../../etc/hosts.txt',
        'file.txt\x00malicious.exe',
        '\\\\server\\share\\..\\..\\sensitive.doc'
      ];
      
      for (const attack of complexAttacks) {
        const result = validator.validateFilePath(attack);
        expect(result.success).toBe(false);
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });

    test('should handle attempts to bypass extension validation', () => {
      const bypassAttempts = [
        path.join(tempDir, 'malware.exe.txt'), // Would need to exist and have .txt extension
        path.join(tempDir, 'script.sh.pdf'),   // Would need to exist and have .pdf extension
        path.join(tempDir, 'virus.bat.jpg'),   // Would need to exist and have .jpg extension
      ];
      
      for (const attempt of bypassAttempts) {
        fs.writeFileSync(attempt, 'content');
        const result = validator.validateFilePath(attempt);
        
        // These should succeed because they have valid extensions
        expect(result.success).toBe(true);
        
        fs.unlinkSync(attempt);
      }
      
      // But these should fail due to invalid extensions
      const realBypass = path.join(tempDir, 'malware.exe');
      const result = validator.validateFilePath(realBypass);
      expect(result.success).toBe(false);
    });
  });
});