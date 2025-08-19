/**
 * @fileoverview DOM evaluation functionality for executing JavaScript in browser context
 * 
 * This module provides secure JavaScript execution capabilities within Chrome tabs,
 * with security validation, result serialization, and comprehensive error handling.
 * 
 * @example
 * ```typescript
 * // Execute simple DOM query
 * const result = await domEval({ 
 *   js: 'document.title' 
 * });
 * 
 * // Execute with custom timeout and tab targeting
 * const complexResult = await domEval({
 *   js: 'document.querySelectorAll("button").length',
 *   tabIndex: 2,
 *   timeout: 15000
 * });
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { execChromeJS, type JavaScriptResult } from '../lib/apple.js';
import { ERROR_CODES, validateInput, formatJSONResult, type JSONResult } from '../lib/util.js';
import { error } from '../core/Result.js';

/**
 * Configuration options for DOM JavaScript evaluation.
 * 
 * @interface DOMEvalOptions
 * @example
 * ```typescript
 * const options: DOMEvalOptions = {
 *   js: 'document.querySelector("#button").textContent',
 *   tabIndex: 1,
 *   windowIndex: 1,
 *   timeout: 10000
 * };
 * ```
 */
export interface DOMEvalOptions {
  /** JavaScript code to execute in the browser context */
  js: string;
  /** Target tab index (1-based, default: 1) */
  tabIndex?: number;
  /** Target window index (1-based, default: 1) */
  windowIndex?: number;
  /** Execution timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Metadata about the JavaScript execution operation.
 * Provides timing, size, and serialization information.
 * 
 * @interface DOMEvalMeta
 * @example
 * ```typescript
 * const meta: DOMEvalMeta = {
 *   executionTimeMs: 150,
 *   timestamp: '2023-06-15T10:30:00.000Z',
 *   resultSize: 1024,
 *   truncated: false
 * };
 * ```
 */
export interface DOMEvalMeta {
  /** How long the JavaScript execution took in milliseconds */
  executionTimeMs: number;
  /** ISO timestamp of when the execution completed */
  timestamp: string;
  /** Size of the result data in bytes */
  resultSize: number;
  /** Whether the result was truncated due to size limits */
  truncated: boolean;
  /** Warning message about serialization issues, if any */
  serializationWarning?: string;
}

/**
 * Result data structure for DOM JavaScript evaluation.
 * Contains the execution result, error information, and metadata.
 * 
 * @interface DOMEvalData
 * @example
 * ```typescript
 * const data: DOMEvalData = {
 *   success: true,
 *   result: 'Page Title',
 *   meta: {
 *     executionTimeMs: 50,
 *     timestamp: '2023-06-15T10:30:00.000Z',
 *     resultSize: 256,
 *     truncated: false
 *   }
 * };
 * ```
 */
export interface DOMEvalData {
  /** Whether the JavaScript execution succeeded */
  success: boolean;
  /** The result value from the JavaScript execution (if successful) */
  result?: unknown;
  /** Error message (if execution failed) */
  error?: string | undefined;
  /** Metadata about the execution operation */
  meta: DOMEvalMeta;
}

/**
 * Regular expression patterns for detecting dangerous JavaScript code.
 * These patterns are used to prevent execution of potentially harmful code
 * that could compromise security or access system resources.
 * 
 * @constant {RegExp[]} DANGEROUS_PATTERNS
 * @private
 * @example
 * Blocked patterns include:
 * - eval() calls
 * - Function constructor
 * - Timer functions (setTimeout, setInterval)
 * - Property deletion
 * - Prototype manipulation
 * - Node.js specific APIs
 */
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bsetTimeout\s*\(/,
  /\bsetInterval\s*\(/,
  /\bdelete\s+/,
  /__proto__/,
  /\bconstructor\s*\(/,
  /\bprocess\b/,
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bexport\s+/,
];

/**
 * Executes arbitrary JavaScript code in the browser page context with security validation.
 * 
 * This function provides a secure way to execute JavaScript in Chrome tabs by:
 * - Validating input for dangerous patterns
 * - Setting appropriate timeouts
 * - Capturing execution metadata
 * - Handling serialization of complex results
 * 
 * @param options - Configuration for the JavaScript execution
 * @returns Promise resolving to execution result with metadata
 * 
 * @throws {Error} When dangerous JavaScript patterns are detected
 * @throws {Error} When input validation fails
 * 
 * @example
 * ```typescript
 * // Simple DOM query
 * const titleResult = await domEval({ 
 *   js: 'document.title' 
 * });
 * 
 * // Complex evaluation with timeout
 * const formResult = await domEval({
 *   js: `
 *     const forms = Array.from(document.forms);
 *     return forms.map(form => ({
 *       id: form.id,
 *       action: form.action,
 *       method: form.method
 *     }));
 *   `,
 *   timeout: 15000
 * });
 * 
 * // Target specific tab
 * const tabResult = await domEval({
 *   js: 'window.location.href',
 *   tabIndex: 2
 * });
 * ```
 * 
 * @security This function blocks dangerous JavaScript patterns but should still
 * be used with caution. Only execute trusted JavaScript code.
 */
export async function domEval(options: DOMEvalOptions): Promise<JavaScriptResult<DOMEvalData>> {
  const { js, tabIndex = 1, windowIndex = 1, timeout = 10000 } = options;

  // Validate input
  if (!validateInput(js, 'string') || js.trim().length === 0) {
    return error(
      'JavaScript code is required and cannot be empty',
      ERROR_CODES.INVALID_INPUT
    );
  }

  // Security validation - check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(js)) {
      return error(
        'JavaScript contains dangerous patterns and cannot be executed',
        ERROR_CODES.INVALID_INPUT
      );
    }
  }

  // Wrap the user's JavaScript with error handling and timing
  const wrappedJS = `
(() => {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  let result, error, success = true;
  
  try {
    // Execute user's JavaScript in a controlled context
    result = (function() {
      ${js}
    })();
  } catch (e) {
    error = e.message;
    success = false;
    result = null;
  }
  
  const executionTimeMs = Math.round(performance.now() - startTime);
  
  // Serialize result to check size
  let serialized = '';
  try {
    serialized = JSON.stringify(result);
  } catch (e) {
    // Handle circular references
    serialized = JSON.stringify({
      __serialization_error: true,
      type: typeof result,
      string_representation: String(result)
    });
  }
  
  const resultSize = serialized.length;
  const truncated = resultSize > 1048576; // 1MB limit
  
  return {
    success,
    result: success ? result : undefined,
    error: success ? undefined : error,
    executionTimeMs,
    timestamp,
    resultSize,
    truncated
  };
})();
`;

  try {
    const jsResult = await execChromeJS(wrappedJS, tabIndex, windowIndex, timeout);
    
    if (!jsResult.success) {
      return error(
        jsResult.error || 'Chrome JavaScript execution failed',
        jsResult.code
      );
    }

    const evalResult = jsResult.data as {
      success: boolean;
      result?: unknown;
      error?: string;
      executionTimeMs: number;
      timestamp: string;
      resultSize: number;
      truncated: boolean;
    };

    return {
      success: true,
      data: {
        success: evalResult.success,
        result: evalResult.result,
        error: evalResult.error || undefined,
        meta: {
          executionTimeMs: evalResult.executionTimeMs,
          timestamp: evalResult.timestamp,
          resultSize: evalResult.resultSize,
          truncated: evalResult.truncated
        }
      },
      code: ERROR_CODES.OK,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    return error(
      `DOM evaluation failed: ${err}`,
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
}

/**
 * Format DOM evaluation result for consistent output
 */
export function formatDomEvalResult(jsResult: JavaScriptResult<DOMEvalData>): JSONResult<DOMEvalData | null> {
  if (!jsResult.success) {
    return formatJSONResult(null, jsResult.error, jsResult.code);
  }

  if (!jsResult.data) {
    return formatJSONResult(null, 'No evaluation result returned', ERROR_CODES.UNKNOWN_ERROR);
  }

  return formatJSONResult(jsResult.data, undefined, jsResult.code);
}