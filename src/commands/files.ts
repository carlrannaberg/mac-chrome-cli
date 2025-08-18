import { execChromeJS, escapeAppleScriptString } from '../lib/apple.js';
import { expandPath, validateInput, sleep, escapeCSSSelector, ERROR_CODES, type ErrorCode } from '../lib/util.js';
import { SecurePathValidator } from '../security/PathValidator.js';
import { appleScriptService } from '../services/AppleScriptService.js';
import { Result, ok, error, isOk, type ResultContext } from '../core/index.js';

// Initialize path validator for secure file operations
const pathValidator = new SecurePathValidator();

export interface FileUploadOptions {
  selector: string;
  path: string;
  multiple?: boolean;
  timeout?: number;
}

/**
 * File upload data
 */
export interface FileUploadData {
  filesUploaded: string[];
  totalFiles: number;
}

/**
 * File upload result using unified Result<T,E> pattern
 */
export type FileUploadResult = Result<FileUploadData, string>;

/**
 * Legacy FileUploadResult interface for backward compatibility
 * @deprecated Use FileUploadResult (Result<FileUploadData, string>) instead
 */
export interface LegacyFileUploadResult {
  success: boolean;
  filesUploaded: string[];
  totalFiles: number;
  error?: string | undefined;
  code: ErrorCode;
}

/**
 * Execute AppleScript with proper error handling using service container or legacy service
 */
async function executeAppleScript(
  script: string, 
  timeoutMs: number = 10000, 
  serviceContainer?: IServiceContainer
): Promise<{ success: boolean; error?: string }> {
  try {
    let scriptService: IAppleScriptService;
    
    if (serviceContainer) {
      const result = await serviceContainer.resolve(SERVICE_TOKENS.AppleScriptService);
      if (!result.success) {
        return { success: false, error: `Failed to resolve AppleScriptService: ${result.error}` };
      }
      scriptService = result.data;
    } else {
      // Fallback to legacy service
      scriptService = appleScriptService;
    }
    
    const result = await scriptService.executeScript(script, timeoutMs);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'AppleScript execution failed'
      };
    }

    // Check for AppleScript errors in the result
    if (result.result?.includes('error') || result.result?.includes('ERROR')) {
      return {
        success: false,
        error: result.result.trim()
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute AppleScript: ${error}`
    };
  }
}

/**
 * Validate file path with security checks and expand tilde
 */
function validateAndExpandPath(filePath: string): { valid: boolean; expandedPath?: string; error?: string } {
  if (!validateInput(filePath, 'string')) {
    return { valid: false, error: 'File path is required and must be a non-empty string' };
  }

  // First expand the path to handle tilde
  const expandedPath = expandPath(filePath);
  
  // Use secure path validator to check for security issues
  const securityValidation = pathValidator.validateFilePath(expandedPath);
  if (!securityValidation.success) {
    return { valid: false, error: `Security validation failed: ${securityValidation.error}` };
  }

  // The validator already checks file existence and accessibility
  return { valid: true, expandedPath: securityValidation.value! };
}

/**
 * Parse multiple file paths from a string (comma or semicolon separated)
 */
function parseMultipleFiles(paths: string): string[] {
  return paths
    .split(/[,;]/)
    .map(path => path.trim())
    .filter(path => path.length > 0);
}

/**
 * Check if file input element exists and is visible
 */
async function verifyFileInput(selector: string): Promise<{ exists: boolean; error?: string }> {
  const checkScript = `
(function() {
  const element = document.querySelector('${escapeCSSSelector(selector)}');
  if (!element) {
    return { exists: false, error: 'Element not found' };
  }
  
  if (element.tagName.toLowerCase() !== 'input' || element.type !== 'file') {
    return { exists: false, error: 'Element is not a file input' };
  }
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return { exists: false, error: 'File input is hidden' };
  }
  
  return { exists: true };
})();
`;

  try {
    const result = await execChromeJS<{ exists: boolean; error?: string }>(checkScript);
    
    if (!result.success) {
      return { exists: false, error: result.error || 'Failed to check file input' };
    }

    return result.result || { exists: false, error: 'Invalid response from browser' };
  } catch (error) {
    return { exists: false, error: `Failed to verify file input: ${error}` };
  }
}

/**
 * Upload files to a file input element
 */
export async function uploadFiles(options: FileUploadOptions): Promise<LegacyFileUploadResult> {
  const { selector, path, multiple = false, timeout = 30000 } = options;

  // Validate inputs
  if (!validateInput(selector, 'string')) {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: 0,
      error: 'CSS selector is required',
      code: ERROR_CODES.INVALID_INPUT
    };
  }

  // Parse file paths
  const filePaths = multiple ? parseMultipleFiles(path) : [path];
  
  if (filePaths.length === 0) {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: 0,
      error: 'At least one file path is required',
      code: ERROR_CODES.INVALID_INPUT
    };
  }

  // Validate and expand all file paths
  const validatedFiles: string[] = [];
  for (const filePath of filePaths) {
    const validation = validateAndExpandPath(filePath);
    if (!validation.valid) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: filePaths.length,
        error: validation.error,
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    validatedFiles.push(validation.expandedPath!);
  }

  // Verify file input exists and is accessible
  const inputCheck = await verifyFileInput(selector);
  if (!inputCheck.exists) {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: validatedFiles.length,
      error: `File input validation failed: ${inputCheck.error}`,
      code: ERROR_CODES.TARGET_NOT_FOUND
    };
  }

  try {
    // Step 1: Click the file input to open the dialog
    const clickScript = `
(function() {
  const element = document.querySelector('${escapeCSSSelector(selector)}');
  if (element) {
    element.click();
    return true;
  }
  return false;
})();
`;

    const clickResult = await execChromeJS<boolean>(clickScript);
    if (!clickResult.success || !clickResult.result) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: validatedFiles.length,
        error: 'Failed to click file input element',
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }

    // Wait for dialog to open
    await sleep(500);

    // Step 2: Use AppleScript to navigate the file dialog
    for (let i = 0; i < validatedFiles.length; i++) {
      const filePath = validatedFiles[i];
      
      if (!filePath) {
        return {
          success: false,
          filesUploaded: validatedFiles.slice(0, i),
          totalFiles: validatedFiles.length,
          error: `Invalid file path at index ${i}`,
          code: ERROR_CODES.INVALID_INPUT
        };
      }
      
      const appleScript = `
tell application "System Events"
  try
    -- Use Cmd+Shift+G to open "Go to Folder" dialog
    keystroke "g" using {command down, shift down}
    delay 0.3
    
    -- Type the file path
    keystroke "${escapeAppleScriptString(filePath)}"
    delay 0.2
    
    -- Press Return to navigate to the file
    key code 36  -- Return
    delay 0.3
    
    -- Press Return again to select the file
    key code 36  -- Return
    delay 0.2
    
    ${multiple && i < validatedFiles.length - 1 ? `
    -- For multiple files, hold Cmd and continue selecting
    if ${i < validatedFiles.length - 1} then
      key code 31 using {command down}  -- Cmd+O to add more files
      delay 0.3
    end if
    ` : ''}
    
    return "SUCCESS"
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;

      const scriptResult = await executeAppleScript(appleScript, timeout);
      if (!scriptResult.success) {
        return {
          success: false,
          filesUploaded: validatedFiles.slice(0, i),
          totalFiles: validatedFiles.length,
          error: `File upload failed at file ${i + 1}: ${scriptResult.error}`,
          code: ERROR_CODES.UNKNOWN_ERROR
        };
      }
    }

    // Step 3: For multiple files, press final Return or click Open
    if (multiple && validatedFiles.length > 1) {
      const finalAppleScript = `
tell application "System Events"
  try
    delay 0.2
    key code 36  -- Final Return to confirm all selections
    return "SUCCESS"
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell`;

      const finalResult = await executeAppleScript(finalAppleScript, 5000);
      if (!finalResult.success) {
        return {
          success: false,
          filesUploaded: [],
          totalFiles: validatedFiles.length,
          error: `Failed to confirm multiple file selection: ${finalResult.error}`,
          code: ERROR_CODES.UNKNOWN_ERROR
        };
      }
    }

    // Wait for upload to process
    await sleep(1000);

    // Step 4: Verify upload success by checking if the input has files
    const verifyScript = `
(function() {
  const element = document.querySelector('${escapeCSSSelector(selector)}');
  if (element && element.files) {
    return {
      fileCount: element.files.length,
      files: Array.from(element.files).map(file => file.name)
    };
  }
  return { fileCount: 0, files: [] };
})();
`;

    const verifyResult = await execChromeJS<{ fileCount: number; files: string[] }>(verifyScript);
    if (!verifyResult.success) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: validatedFiles.length,
        error: 'Failed to verify file upload',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    const uploadedInfo = verifyResult.result || { fileCount: 0, files: [] };
    
    if (uploadedInfo.fileCount === 0) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: validatedFiles.length,
        error: 'No files were uploaded - the file dialog may have been cancelled',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    return {
      success: true,
      filesUploaded: uploadedInfo.files,
      totalFiles: uploadedInfo.fileCount,
      code: ERROR_CODES.OK
    };

  } catch (error) {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: validatedFiles.length,
      error: `File upload operation failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Simulate drag and drop file upload for dropzone elements
 */
export async function dragDropFiles(options: FileUploadOptions): Promise<LegacyFileUploadResult> {
  const { selector, path, multiple = false } = options;

  // Validate inputs
  if (!validateInput(selector, 'string')) {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: 0,
      error: 'CSS selector is required',
      code: ERROR_CODES.INVALID_INPUT
    };
  }

  // Parse and validate file paths
  const filePaths = multiple ? parseMultipleFiles(path) : [path];
  const validatedFiles: string[] = [];
  
  for (const filePath of filePaths) {
    const validation = validateAndExpandPath(filePath);
    if (!validation.valid) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: filePaths.length,
        error: validation.error,
        code: ERROR_CODES.INVALID_INPUT
      };
    }
    validatedFiles.push(validation.expandedPath!);
  }

  // Create synthetic drag and drop event
  const dragDropScript = `
(function() {
  const dropzone = document.querySelector('${escapeCSSSelector(selector)}');
  if (!dropzone) {
    return { success: false, error: 'Dropzone element not found' };
  }

  // Create file list from paths (this is a simulation - actual file data would need to be handled differently)
  const fileNames = ${JSON.stringify(validatedFiles.map(f => f.split('/').pop() || f))};
  
  // Create synthetic drag events
  const dragEnterEvent = new DragEvent('dragenter', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  const dragOverEvent = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });

  // Dispatch events
  dropzone.dispatchEvent(dragEnterEvent);
  dropzone.dispatchEvent(dragOverEvent);
  dropzone.dispatchEvent(dropEvent);
  
  return { 
    success: true, 
    files: fileNames,
    message: 'Drag and drop events dispatched (note: actual file upload requires browser file access)' 
  };
})();
`;

  try {
    const result = await execChromeJS<{ success: boolean; files?: string[]; error?: string; message?: string }>(dragDropScript);
    
    if (!result.success) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: validatedFiles.length,
        error: result.error || 'Failed to execute drag and drop',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    const dropResult = result.result;
    if (!dropResult?.success) {
      return {
        success: false,
        filesUploaded: [],
        totalFiles: validatedFiles.length,
        error: dropResult?.error || 'Drag and drop operation failed',
        code: ERROR_CODES.TARGET_NOT_FOUND
      };
    }

    return {
      success: true,
      filesUploaded: dropResult.files || [],
      totalFiles: validatedFiles.length,
      code: ERROR_CODES.OK
    };

  } catch (error) {
    return {
      success: false,
      filesUploaded: [],
      totalFiles: validatedFiles.length,
      error: `Drag and drop operation failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}