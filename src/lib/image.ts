/**
 * @fileoverview Image processing utilities for mac-chrome-cli
 * 
 * This module provides image processing functionality using Sharp for
 * screenshot optimization, format conversion, and preview generation.
 * 
 * @example
 * ```typescript
 * import { createWebPPreview } from './image.js';
 * 
 * const preview = await createWebPPreview('./screenshot.png', 1024 * 1024);
 * console.log(`Preview size: ${preview.size} bytes`);
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

// Re-export image utilities from util.ts for better organization
export { createWebPPreview } from './util.js';

/**
 * Image processing result containing buffer, base64, and size information
 */
export interface ImageProcessingResult {
  /** Processed image buffer */
  buffer: Buffer;
  /** Base64 encoded image data */
  base64: string;
  /** Size of processed image in bytes */
  size: number;
}

/**
 * Image processing options for optimization and conversion
 */
export interface ImageProcessingOptions {
  /** Maximum width for resizing (maintains aspect ratio) */
  maxWidth?: number;
  /** Maximum file size in bytes */
  maxSizeBytes?: number;
  /** Image quality (1-100, applies to lossy formats) */
  quality?: number;
  /** Output format */
  format?: 'webp' | 'jpeg' | 'png';
}