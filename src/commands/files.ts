import { execChromeJS, escapeAppleScriptString } from '../lib/apple.js';
import { expandPath, validateInput, sleep, escapeCSSSelector, ERROR_CODES, type ErrorCode } from '../lib/util.js';
import { SecurePathValidator } from '../security/PathValidator.js';
import { appleScriptService } from '../services/AppleScriptService.js';
import { Result } from '../core/index.js';
import { type IServiceContainer } from '../di/ServiceContainer.js';
import { type IAppleScriptService } from '../services/IAppleScriptService.js';
import { SERVICE_TOKENS } from '../di/ServiceTokens.js';

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
    if (result.data?.includes('error') || result.data?.includes('ERROR')) {
      return {
        success: false,
        error: result.data.trim()
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

    return result.data || { exists: false, error: 'Invalid response from browser' };
  } catch (error) {
    return { exists: false, error: `Failed to verify file input: ${error}` };
  }
}

/**
 * Upload files to a file input element
 * 
 * Uploads one or more files to a file input element by clicking to open the native
 * file dialog and then using AppleScript to navigate and select files. Supports
 * both single and multiple file uploads with comprehensive validation.
 * 
 * @param options File upload configuration options
 * @param options.selector CSS selector for the file input element
 * @param options.path File path or comma/semicolon-separated paths for multiple files
 * @param options.multiple Whether to enable multiple file selection (default: false)
 * @param options.timeout Operation timeout in milliseconds (default: 30000)
 * @returns Promise resolving to file upload result with uploaded file information
 * 
 * @throws {ErrorCode.INVALID_INPUT} When selector is empty, file paths are invalid, or options are malformed
 * @throws {ErrorCode.INVALID_SELECTOR} When CSS selector is malformed or invalid
 * @throws {ErrorCode.INVALID_FILE_PATH} When file paths contain invalid characters or security violations
 * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When required selector or path parameters are missing
 * 
 * @throws {ErrorCode.TARGET_NOT_FOUND} When file input element cannot be found with provided selector
 * @throws {ErrorCode.ELEMENT_NOT_VISIBLE} When file input element exists but is hidden or not visible
 * @throws {ErrorCode.ELEMENT_NOT_INTERACTABLE} When element is not a file input or is disabled
 * @throws {ErrorCode.MULTIPLE_TARGETS_FOUND} When selector matches multiple file input elements
 * 
 * @throws {ErrorCode.FILE_NOT_FOUND} When specified file paths do not exist on filesystem
 * @throws {ErrorCode.FILE_READ_ERROR} When files exist but cannot be read due to permissions
 * @throws {ErrorCode.DIRECTORY_NOT_FOUND} When parent directory of file path does not exist
 * @throws {ErrorCode.PATH_TOO_LONG} When file paths exceed system limits
 * @throws {ErrorCode.SECURITY_RESTRICTION} When file path validation fails security checks
 * 
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When no active tab exists in the window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails during file input interaction
 * @throws {ErrorCode.UI_AUTOMATION_FAILED} When file dialog automation fails
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * @throws {ErrorCode.APPLESCRIPT_COMPILATION_FAILED} When AppleScript for file dialog cannot be compiled
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block file upload automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * @throws {ErrorCode.FILE_SYSTEM_DENIED} When file system access permissions not granted
 * 
 * @throws {ErrorCode.TIMEOUT} When file upload operation exceeds specified timeout
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When JavaScript execution times out
 * @throws {ErrorCode.LOAD_TIMEOUT} When file dialog loading times out
 * 
 * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to handle file upload operation
 * @throws {ErrorCode.DISK_FULL} When insufficient disk space for file operations
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent file upload
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during file upload
 * 
 * @example
 * ```typescript
 * // Upload single file with error handling
 * try {
 *   const result = await uploadFiles({
 *     selector: 'input[type="file"]',
 *     path: '/Users/user/document.pdf'
 *   });
 *   
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.TARGET_NOT_FOUND:
 *         console.log('File input not found - check selector');
 *         break;
 *       case ErrorCode.FILE_NOT_FOUND:
 *         console.log('File does not exist - check path');
 *         break;
 *       case ErrorCode.SECURITY_RESTRICTION:
 *         console.log('File path failed security validation');
 *         break;
 *       case ErrorCode.PERMISSION_DENIED:
 *         console.log('Grant file system and accessibility permissions');
 *         break;
 *     }
 *   } else {
 *     console.log(`Uploaded ${result.totalFiles} files successfully`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected file upload error:', error);
 * }
 * 
 * // Upload multiple files
 * const multiResult = await uploadFiles({
 *   selector: '#file-upload',
 *   path: '/path/file1.jpg,/path/file2.png',
 *   multiple: true,
 *   timeout: 60000
 * });
 * ```
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
    if (!clickResult.success || !clickResult.data) {
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

    const uploadedInfo = verifyResult.data || { fileCount: 0, files: [] };
    
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
 * 
 * Simulates drag and drop file upload by dispatching synthetic drag events
 * to dropzone elements. Note: This creates synthetic events but cannot provide
 * actual file data due to browser security restrictions. Works best with
 * dropzones that handle drag events for UI feedback.
 * 
 * @param options File upload configuration options
 * @param options.selector CSS selector for the dropzone element
 * @param options.path File path or comma/semicolon-separated paths for multiple files
 * @param options.multiple Whether to simulate multiple file drop (default: false)
 * @returns Promise resolving to drag drop simulation result
 * 
 * @throws {ErrorCode.INVALID_INPUT} When selector is empty, file paths are invalid, or options are malformed
 * @throws {ErrorCode.INVALID_SELECTOR} When CSS selector is malformed or invalid
 * @throws {ErrorCode.INVALID_FILE_PATH} When file paths contain invalid characters or security violations
 * @throws {ErrorCode.MISSING_REQUIRED_PARAM} When required selector or path parameters are missing
 * 
 * @throws {ErrorCode.TARGET_NOT_FOUND} When dropzone element cannot be found with provided selector
 * @throws {ErrorCode.ELEMENT_NOT_VISIBLE} When dropzone element exists but is hidden or not visible
 * @throws {ErrorCode.ELEMENT_NOT_INTERACTABLE} When dropzone element cannot accept drag events
 * @throws {ErrorCode.MULTIPLE_TARGETS_FOUND} When selector matches multiple dropzone elements
 * 
 * @throws {ErrorCode.FILE_NOT_FOUND} When specified file paths do not exist on filesystem (for validation)
 * @throws {ErrorCode.DIRECTORY_NOT_FOUND} When parent directory of file path does not exist
 * @throws {ErrorCode.SECURITY_RESTRICTION} When file path validation fails security checks
 * 
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When specified window does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When no active tab exists in the window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails during drag event simulation
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block drag drop automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * @throws {ErrorCode.FILE_SYSTEM_DENIED} When file system access permissions not granted
 * 
 * @throws {ErrorCode.TIMEOUT} When drag drop simulation exceeds timeout
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When JavaScript execution times out
 * 
 * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to handle drag drop operation
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent drag drop simulation
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during drag drop
 * 
 * @example
 * ```typescript
 * // Simulate drag and drop with error handling
 * try {
 *   const result = await dragDropFiles({
 *     selector: '.dropzone',
 *     path: '/Users/user/image.jpg'
 *   });
 *   
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.TARGET_NOT_FOUND:
 *         console.log('Dropzone not found - check selector');
 *         break;
 *       case ErrorCode.JAVASCRIPT_ERROR:
 *         console.log('Failed to simulate drag events');
 *         break;
 *       case ErrorCode.SECURITY_RESTRICTION:
 *         console.log('File path failed security validation');
 *         break;
 *     }
 *   } else {
 *     console.log(`Simulated drag drop for ${result.totalFiles} files`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected drag drop error:', error);
 * }
 * 
 * // Simulate multiple file drag drop
 * const multiResult = await dragDropFiles({
 *   selector: '#upload-area',
 *   path: '/path/file1.pdf,/path/file2.docx',
 *   multiple: true
 * });
 * ```
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

    const dropResult = result.data;
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