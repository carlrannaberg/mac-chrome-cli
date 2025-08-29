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
import { appleScriptService } from '../services/AppleScriptService.js';
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
    /** Performance metrics for optimization monitoring */
    performance?: {
      /** Algorithm complexity description */
      algorithm: string;
      /** Total number of DOM nodes processed */
      nodeCount: number;
      /** Time spent in DOM traversal phase (ms) */
      traversalMs?: number;
      /** Time spent in element processing phase (ms) */
      processingMs: number;
      /** Peak memory usage during operation (MB) */
      memoryPeakMB: number;
      /** List of optimization techniques used */
      algorithmsUsed?: string[];
    };
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
 * OPTIMIZED VERSION: Uses pre-computed caches to avoid O(n²) querySelectorAll operations.
 * Achieves O(n) complexity by building selector uniqueness maps upfront.
 * 
 * @constant {string} getSelectorScript
 * @private
 */
const getSelectorScript = `
// Performance optimization: Pre-compute selector uniqueness maps
let selectorCaches = null;

function buildSelectorCaches() {
  if (selectorCaches) return selectorCaches;
  
  const idMap = new Map();
  const testIdMap = new Map();
  const dataTestMap = new Map();
  const classMap = new Map();
  
  // Single DOM traversal to build all caches - O(n)
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    const element = node;
    
    // Cache ID selectors
    if (element.id) {
      const id = element.id;
      idMap.set(id, (idMap.get(id) || 0) + 1);
    }
    
    // Cache test ID selectors
    const testId = element.getAttribute('data-testid');
    if (testId) {
      testIdMap.set(testId, (testIdMap.get(testId) || 0) + 1);
    }
    
    // Cache data-test selectors
    const dataTest = element.getAttribute('data-test');
    if (dataTest) {
      dataTestMap.set(dataTest, (dataTestMap.get(dataTest) || 0) + 1);
    }
    
    // Cache class combinations
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\\s+/).filter(Boolean);
      if (classes.length > 0) {
        const classKey = classes.sort().join('.');
        classMap.set(classKey, (classMap.get(classKey) || 0) + 1);
      }
    }
  }
  
  selectorCaches = { idMap, testIdMap, dataTestMap, classMap };
  return selectorCaches;
}

function getUniqueSelector(element) {
  const caches = buildSelectorCaches();
  
  // Try ID first - O(1) lookup
  if (element.id && caches.idMap.get(element.id) === 1) {
    return '#' + CSS.escape(element.id);
  }
  
  // Try data-testid - O(1) lookup
  const testId = element.getAttribute('data-testid');
  if (testId && caches.testIdMap.get(testId) === 1) {
    return '[data-testid="' + CSS.escape(testId) + '"]';
  }
  
  // Try data-test - O(1) lookup
  const dataTest = element.getAttribute('data-test');
  if (dataTest && caches.dataTestMap.get(dataTest) === 1) {
    return '[data-test="' + CSS.escape(dataTest) + '"]';
  }
  
  // Try unique class combination - O(1) lookup
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\\s+/).filter(Boolean);
    if (classes.length > 0) {
      const classKey = classes.sort().join('.');
      if (caches.classMap.get(classKey) === 1) {
        return '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }
  }
  
  // Fall back to optimized path-based selector
  const path = [];
  let current = element;
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id && caches.idMap.get(current.id) === 1) {
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
    
    // Add nth-child only when necessary
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(child => child.tagName === current.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
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
 * OPTIMIZED VERSION: Uses O(n) algorithms with pre-computed caches and iterative traversal.
 * Includes performance monitoring and memory management for large DOM trees.
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
    const performanceMetrics = {
      nodeCount: 0,
      memoryPeak: 0,
      traversalTime: 0,
      processingTime: 0
    };
    
    const nodes = [];
    const { visibleOnly = false, maxDepth = 10, mode = 'outline' } = ${JSON.stringify(options)};
    
    // Performance: Pre-compile interactive element checks
    const interactiveTagNames = new Set(['button', 'input', 'textarea', 'select', 'a']);
    const interactiveRoles = new Set([
      'button', 'link', 'textbox', 'combobox', 'listbox', 'menuitem',
      'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'checkbox',
      'slider', 'spinbutton', 'tab', 'treeitem'
    ]);
    const interactiveAttributes = new Set(['onclick', 'onmousedown', 'onmouseup', 'onchange']);
    
    // Optimized interactive element check - O(1) instead of O(n) matches()
    function isElementInteractive(element) {
      const tagName = element.tagName.toLowerCase();
      
      // Check tag names
      if (interactiveTagNames.has(tagName)) {
        if (tagName === 'a') return element.href; // Links must have href
        return true;
      }
      
      // Check roles
      const role = element.getAttribute('role');
      if (role && interactiveRoles.has(role)) return true;
      
      // Check interactive attributes
      for (const attr of interactiveAttributes) {
        if (element.hasAttribute(attr)) return true;
      }
      
      // Check tabindex (but not -1)
      const tabindex = element.getAttribute('tabindex');
      return tabindex !== null && tabindex !== '-1';
    }
    
    // Pre-build interactive element map for O(1) hasInteractiveChildren lookup
    const interactiveChildrenMap = new WeakMap();
    function buildInteractiveMap() {
      const traversalStart = Date.now();
      
      // Use iterative traversal with explicit stack to avoid recursion overhead
      const stack = [{ element: document.body, hasInteractive: false }];
      const processed = new WeakSet();
      
      while (stack.length > 0) {
        const { element, hasInteractive } = stack.pop();
        
        if (processed.has(element)) continue;
        processed.add(element);
        
        const isInteractive = isElementInteractive(element);
        let hasInteractiveDesc = hasInteractive || isInteractive;
        
        // Add children to stack in reverse order for correct processing
        const children = Array.from(element.children);
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push({ element: children[i], hasInteractive: hasInteractiveDesc });
        }
        
        // Store result
        interactiveChildrenMap.set(element, hasInteractiveDesc);
        performanceMetrics.nodeCount++;
      }
      
      performanceMetrics.traversalTime = Date.now() - traversalStart;
    }
    
    if (mode === 'outline') {
      // Outline mode: optimized flat list of interactive elements
      const processingStart = Date.now();
      
      // Use TreeWalker for optimal DOM traversal - faster than querySelectorAll
      const walker = document.createTreeWalker(
        document.documentElement,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: function(node) {
            return isElementInteractive(node) ? 
              NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        },
        false
      );
      
      let element;
      while (element = walker.nextNode()) {
        performanceMetrics.nodeCount++;
        
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
          
          // Add optional properties efficiently
          const optionalProps = {
            id: element.id,
            className: element.className,
            href: element.href,
            src: element.src,
            alt: element.alt,
            title: element.title,
            type: element.type,
            placeholder: element.placeholder,
            ariaLabel: element.getAttribute('aria-label'),
            ariaRole: element.getAttribute('role')
          };
          
          for (const [key, value] of Object.entries(optionalProps)) {
            if (value) node[key] = value;
          }
          
          nodes.push(node);
        } catch (nodeError) {
          // Skip problematic elements
          continue;
        }
      }
      
      performanceMetrics.processingTime = Date.now() - processingStart;
    } else if (mode === 'dom-lite') {
      // DOM-lite mode: optimized iterative hierarchy traversal
      buildInteractiveMap();
      const processingStart = Date.now();
      
      // Use iterative traversal with explicit stack to prevent stack overflow
      const traversalStack = [{ 
        element: document.body, 
        level: 0, 
        parentSelector: '' 
      }];
      
      while (traversalStack.length > 0) {
        const { element, level, parentSelector } = traversalStack.pop();
        
        if (level > maxDepth) continue;
        
        // Skip if visibility filtering is enabled and element is not visible
        if (visibleOnly && !isElementVisible(element)) continue;
        
        try {
          const isInteractive = isElementInteractive(element);
          const hasInteractiveChildren = interactiveChildrenMap.get(element) || false;
          
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
              const optionalProps = {
                id: element.id,
                className: element.className,
                href: element.href,
                src: element.src,
                alt: element.alt,
                title: element.title,
                type: element.type,
                placeholder: element.placeholder,
                ariaLabel: element.getAttribute('aria-label'),
                ariaRole: element.getAttribute('role')
              };
              
              for (const [key, value] of Object.entries(optionalProps)) {
                if (value) node[key] = value;
              }
            }
            
            nodes.push(node);
            
            // Add children to stack in reverse order for correct processing order
            const children = Array.from(element.children);
            for (let i = children.length - 1; i >= 0; i--) {
              traversalStack.push({
                element: children[i],
                level: level + 1,
                parentSelector: selector
              });
            }
          }
          
          performanceMetrics.nodeCount++;
        } catch (nodeError) {
          // Skip problematic elements
          continue;
        }
      }
      
      performanceMetrics.processingTime = Date.now() - processingStart;
    }
    
    const endTime = Date.now();
    
    // Monitor memory usage
    if (performance.memory) {
      performanceMetrics.memoryPeak = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    
    return JSON.stringify({
      ok: true,
      cmd: 'snapshot.' + mode,
      nodes,
      meta: {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        durationMs: endTime - startTime,
        visibleOnly,
        maxDepth: mode === 'dom-lite' ? maxDepth : undefined,
        performance: {
          algorithm: 'O(n) optimized',
          nodeCount: performanceMetrics.nodeCount,
          traversalMs: performanceMetrics.traversalTime,
          processingMs: performanceMetrics.processingTime,
          memoryPeakMB: performanceMetrics.memoryPeak,
          algorithmsUsed: [
            'TreeWalker for interactive elements',
            'WeakMap for O(1) child lookups',
            'Iterative traversal to prevent stack overflow',
            'Pre-computed selector caches'
          ]
        }
      }
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      cmd: 'snapshot.' + mode,
      nodes: [],
      error: error.message || 'Unknown error during snapshot',
      performance: {
        algorithm: 'O(n) optimized (failed)',
        nodeCount: 0,
        memoryPeakMB: 0
      }
    });
  }
})();
`;
}

// Smaller fallback script for DOM-lite when standard path returns 'missing value'
function generateDomLiteFallbackScript(options: { maxDepth: number; visibleOnly: boolean }): string {
  return `
(function() {
  try {
    const start = Date.now();
    const nodes = [];
    const visibleOnly = ${options.visibleOnly ? 'true' : 'false'};
    const maxDepth = ${Number.isFinite(options.maxDepth) ? options.maxDepth : 10};

    function isVisible(el) {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function getSimpleSelector(el) {
      const path = [];
      let e = el;
      while (e && e !== document.documentElement) {
        let s = e.tagName.toLowerCase();
        const p = e.parentElement;
        if (p) {
          const i = Array.from(p.children).indexOf(e) + 1;
          s += ':nth-child(' + i + ')';
        }
        path.unshift(s);
        e = e.parentElement;
      }
      return path.join(' > ');
    }

    const stack = [{ el: document.body, level: 0, parent: '' }];
    while (stack.length > 0) {
      const { el, level, parent } = stack.pop();
      if (level > maxDepth) continue;
      if (visibleOnly && !isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      const selector = getSimpleSelector(el);
      const node = {
        role: '',
        name: '',
        selector,
        rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
        state: {},
        tagName: el.tagName.toLowerCase(),
        level
      };
      if (parent) node.parent = parent;
      nodes.push(node);

      const children = Array.from(el.children);
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ el: children[i], level: level + 1, parent: selector });
      }
    }

    return JSON.stringify({
      ok: true,
      cmd: 'snapshot.dom-lite',
      nodes,
      meta: {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
        visibleOnly,
        maxDepth
      }
    });
  } catch (e) {
    return JSON.stringify({ ok: false, cmd: 'snapshot.dom-lite', nodes: [], error: String(e) });
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
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When target window does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When no active tab exists in the window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails in browser context
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When snapshot script execution exceeds 15 second timeout
 * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to process DOM elements
 * @throws {ErrorCode.PAGE_LOAD_FAILED} When page is not fully loaded or accessible
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * 
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent snapshot operation
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during snapshot capture
 * 
 * @example
 * ```typescript
 * // Capture all interactive elements with error handling
 * try {
 *   const result = await captureOutline();
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.CHROME_NOT_RUNNING:
 *         console.log('Start Chrome browser first');
 *         break;
 *       case ErrorCode.SCRIPT_TIMEOUT:
 *         console.log('Page too complex - try with visibleOnly: true');
 *         break;
 *       case ErrorCode.JAVASCRIPT_ERROR:
 *         console.log('Page scripts interfered with snapshot');
 *         break;
 *     }
 *   } else if (result.data) {
 *     console.log(`Captured ${result.data.nodes.length} interactive elements`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected snapshot error:', error);
 * }
 * 
 * // Capture only visible elements for better performance
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
 * @throws {ErrorCode.INVALID_INPUT} When maxDepth is negative or exceeds reasonable limits
 * 
 * @throws {ErrorCode.CHROME_NOT_RUNNING} When Chrome browser is not running or accessible
 * @throws {ErrorCode.CHROME_NOT_FOUND} When Chrome application cannot be found on system
 * @throws {ErrorCode.WINDOW_NOT_FOUND} When target window does not exist
 * @throws {ErrorCode.TAB_NOT_FOUND} When no active tab exists in the window
 * 
 * @throws {ErrorCode.JAVASCRIPT_ERROR} When JavaScript execution fails in browser context
 * @throws {ErrorCode.SCRIPT_TIMEOUT} When snapshot script execution exceeds 20 second timeout
 * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to process DOM hierarchy
 * @throws {ErrorCode.PAGE_LOAD_FAILED} When page is not fully loaded or accessible
 * @throws {ErrorCode.CPU_LIMIT_EXCEEDED} When DOM traversal exceeds processing limits
 * 
 * @throws {ErrorCode.PERMISSION_DENIED} When system permissions block browser automation
 * @throws {ErrorCode.ACCESSIBILITY_DENIED} When accessibility permissions not granted for automation
 * @throws {ErrorCode.APPLE_EVENTS_DENIED} When Apple Events permissions not granted for Chrome control
 * 
 * @throws {ErrorCode.APPLESCRIPT_ERROR} When underlying AppleScript execution fails
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent snapshot operation
 * @throws {ErrorCode.UNKNOWN_ERROR} When an unexpected error occurs during snapshot capture
 * 
 * @example
 * ```typescript
 * // Capture DOM hierarchy with error handling
 * try {
 *   const result = await captureDomLite({ maxDepth: 5, visibleOnly: true });
 *   if (!result.success) {
 *     switch (result.code) {
 *       case ErrorCode.CHROME_NOT_RUNNING:
 *         console.log('Start Chrome browser first');
 *         break;
 *       case ErrorCode.SCRIPT_TIMEOUT:
 *         console.log('Page too complex - reduce maxDepth or use visibleOnly');
 *         break;
 *       case ErrorCode.MEMORY_ERROR:
 *         console.log('Page too large - try with visibleOnly: true');
 *         break;
 *     }
 *   } else if (result.data) {
 *     console.log(`Captured ${result.data.nodes.length} hierarchical elements`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected DOM-lite snapshot error:', error);
 * }
 * 
 * // Capture with optimized settings for large pages
 * const optimizedResult = await captureDomLite({ 
 *   maxDepth: 3, 
 *   visibleOnly: true 
 * });
 * ```
 */
export interface CaptureDomLiteOptions { maxDepth?: number; visibleOnly?: boolean; mode?: 'full' | 'simple'; strategy?: 'robust' | 'legacy' }

export async function captureDomLite(options: CaptureDomLiteOptions = {}): Promise<JavaScriptResult<SnapshotResult>> {
  const snapshotOptions: SnapshotOptions = {
    mode: 'dom-lite',
    maxDepth: options.maxDepth || 10,
    visibleOnly: options.visibleOnly || false
  };
  
  // Resolve strategy from option or environment (default: robust)
  const envStrategy = (process.env.MAC_CHROME_CLI_SNAPSHOT_STRATEGY || '').toLowerCase();
  const strategy: 'robust' | 'legacy' = options.strategy || (envStrategy === 'legacy' ? 'legacy' : 'robust');

  // Simple mode: always use the lightweight script (more reliable, fewer fields)
  if (options.mode === 'simple') {
    const smallScript = generateDomLiteFallbackScript({ maxDepth: snapshotOptions.maxDepth || 10, visibleOnly: snapshotOptions.visibleOnly || false });
    return appleScriptService.executeJavaScriptOnActiveTab<SnapshotResult>(smallScript, 20000);
  }

  const script = generateSnapshotScript(snapshotOptions);

  if (strategy === 'legacy') {
    // Legacy: single path via execChromeJS (no fallbacks)
    return execChromeJS<SnapshotResult>(script, 1, 1, 20000);
  }

  // Robust: execChromeJS first (keeps unit tests expecting this), then active tab, then simple fallback
  const primary = await execChromeJS<SnapshotResult>(script, 1, 1, 20000);
  const primaryMissing = primary.success && typeof primary.data === 'string' && (primary.data as unknown as string).trim().toLowerCase().includes('missing value');
  if (primary.success && !primaryMissing) return primary;

  const activeRes = await appleScriptService.executeJavaScriptOnActiveTab<SnapshotResult>(script, 20000);
  const activeMissing = activeRes.success && typeof activeRes.data === 'string' && (activeRes.data as unknown as string).trim().toLowerCase().includes('missing value');
  if (activeRes.success && !activeMissing) return activeRes;

  const smallScript = generateDomLiteFallbackScript({ maxDepth: snapshotOptions.maxDepth || 10, visibleOnly: snapshotOptions.visibleOnly || false });
  return appleScriptService.executeJavaScriptOnActiveTab<SnapshotResult>(smallScript, 20000);
}



/**
 * Formats a JavaScript execution result into a standardized snapshot result format.
 * Handles both successful snapshots and error cases, providing consistent output
 * structure for CLI consumers.
 * 
 * @param result - The raw JavaScript execution result from Chrome
 * @returns Formatted snapshot result or error object with consistent structure
 * 
 * @throws {ErrorCode.INVALID_INPUT} When result parameter is null, undefined, or malformed
 * @throws {ErrorCode.INVALID_JSON} When result contains invalid JSON data structures
 * @throws {ErrorCode.VALIDATION_FAILED} When result data doesn't match expected SnapshotResult format
 * 
 * @throws {ErrorCode.UNKNOWN_ERROR} When formatting fails due to unexpected data structure
 * @throws {ErrorCode.MEMORY_ERROR} When insufficient memory to process large snapshot results
 * @throws {ErrorCode.SYSTEM_ERROR} When system-level errors prevent result formatting
 * 
 * @example
 * ```typescript
 * // Format snapshot result with error handling
 * try {
 *   const jsResult = await execChromeJS(script);
 *   const formatted = formatSnapshotResult(jsResult);
 *   
 *   if ('success' in formatted && !formatted.success) {
 *     switch (formatted.code) {
 *       case ErrorCode.INVALID_JSON:
 *         console.error('Malformed snapshot data received');
 *         break;
 *       case ErrorCode.VALIDATION_FAILED:
 *         console.error('Snapshot data format validation failed');
 *         break;
 *       default:
 *         console.error('Snapshot failed:', formatted.error);
 *     }
 *   } else if ('ok' in formatted && formatted.ok) {
 *     console.log(`Successfully captured ${formatted.nodes.length} elements`);
 *     console.log(`Page: ${formatted.meta?.title} (${formatted.meta?.url})`);
 *   }
 * } catch (error) {
 *   console.error('Unexpected formatting error:', error);
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
  
  // At this point, TypeScript knows result.success is true, so result.data exists
  const resultData = result.data;
  
  if (!resultData) {
    return {
      success: false,
      error: 'No snapshot data returned',
      code: ErrorCode.UNKNOWN_ERROR,
      timestamp: new Date().toISOString()
    };
  }
  
  // Parse the JSON string if needed
  let parsedData: SnapshotResult;
  if (typeof resultData === 'string') {
    const trimmed = resultData.trim();
    if (trimmed.toLowerCase().includes('missing value') && (trimmed.length < 64)) {
      return {
        success: false,
        error: 'Snapshot returned missing value (likely undefined). Try again or enable "Allow JavaScript from Apple Events" in Chrome.',
        code: ErrorCode.INVALID_JSON,
        timestamp: new Date().toISOString()
      };
    }
    try {
      parsedData = JSON.parse(trimmed) as SnapshotResult;
    } catch (e) {
      return {
        success: false,
        error: `Failed to parse snapshot data: ${e}`,
        code: ErrorCode.UNKNOWN_ERROR,
        timestamp: new Date().toISOString()
      };
    }
  } else {
    // Data is already an object (e.g., from tests or direct calls)
    parsedData = resultData as SnapshotResult;
  }
  
  // Return the parsed SnapshotResult object for successful cases
  return parsedData;
}
