/**
 * @fileoverview Page snapshot functionality for capturing interactive elements and DOM structure
 * 
 * This module provides comprehensive page snapshotting capabilities to capture
 * interactive elements, accessibility information, and DOM structure. It supports
 * two modes: outline (flat list of interactive elements) and dom-lite (pruned hierarchy).
 * 
 * @example
 * ```typescript
 * // Capture interactive elements only
 * const outlineResult = await captureOutline({ visibleOnly: true });
 * 
 * // Capture DOM structure with hierarchy
 * const domLiteResult = await captureDomLite({ maxDepth: 5, visibleOnly: true });
 * ```
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import { execChromeJS, type JavaScriptResult } from '../lib/apple.js';
import { ErrorCode } from '../core/index.js';

/**
 * Represents the bounding rectangle of a DOM element.
 * Coordinates are relative to the viewport.
 * 
 * @interface ElementRect
 * @example
 * ```typescript
 * const rect: ElementRect = {
 *   x: 100,      // Left edge position
 *   y: 50,       // Top edge position  
 *   w: 200,      // Width in pixels
 *   h: 30        // Height in pixels
 * };
 * ```
 */
export interface ElementRect {
  /** X coordinate of the element's left edge relative to viewport */
  x: number;
  /** Y coordinate of the element's top edge relative to viewport */
  y: number;
  /** Width of the element in pixels */
  w: number;
  /** Height of the element in pixels */
  h: number;
}

/**
 * Represents the current state and properties of a DOM element.
 * Used to capture form states, interaction states, and accessibility properties.
 * 
 * @interface ElementState
 * @example
 * ```typescript
 * const buttonState: ElementState = {
 *   editable: false,
 *   disabled: false,
 *   focused: true,
 *   checked: undefined  // Not applicable for buttons
 * };
 * ```
 */
export interface ElementState {
  /** Whether the element can be edited (inputs, contentEditable) */
  editable?: boolean;
  /** Whether the element is disabled */
  disabled?: boolean;
  /** Current value for form elements (passwords are masked) */
  value?: string;
  /** Whether checkboxes/radio buttons are checked */
  checked?: boolean;
  /** Whether expandable elements are expanded (aria-expanded) */
  expanded?: boolean;
  /** Whether option elements are selected */
  selected?: boolean;
  /** Whether the element is hidden via CSS */
  hidden?: boolean;
  /** Whether the element currently has focus */
  focused?: boolean;
}

/**
 * Represents a single DOM element captured in a page snapshot.
 * Contains accessibility information, selectors, positioning, and metadata.
 * 
 * @interface SnapshotNode
 * @example
 * ```typescript
 * const node: SnapshotNode = {
 *   role: 'button',
 *   name: 'Submit Form',
 *   selector: '#submit-btn',
 *   rect: { x: 100, y: 200, w: 80, h: 32 },
 *   state: { editable: false, disabled: false },
 *   tagName: 'button',
 *   type: 'submit'
 * };
 * ```
 */
export interface SnapshotNode {
  /** ARIA role (explicit or computed implicit role) */
  role: string;
  /** Accessible name derived from labels, aria-label, text content, etc. */
  name: string;
  /** Unique CSS selector to target this element */
  selector: string;
  /** Element's bounding rectangle in viewport coordinates */
  rect: ElementRect;
  /** Current state and properties of the element */
  state: ElementState;
  /** HTML tag name in lowercase */
  tagName?: string;
  /** Element's id attribute */
  id?: string;
  /** Element's class attribute value */
  className?: string;
  /** href attribute for links */
  href?: string;
  /** src attribute for images and media */
  src?: string;
  /** alt attribute for images */
  alt?: string;
  /** title attribute for tooltips */
  title?: string;
  /** type attribute for inputs */
  type?: string;
  /** placeholder attribute for inputs */
  placeholder?: string;
  /** Explicit aria-label attribute */
  ariaLabel?: string;
  /** Explicit role attribute */
  ariaRole?: string;
  /** Hierarchy level (used in DOM-lite mode) */
  level?: number;
  /** Parent element selector (used in DOM-lite mode) */
  parent?: string;
}

/**
 * Result structure returned from page snapshot operations.
 * Contains the captured elements and metadata about the operation.
 * 
 * @interface SnapshotResult
 * @example
 * ```typescript
 * const result: SnapshotResult = {
 *   ok: true,
 *   cmd: 'snapshot.outline',
 *   nodes: [],
 *   meta: {
 *     url: 'https://example.com',
 *     title: 'Example Page',
 *     timestamp: '2023-06-15T10:30:00.000Z',
 *     durationMs: 150,
 *     visibleOnly: true
 *   }
 * };
 * ```
 */
export interface SnapshotResult {
  /** Whether the snapshot operation succeeded */
  ok: boolean;
  /** Command identifier that generated this result */
  cmd: string;
  /** Array of captured DOM elements */
  nodes: SnapshotNode[];
  /** Optional metadata about the snapshot operation */
  meta?: {
    /** URL of the page when snapshot was taken */
    url: string;
    /** Page title when snapshot was taken */
    title: string;
    /** ISO timestamp of when snapshot was captured */
    timestamp: string;
    /** How long the snapshot operation took in milliseconds */
    durationMs: number;
    /** Whether only visible elements were captured */
    visibleOnly: boolean;
    /** Maximum depth for DOM-lite mode */
    maxDepth?: number;
  };
}

/**
 * Configuration options for snapshot operations.
 * Controls what elements are captured and how the snapshot is structured.
 * 
 * @interface SnapshotOptions
 * @example
 * ```typescript
 * // Capture only visible interactive elements
 * const outlineOptions: SnapshotOptions = {
 *   mode: 'outline',
 *   visibleOnly: true
 * };
 * 
 * // Capture DOM hierarchy with depth limit  
 * const domLiteOptions: SnapshotOptions = {
 *   mode: 'dom-lite',
 *   maxDepth: 8,
 *   visibleOnly: false
 * };
 * ```
 */
export interface SnapshotOptions {
  /** Whether to only capture visible elements */
  visibleOnly?: boolean;
  /** Maximum depth for DOM-lite hierarchy traversal */
  maxDepth?: number;
  /** Snapshot mode: 'outline' for flat list, 'dom-lite' for hierarchy */
  mode: 'outline' | 'dom-lite';
}

/**
 * JavaScript code that generates unique CSS selectors for DOM elements.
 * Uses a priority system: id > data-testid > data-test > unique class > path-based selector.
 * This ensures the most reliable and maintainable selectors are chosen first.
 * 
 * @constant {string} getSelectorScript
 * @private
 */
const getSelectorScript = `
function getUniqueSelector(element) {
  // Try ID first
  if (element.id) {
    const idSelector = '#' + CSS.escape(element.id);
    if (document.querySelectorAll(idSelector).length === 1) {
      return idSelector;
    }
  }
  
  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    const testIdSelector = '[data-testid="' + CSS.escape(testId) + '"]';
    if (document.querySelectorAll(testIdSelector).length === 1) {
      return testIdSelector;
    }
  }
  
  // Try data-test
  const dataTest = element.getAttribute('data-test');
  if (dataTest) {
    const dataTestSelector = '[data-test="' + CSS.escape(dataTest) + '"]';
    if (document.querySelectorAll(dataTestSelector).length === 1) {
      return dataTestSelector;
    }
  }
  
  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\\s+/).filter(Boolean);
    if (classes.length > 0) {
      const classSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }
  
  // Fall back to path-based selector
  const path = [];
  let current = element;
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += '#' + CSS.escape(current.id);
      path.unshift(selector);
      break;
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => 
        child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += ':nth-child(' + index + ')';
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}
`;

/**
 * JavaScript code that determines if a DOM element is visible in the viewport.
 * Checks for CSS visibility, display properties, opacity, and viewport intersection.
 * Used to filter elements when visibleOnly option is enabled.
 * 
 * @constant {string} isVisibleScript
 * @private
 */
const isVisibleScript = `
function isElementVisible(element) {
  if (!element || !element.offsetParent) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && 
         rect.top < window.innerHeight && rect.bottom > 0 &&
         rect.left < window.innerWidth && rect.right > 0;
}
`;

/**
 * JavaScript code that extracts ARIA role and accessible name information from DOM elements.
 * Implements the accessibility name computation algorithm following WCAG guidelines.
 * Maps implicit roles for standard HTML elements and resolves accessible names from
 * labels, aria-label, text content, and other sources in priority order.
 * 
 * @constant {string} getAccessibilityInfoScript
 * @private
 */
const getAccessibilityInfoScript = `
function getAccessibilityInfo(element) {
  // Get role (explicit or implicit)
  let role = element.getAttribute('role');
  if (!role) {
    // Map common tag names to implicit roles
    const tagRoleMap = {
      'button': 'button',
      'input': element.type === 'button' || element.type === 'submit' || element.type === 'reset' ? 'button' : 'textbox',
      'textarea': 'textbox',
      'select': 'combobox',
      'a': element.href ? 'link' : 'generic',
      'img': 'img',
      'h1': 'heading', 'h2': 'heading', 'h3': 'heading', 'h4': 'heading', 'h5': 'heading', 'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'article': 'article',
      'section': 'region',
      'aside': 'complementary',
      'header': 'banner',
      'footer': 'contentinfo',
      'form': 'form',
      'table': 'table',
      'td': 'cell',
      'th': 'columnheader',
      'tr': 'row',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
      'dl': 'list',
      'dt': 'term',
      'dd': 'definition'
    };
    role = tagRoleMap[element.tagName.toLowerCase()] || 'generic';
    
    // Special cases for input types
    if (element.tagName.toLowerCase() === 'input') {
      const inputRoleMap = {
        'checkbox': 'checkbox',
        'radio': 'radio',
        'range': 'slider',
        'search': 'searchbox',
        'email': 'textbox',
        'tel': 'textbox',
        'url': 'textbox',
        'password': 'textbox',
        'number': 'spinbutton',
        'date': 'textbox',
        'time': 'textbox',
        'datetime-local': 'textbox',
        'month': 'textbox',
        'week': 'textbox',
        'color': 'textbox',
        'file': 'button'
      };
      role = inputRoleMap[element.type] || 'textbox';
    }
  }
  
  // Get accessible name using aria-label, aria-labelledby, label, title, placeholder, or text content
  let name = '';
  
  // 1. aria-label
  name = element.getAttribute('aria-label');
  if (name) return { role, name: name.trim() };
  
  // 2. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      name = labelElement.textContent || labelElement.innerText || '';
      if (name.trim()) return { role, name: name.trim() };
    }
  }
  
  // 3. Associated label (for form controls)
  if (element.id) {
    const label = document.querySelector('label[for="' + CSS.escape(element.id) + '"]');
    if (label) {
      name = label.textContent || label.innerText || '';
      if (name.trim()) return { role, name: name.trim() };
    }
  }
  
  // 4. Parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    name = parentLabel.textContent || parentLabel.innerText || '';
    if (name.trim()) return { role, name: name.trim() };
  }
  
  // 5. Title attribute
  name = element.getAttribute('title');
  if (name && name.trim()) return { role, name: name.trim() };
  
  // 6. Placeholder (for inputs)
  name = element.getAttribute('placeholder');
  if (name && name.trim()) return { role, name: name.trim() };
  
  // 7. Alt text (for images)
  name = element.getAttribute('alt');
  if (name && name.trim()) return { role, name: name.trim() };
  
  // 8. Value (for buttons and inputs)
  if (element.value && typeof element.value === 'string' && element.value.trim()) {
    return { role, name: element.value.trim() };
  }
  
  // 9. Text content (but truncate for long content)
  name = element.textContent || element.innerText || '';
  name = name.trim().replace(/\\s+/g, ' ');
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }
  
  return { role, name: name || element.tagName.toLowerCase() };
}
`;

/**
 * JavaScript code that captures the current state of DOM elements.
 * Extracts form values, interaction states, accessibility properties,
 * and visual states. Masks sensitive information like passwords.
 * 
 * @constant {string} getElementStateScript
 * @private
 */
const getElementStateScript = `
function getElementState(element) {
  const state = {};
  
  // Check if editable
  if (element.isContentEditable || 
      (element.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName.toUpperCase()))) {
    state.editable = true;
  }
  
  // Check if disabled
  if (element.disabled !== undefined) {
    state.disabled = element.disabled;
  }
  
  // Get value for form elements
  if (element.value !== undefined && typeof element.value === 'string') {
    // Mask passwords
    if (element.type === 'password') {
      state.value = element.value ? '***' : '';
    } else {
      state.value = element.value;
    }
  }
  
  // Check if checked (checkboxes, radio buttons)
  if (element.checked !== undefined) {
    state.checked = element.checked;
  }
  
  // Check if selected (option elements)
  if (element.selected !== undefined) {
    state.selected = element.selected;
  }
  
  // Check if expanded (for expandable elements)
  const ariaExpanded = element.getAttribute('aria-expanded');
  if (ariaExpanded !== null) {
    state.expanded = ariaExpanded === 'true';
  }
  
  // Check if hidden
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    state.hidden = true;
  }
  
  // Check if focused
  state.focused = document.activeElement === element;
  
  return state;
}
`;

/**
 * Generates JavaScript code for capturing page snapshots in the browser.
 * Creates a self-executing function that captures interactive elements based on the specified mode.
 * 
 * @param options - Configuration options for the snapshot operation
 * @returns JavaScript code as a string that can be executed in Chrome
 * 
 * @example
 * ```typescript
 * const script = generateSnapshotScript({
 *   mode: 'outline',
 *   visibleOnly: true
 * });
 * const result = await execChromeJS(script);
 * ```
 */
function generateSnapshotScript(options: SnapshotOptions): string {
  return `
${getSelectorScript}
${isVisibleScript}
${getAccessibilityInfoScript}
${getElementStateScript}

(function() {
  try {
    const startTime = Date.now();
    const nodes = [];
    const { visibleOnly = false, maxDepth = 10, mode = 'outline' } = ${JSON.stringify(options)};
    
    // Define interactive element selectors
    const interactiveSelectors = [
      'button',
      'input',
      'textarea',
      'select',
      'a[href]',
      '[role="button"]',
      '[role="link"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="menuitemradio"]',
      '[role="option"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[role="slider"]',
      '[role="spinbutton"]',
      '[role="tab"]',
      '[role="treeitem"]',
      '[onclick]',
      '[onmousedown]',
      '[onmouseup]',
      '[onchange]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    
    if (mode === 'outline') {
      // Outline mode: flat list of interactive elements
      const elements = document.querySelectorAll(interactiveSelectors);
      
      for (const element of elements) {
        // Skip if visibility filtering is enabled and element is not visible
        if (visibleOnly && !isElementVisible(element)) continue;
        
        try {
          const rect = element.getBoundingClientRect();
          const { role, name } = getAccessibilityInfo(element);
          const state = getElementState(element);
          const selector = getUniqueSelector(element);
          
          const node = {
            role,
            name,
            selector,
            rect: {
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              w: Math.round(rect.width),
              h: Math.round(rect.height)
            },
            state,
            tagName: element.tagName.toLowerCase()
          };
          
          // Add optional properties
          if (element.id) node.id = element.id;
          if (element.className && typeof element.className === 'string') {
            node.className = element.className;
          }
          if (element.href) node.href = element.href;
          if (element.src) node.src = element.src;
          if (element.alt) node.alt = element.alt;
          if (element.title) node.title = element.title;
          if (element.type) node.type = element.type;
          if (element.placeholder) node.placeholder = element.placeholder;
          if (element.getAttribute('aria-label')) {
            node.ariaLabel = element.getAttribute('aria-label');
          }
          if (element.getAttribute('role')) {
            node.ariaRole = element.getAttribute('role');
          }
          
          nodes.push(node);
        } catch (nodeError) {
          // Skip problematic elements
          continue;
        }
      }
    } else if (mode === 'dom-lite') {
      // DOM-lite mode: pruned hierarchy
      function traverseElement(element, level = 0, parentSelector = '') {
        if (level > maxDepth) return;
        
        // Skip if visibility filtering is enabled and element is not visible
        if (visibleOnly && !isElementVisible(element)) return;
        
        try {
          const isInteractive = element.matches && element.matches(interactiveSelectors);
          const hasInteractiveChildren = element.querySelector && element.querySelector(interactiveSelectors);
          
          // Include if interactive or has interactive descendants
          if (isInteractive || hasInteractiveChildren || level === 0) {
            const rect = element.getBoundingClientRect();
            const { role, name } = getAccessibilityInfo(element);
            const state = getElementState(element);
            const selector = getUniqueSelector(element);
            
            const node = {
              role,
              name,
              selector,
              rect: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
              },
              state,
              tagName: element.tagName.toLowerCase(),
              level
            };
            
            if (parentSelector) {
              node.parent = parentSelector;
            }
            
            // Add optional properties for interactive elements
            if (isInteractive) {
              if (element.id) node.id = element.id;
              if (element.className && typeof element.className === 'string') {
                node.className = element.className;
              }
              if (element.href) node.href = element.href;
              if (element.src) node.src = element.src;
              if (element.alt) node.alt = element.alt;
              if (element.title) node.title = element.title;
              if (element.type) node.type = element.type;
              if (element.placeholder) node.placeholder = element.placeholder;
              if (element.getAttribute('aria-label')) {
                node.ariaLabel = element.getAttribute('aria-label');
              }
              if (element.getAttribute('role')) {
                node.ariaRole = element.getAttribute('role');
              }
            }
            
            nodes.push(node);
            
            // Traverse children
            for (const child of element.children) {
              traverseElement(child, level + 1, selector);
            }
          }
        } catch (nodeError) {
          // Skip problematic elements
          return;
        }
      }
      
      traverseElement(document.body);
    }
    
    const endTime = Date.now();
    
    return {
      ok: true,
      cmd: 'snapshot.' + mode,
      nodes,
      meta: {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        durationMs: endTime - startTime,
        visibleOnly,
        maxDepth: mode === 'dom-lite' ? maxDepth : undefined
      }
    };
  } catch (error) {
    return {
      ok: false,
      cmd: 'snapshot.' + mode,
      nodes: [],
      error: error.message || 'Unknown error during snapshot'
    };
  }
})();
`;
}

/**
 * Captures a page snapshot in outline mode, returning a flat list of interactive elements.
 * This mode focuses on elements that users can interact with (buttons, links, inputs, etc.)
 * without preserving the DOM hierarchy.
 * 
 * @param options - Configuration options for the outline capture
 * @param options.visibleOnly - If true, only capture elements visible in the viewport
 * @returns Promise resolving to a JavaScriptResult containing the snapshot data
 * 
 * @example
 * ```typescript
 * // Capture all interactive elements
 * const result = await captureOutline();
 * 
 * // Capture only visible elements
 * const visibleResult = await captureOutline({ visibleOnly: true });
 * ```
 */
export async function captureOutline(options: { visibleOnly?: boolean } = {}): Promise<JavaScriptResult<SnapshotResult>> {
  const snapshotOptions: SnapshotOptions = {
    mode: 'outline',
    visibleOnly: options.visibleOnly || false
  };
  
  const script = generateSnapshotScript(snapshotOptions);
  return execChromeJS<SnapshotResult>(script, 1, 1, 15000); // 15 second timeout
}

/**
 * Captures a page snapshot in DOM-lite mode, preserving a pruned hierarchy of elements.
 * This mode maintains parent-child relationships while filtering out non-interactive elements,
 * providing context about the page structure while keeping the data manageable.
 * 
 * @param options - Configuration options for the DOM-lite capture
 * @param options.maxDepth - Maximum depth to traverse in the DOM tree (default: 10)
 * @param options.visibleOnly - If true, only capture elements visible in the viewport
 * @returns Promise resolving to a JavaScriptResult containing the hierarchical snapshot data
 * 
 * @example
 * ```typescript
 * // Capture with default settings
 * const result = await captureDomLite();
 * 
 * // Capture with limited depth and visible elements only
 * const limitedResult = await captureDomLite({ 
 *   maxDepth: 5, 
 *   visibleOnly: true 
 * });
 * ```
 */
export async function captureDomLite(options: { maxDepth?: number; visibleOnly?: boolean } = {}): Promise<JavaScriptResult<SnapshotResult>> {
  const snapshotOptions: SnapshotOptions = {
    mode: 'dom-lite',
    maxDepth: options.maxDepth || 10,
    visibleOnly: options.visibleOnly || false
  };
  
  const script = generateSnapshotScript(snapshotOptions);
  return execChromeJS<SnapshotResult>(script, 1, 1, 20000); // 20 second timeout for more complex traversal
}



/**
 * Formats a JavaScript execution result into a standardized snapshot result format.
 * Handles both successful snapshots and error cases, providing consistent output
 * structure for CLI consumers.
 * 
 * @param result - The raw JavaScript execution result from Chrome
 * @returns Formatted snapshot result or error object with consistent structure
 * 
 * @example
 * ```typescript
 * const jsResult = await execChromeJS(script);
 * const formatted = formatSnapshotResult(jsResult);
 * 
 * if ('success' in formatted && !formatted.success) {
 *   console.error('Snapshot failed:', formatted.error);
 * } else if ('ok' in formatted && formatted.ok) {
 *   console.log(`Captured ${formatted.nodes.length} elements`);
 * }
 * ```
 */
export function formatSnapshotResult(result: JavaScriptResult<SnapshotResult>): SnapshotResult | { success: false; error: string; code: ErrorCode; timestamp: string } {
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to capture page snapshot',
      code: result.code as ErrorCode,
      timestamp: new Date().toISOString()
    };
  }
  
  if (!result.data) {
    return {
      success: false,
      error: 'No snapshot data returned',
      code: ErrorCode.UNKNOWN_ERROR,
      timestamp: new Date().toISOString()
    };
  }
  
  // Return the original SnapshotResult object for successful cases
  return result.data;
}