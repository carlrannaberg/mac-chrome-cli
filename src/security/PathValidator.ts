import * as path from 'path';
import * as fs from 'fs';
import type { ISecurePathValidator, ValidationResult } from './ISecurePathValidator.js';

export class SecurePathValidator implements ISecurePathValidator {
  private readonly allowedPrefixes: string[] = [];
  private readonly allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.zip', '.csv', '.json', '.xml'];

  constructor() {
    // Initialize allowed prefixes with safe defaults
    this.allowedPrefixes = [
      process.env.HOME || '',
      '/tmp',
      '/var/tmp',
      process.cwd()
    ].filter(prefix => prefix.length > 0);
  }

  validateFilePath(inputPath: string): ValidationResult<string> {
    if (!inputPath || typeof inputPath !== 'string') {
      return { success: false, error: 'Path is required and must be a string' };
    }

    // Check for traversal patterns before any normalization
    if (inputPath.includes('../') || inputPath.includes('..\\') || inputPath.includes('..')) {
      return { success: false, error: 'Path traversal detected: .. patterns are not allowed' };
    }

    // Check for other suspicious patterns
    if (inputPath.includes('\0') || inputPath.includes('\x00')) {
      return { success: false, error: 'Null byte injection detected' };
    }

    // Normalize and resolve the path
    let normalized: string;
    try {
      normalized = path.normalize(path.resolve(inputPath));
    } catch (error) {
      return { success: false, error: `Invalid path format: ${error}` };
    }

    // Ensure normalized path is within allowed directories
    const isAllowed = this.allowedPrefixes.some(prefix => {
      const resolvedPrefix = path.resolve(prefix);
      return normalized.startsWith(resolvedPrefix + path.sep) || normalized === resolvedPrefix;
    });

    if (!isAllowed) {
      return { 
        success: false, 
        error: `Path outside allowed directories. Allowed prefixes: ${this.allowedPrefixes.join(', ')}` 
      };
    }

    // Check file extension against whitelist
    const ext = path.extname(normalized).toLowerCase();
    if (!ext) {
      return { success: false, error: 'File must have an extension' };
    }

    if (!this.allowedExtensions.includes(ext)) {
      return { 
        success: false, 
        error: `File type ${ext} not allowed. Allowed types: ${this.allowedExtensions.join(', ')}` 
      };
    }

    // Verify file exists and is readable
    try {
      const stats = fs.statSync(normalized);
      if (!stats.isFile()) {
        return { success: false, error: 'Path is not a file' };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: false, error: 'File does not exist' };
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        return { success: false, error: 'File not accessible - permission denied' };
      } else {
        return { success: false, error: `File not accessible: ${error}` };
      }
    }

    return { success: true, value: normalized };
  }

  isSecurePath(filePath: string): boolean {
    return this.validateFilePath(filePath).success;
  }

  /**
   * Get allowed prefixes for testing and debugging
   */
  getAllowedPrefixes(): readonly string[] {
    return [...this.allowedPrefixes];
  }

  /**
   * Get allowed extensions for testing and debugging  
   */
  getAllowedExtensions(): readonly string[] {
    return [...this.allowedExtensions];
  }
}