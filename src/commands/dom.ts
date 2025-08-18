import { execChromeJS, type JavaScriptResult } from '../lib/apple.js';
import { ERROR_CODES, validateInput, formatJSONResult, type JSONResult } from '../lib/util.js';

export interface DOMEvalOptions {
  js: string;
  tabIndex?: number;
  windowIndex?: number;
  timeout?: number;
}

export interface DOMEvalMeta {
  executionTimeMs: number;
  timestamp: string;
  resultSize: number;
  truncated: boolean;
  serializationWarning?: string;
}

export interface DOMEvalData {
  success: boolean;
  result?: unknown;
  error?: string | undefined;
  meta: DOMEvalMeta;
}

/**
 * Dangerous JavaScript patterns that should be blocked for security
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
 * Execute arbitrary JavaScript in the page context with security validation
 */
export async function domEval(options: DOMEvalOptions): Promise<JavaScriptResult<DOMEvalData>> {
  const { js, tabIndex = 1, windowIndex = 1, timeout = 10000 } = options;

  // Validate input
  if (!validateInput(js, 'string') || js.trim().length === 0) {
    return {
      success: false,
      error: 'JavaScript code is required and cannot be empty',
      code: ERROR_CODES.INVALID_INPUT
    };
  }

  // Security validation - check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(js)) {
      return {
        success: false,
        error: 'JavaScript contains dangerous patterns and cannot be executed',
        code: ERROR_CODES.INVALID_INPUT
      };
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
      return {
        success: false,
        error: jsResult.error || 'Chrome JavaScript execution failed',
        code: jsResult.code
      };
    }

    const evalResult = jsResult.result as {
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
      result: {
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
      code: ERROR_CODES.OK
    };

  } catch (error) {
    return {
      success: false,
      error: `DOM evaluation failed: ${error}`,
      code: ERROR_CODES.UNKNOWN_ERROR
    };
  }
}

/**
 * Format DOM evaluation result for consistent output
 */
export function formatDomEvalResult(jsResult: JavaScriptResult<DOMEvalData>): JSONResult<DOMEvalData | null> {
  if (!jsResult.success) {
    return formatJSONResult(null, jsResult.error, jsResult.code);
  }

  if (!jsResult.result) {
    return formatJSONResult(null, 'No evaluation result returned', ERROR_CODES.UNKNOWN_ERROR);
  }

  return formatJSONResult(jsResult.result, undefined, jsResult.code);
}