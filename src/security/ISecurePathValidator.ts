export interface ValidationResult<T = string> {
  success: boolean;
  value?: T;
  error?: string;
}

export interface ISecurePathValidator {
  validateFilePath(inputPath: string): ValidationResult<string>;
  isSecurePath(filePath: string): boolean;
}

export namespace ValidationResult {
  export function ok<T>(value: T): ValidationResult<T> {
    return { success: true, value };
  }
  
  export function error<T = string>(error: string): ValidationResult<T> {
    return { success: false, error };
  }
}